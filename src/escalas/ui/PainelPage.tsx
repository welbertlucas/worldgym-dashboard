// Painel da rede (dono e master): em cada unidade, se a escala do mês existe, em que pé está,
// se tem conflitos e quem mexeu por último. No topo, o que ainda falta: escalas com conflito, não
// criadas, não geradas e não confirmadas, e quanto falta para o mês começar.
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { UNIDADES } from '../config/unidades';
import { monthLabel, MONTH_NAMES } from '../domain/calendar';
import { analyze } from '../domain/scheduleOps';
import { TEAMS, type Schedule, type Team } from '../domain/types';
import type { ApiScheduleRepository } from '../storage/apiRepository';
import { Segmented } from './components/form';
import { diasAtePrazo, PRAZO_PADRAO, prazoDaEscala, textoDias } from '../domain/prazo';
import { formatDayMonth } from '../domain/calendar';
import { porQuem } from './usuarioAtual';

interface Celula {
  schedule: Schedule;
  updatedAt: string;
  updatedBy?: string;
  conflitos: number;
  atencao: number;
}

type Pendencia = 'conflito' | 'sem-escala' | 'configuracao' | 'rascunho';
const PENDENCIAS: { id: Pendencia; titulo: string; dica: string }[] = [
  { id: 'conflito', titulo: 'Com conflito obrigatório', dica: 'Não podem ser confirmadas até corrigir.' },
  { id: 'sem-escala', titulo: 'Sem escala criada', dica: 'A unidade ainda não começou a escala do mês.' },
  { id: 'configuracao', titulo: 'Criadas, mas não geradas', dica: 'Escala aberta, ainda sem as folgas geradas.' },
  { id: 'rascunho', titulo: 'Geradas, falta confirmar', dica: 'Sem conflitos; falta o gestor confirmar a versão final.' },
];
const pendencia = (c: Celula | undefined): Pendencia | null =>
  !c ? 'sem-escala' : c.schedule.status === 'confirmada' ? null : !c.schedule.cells ? 'configuracao' : c.conflitos > 0 ? 'conflito' : 'rascunho';
/** Junta as duas equipes da mesma unidade. */
function agrupar<T extends { unitId: string }>(l: T[]): T[][] {
  const m = new Map<string, T[]>();
  for (const x of l) m.set(x.unitId, [...(m.get(x.unitId) ?? []), x]);
  return [...m.values()];
}
const nomeEquipe = (t: Team) => (t === 'administrativa' ? 'Administrativa' : 'Técnica');

/** "Dezembro começa em 19 dias" / "mês em andamento" / "mês encerrado". */
function prazo(ano: number, mes: number): { texto: string; urgente: boolean } {
  const hoje = new Date();
  const h = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const inicio = Date.UTC(ano, mes - 1, 1);
  const fim = Date.UTC(ano, mes, 0);
  const nome = MONTH_NAMES[mes - 1];
  if (h > fim) return { texto: `${nome} de ${ano} já terminou.`, urgente: false };
  if (h >= inicio) return { texto: `${nome} de ${ano} está em andamento.`, urgente: true };
  const dias = Math.round((inicio - h) / 86400000);
  return { texto: dias === 1 ? `${nome} começa amanhã.` : `${nome} começa em ${dias} dias.`, urgente: dias <= 7 };
}

const situacao = (c: Celula) => (c.schedule.status === 'confirmada' ? 'Confirmada' : c.schedule.cells ? 'Rascunho' : 'Em configuração');
const dia = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function PainelPage({ repo, onOpen }: { repo: ApiScheduleRepository; onOpen: (unitId: string, s: Schedule) => void }) {
  const hoje = new Date();
  const prox = hoje.getMonth() === 11 ? { y: hoje.getFullYear() + 1, m: 1 } : { y: hoje.getFullYear(), m: hoje.getMonth() + 2 };
  const [ano, setAno] = useState(prox.y);
  const [mes, setMes] = useState(prox.m);
  const [dados, setDados] = useState<Map<string, Celula> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todas' | 'pendentes'>('todas');
  const [prazoDia, setPrazoDia] = useState<number | null>(null);
  const [prazoInfo, setPrazoInfo] = useState<string | null>(null);
  const [prazoErro, setPrazoErro] = useState<string | null>(null);
  useEffect(() => {
    repo.getNetworkDeadline().then((d) => {
      setPrazoDia(d?.day ?? PRAZO_PADRAO);
      if (d?.updatedBy) setPrazoInfo(`Definido por ${d.updatedBy}`);
    }).catch(() => setPrazoDia(PRAZO_PADRAO));
  }, [repo]);
  const mudarPrazo = async (dia: number) => {
    const antes = prazoDia;
    setPrazoDia(dia);
    setPrazoErro(null);
    try {
      await repo.saveNetworkDeadline(dia);
      setPrazoInfo('Prazo salvo para toda a rede');
    } catch (e) {
      setPrazoDia(antes);
      setPrazoErro(e instanceof Error ? e.message : 'Não consegui salvar o prazo.');
    }
  };

  const carregar = useCallback(async () => {
    setDados(null);
    setErro(null);
    try {
      const lista = await repo.monthSchedules(ano, mes);
      const m = new Map<string, Celula>();
      for (const it of lista) {
        const chave = `${it.schedule.unitId}|${it.schedule.config.team ?? 'administrativa'}`;
        const atual = m.get(chave);
        if (atual && atual.updatedAt > it.updatedAt) continue;
        const a = analyze(it.schedule);
        m.set(chave, { ...it, conflitos: a?.counts.critico ?? 0, atencao: a?.counts.atencao ?? 0 });
      }
      setDados(m);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui carregar o painel.');
    }
  }, [repo, ano, mes]);
  useEffect(() => { void carregar(); }, [carregar]);

  const resumo = useMemo(() => {
    if (!dados) return null;
    return TEAMS.map((t) => {
      const cel = UNIDADES.map((u) => dados.get(`${u.id}|${t.id}`)).filter((c): c is Celula => !!c);
      return {
        team: t,
        criadas: cel.length,
        confirmadas: cel.filter((c) => c.schedule.status === 'confirmada').length,
        comConflito: cel.filter((c) => c.schedule.cells && c.conflitos > 0).length,
      };
    });
  }, [dados]);

  const pendentes = useMemo(() => {
    if (!dados) return null;
    const grupos = new Map<Pendencia, { unitId: string; team: Team; c?: Celula }[]>(PENDENCIAS.map((p) => [p.id, []]));
    for (const u of UNIDADES)
      for (const t of TEAMS) {
        const c = dados.get(`${u.id}|${t.id}`);
        const p = pendencia(c);
        if (p) grupos.get(p)!.push({ unitId: u.id, team: t.id, c });
      }
    return grupos;
  }, [dados]);
  const totalPendentes = pendentes ? [...pendentes.values()].reduce((a, l) => a + l.length, 0) : 0;
  const unidadesVisiveis = UNIDADES.filter((u) => filtro === 'todas' || TEAMS.some((t) => pendencia(dados?.get(`${u.id}|${t.id}`)) !== null));
  const p = prazo(ano, mes);
  const limite = prazoDia ? prazoDaEscala(ano, mes, prazoDia) : null;
  const dias = limite ? diasAtePrazo(limite) : null;
  const atrasado = dias !== null && dias < 0 && totalPendentes > 0;
  const atrasada = (unitId: string) => atrasado && TEAMS.some((t) => pendencia(dados?.get(`${unitId}|${t.id}`)) !== null);

  const anos = [hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1];

  const celula = (unitId: string, team: Team) => {
    const c = dados?.get(`${unitId}|${team}`);
    if (!c) return <td className="painel-cel vazia"><span className="painel-sit nao">Não criada</span></td>;
    return (
      <td className="painel-cel">
        <button type="button" className="painel-abrir" onClick={() => onOpen(unitId, c.schedule)} aria-label={`Abrir escala de ${UNIDADES.find((u) => u.id === unitId)?.nome}, ${team === 'administrativa' ? 'Coordenação Administrativa' : 'Coordenação Técnica'}`}>
          <span className={`status-chip ${c.schedule.status}`}>{situacao(c)}</span>
          {c.schedule.cells && (c.conflitos > 0
            ? <span className="painel-conf ruim">{c.conflitos} {c.conflitos === 1 ? 'conflito' : 'conflitos'}</span>
            : <span className="painel-conf bom">Sem conflitos</span>)}
          <span className="muted small">{c.schedule.managerName ? <>Elaborada por {c.schedule.managerName}<br /></> : null}Alterada {dia(c.updatedAt)}{porQuem(c.updatedBy)}</span>
        </button>
      </td>
    );
  };

  return (
    <section className="painel">
      <div className="acessos-head">
        <div>
          <p className="muted">Situação das escalas de cada unidade no mês escolhido. Clique numa escala para abrir.</p>
        </div>
        <div className="painel-mes">
          <select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))} aria-label="Mês">
            {MONTH_NAMES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
          </select>
          <select className="input" value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano">
            {anos.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="button" className="btn ghost small" onClick={() => void carregar()}>Atualizar</button>
        </div>
      </div>
      <div className="painel-prazo-config">
        <label htmlFor="prazo-dia">Prazo da rede: confirmar a escala até o dia</label>
        <select id="prazo-dia" className="input small" value={prazoDia ?? ''} disabled={prazoDia === null} onChange={(e) => void mudarPrazo(Number(e.target.value))}>
          {prazoDia === null && <option value="">…</option>}
          {Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
        <span>do mês anterior.</span>
        {prazoErro ? <span className="form-error">{prazoErro}</span> : prazoInfo && <span className="muted small">{prazoInfo}</span>}
      </div>

      {erro && <div className="banner danger left" role="alert">{erro}</div>}
      {!dados && !erro && <p className="muted">Carregando…</p>}

      {resumo && (
        <div className="painel-resumo">
          {resumo.map((r) => (
            <div key={r.team.id} className="card">
              <h2>{r.team.name}</h2>
              <p className="painel-num"><strong>{r.confirmadas}</strong> de {UNIDADES.length} unidades confirmaram {monthLabel(ano, mes).toLowerCase()}</p>
              <div className="painel-barra" role="img" aria-label={`${r.confirmadas} de ${UNIDADES.length} confirmadas`}>
                <span className="conf" style={{ width: `${(r.confirmadas / UNIDADES.length) * 100}%` }} />
                <span className="cria" style={{ width: `${((r.criadas - r.confirmadas) / UNIDADES.length) * 100}%` }} />
              </div>
              <p className="muted small">{r.criadas} com escala criada · <span className={r.comConflito ? 'txt-ruim' : ''}>{r.comConflito} com conflitos</span> · {UNIDADES.length - r.criadas} sem escala</p>
            </div>
          ))}
        </div>
      )}

      {pendentes && (
        <div className={`card painel-pend ${(atrasado || (p.urgente && totalPendentes)) ? 'urgente' : ''}`}>
          <div className="painel-pend-head">
            <h2>{totalPendentes
              ? `${totalPendentes} ${atrasado ? (totalPendentes === 1 ? 'escala atrasada' : 'escalas atrasadas') : (totalPendentes === 1 ? 'escala pendente' : 'escalas pendentes')}`
              : 'Todas as escalas confirmadas'}</h2>
            {limite && dias !== null && (
              <span className={`painel-prazo ${atrasado ? 'vencido' : dias <= 5 && totalPendentes ? 'perto' : ''}`}>
                Prazo para confirmar: {formatDayMonth(limite)} {dias >= 0 || totalPendentes ? `(${textoDias(dias)})` : ''}
              </span>
            )}
            <span className="muted">{p.texto}</span>
          </div>
          {atrasado && <p className="painel-atraso">O prazo da rede para confirmar a escala de {MONTH_NAMES[mes - 1].toLowerCase()} {textoDias(dias!)}. As unidades abaixo ainda não confirmaram.</p>}
          {totalPendentes > 0 && (
            <div className="painel-pend-grupos">
              {PENDENCIAS.filter((g) => pendentes.get(g.id)!.length).map((g) => (
                <div key={g.id} className={`painel-pend-grupo ${g.id}`}>
                  <h3>{g.titulo} <span className="muted">({pendentes.get(g.id)!.length} {pendentes.get(g.id)!.length === 1 ? 'escala' : 'escalas'})</span></h3>
                  <p className="muted small">{g.dica}</p>
                  <ul>
                    {agrupar(pendentes.get(g.id)!).map((it) => {
                      const unidade = UNIDADES.find((u) => u.id === it[0].unitId)?.nome;
                      if (it.length === 2 && !it.some((x) => x.c)) return <li key={it[0].unitId}><span>{unidade} <span className="muted">· as duas equipes</span></span></li>;
                      return it.map(({ unitId, team, c }) => {
                        const nome = `${unidade} · ${nomeEquipe(team)}`;
                        return (
                          <li key={`${unitId}|${team}`}>
                            {c ? <button type="button" className="link" onClick={() => onOpen(unitId, c.schedule)}>{nome}</button> : <span>{nome}</span>}
                            {g.id === 'conflito' && c && <span className="painel-conf ruim">{c.conflitos}</span>}
                          </li>
                        );
                      });
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {dados && (
        <div className="painel-filtro">
          <Segmented ariaLabel="Unidades na tabela" value={filtro} onChange={setFiltro}
            options={[{ value: 'todas', label: 'Todas as unidades' }, { value: 'pendentes', label: 'Só com pendência' }]} />
        </div>
      )}

      {dados && (
        <div className="card table-wrap">
          <table className="form-table wide painel-tabela">
            <thead><tr><th>Unidade</th>{TEAMS.map((t) => <th key={t.id}>{t.name}</th>)}</tr></thead>
            <tbody>
              {unidadesVisiveis.length === 0 && <tr><td colSpan={3} className="muted">Nenhuma unidade com pendência.</td></tr>}
              {unidadesVisiveis.map((u) => (
                <tr key={u.id} className={atrasada(u.id) ? 'atrasada' : undefined}>
                  <th scope="row">{u.nome}{atrasada(u.id) && <span className="painel-tag-atraso">atrasada</span>}</th>
                  {TEAMS.map((t) => <Fragment key={t.id}>{celula(u.id, t.id)}</Fragment>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

