// Relatório do mês para a contabilidade: horas e dias de cada pessoa, por unidade e coordenação.
// O gestor vê as suas unidades; o Dono e o Master, a rede toda. Exporta em Excel ou PDF.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { MONTH_NAMES, monthLabel } from '../domain/calendar';
import { escopoDoRelatorio, linhasDoRelatorio, nomeDaUnidade, pendenciasDoRelatorio, totais, type RelatorioLinha } from '../domain/relatorio';
import { formatDuration } from '../domain/time';
import type { Schedule } from '../domain/types';
import type { Unidade } from '../config/unidades';
import type { ScheduleRepository } from '../storage/repository';
import { Field } from './components/form';

const SITUACAO = { confirmada: 'Confirmada', rascunho: 'Rascunho', 'em-configuracao': 'Em configuração' } as const;
const MOTIVO = { 'sem-escala': 'sem escala', 'em-configuracao': 'escala ainda não gerada', rascunho: 'escala em rascunho' } as const;

/** Escalas do mês nas unidades pedidas (a mais recente de cada unidade e coordenação). */
async function escalasDoMes(repo: ScheduleRepository, ano: number, mes: number, unidades: string[]): Promise<Schedule[]> {
  let todas: { schedule: Schedule; updatedAt: string }[];
  if (repo.monthSchedules) todas = await repo.monthSchedules(ano, mes);
  else {
    const lista = (await Promise.all(unidades.map((u) => repo.listSchedules(u)))).flat().filter((s) => s.year === ano && s.month === mes);
    todas = (await Promise.all(lista.map(async (s) => ({ schedule: await repo.getSchedule(s.id), updatedAt: s.updatedAt })))).filter((x): x is { schedule: Schedule; updatedAt: string } => !!x.schedule);
  }
  const melhor = new Map<string, { schedule: Schedule; updatedAt: string }>();
  for (const x of todas) {
    if (!x.schedule.unitId || !unidades.includes(x.schedule.unitId)) continue;
    const chave = `${x.schedule.unitId}|${x.schedule.config.team ?? 'administrativa'}`;
    const atual = melhor.get(chave);
    if (!atual || atual.updatedAt < x.updatedAt) melhor.set(chave, x);
  }
  return [...melhor.values()].map((x) => x.schedule);
}

const mesPadrao = () => {
  const h = new Date();
  // Até o dia 10 o relatório costuma ser do mês que acabou de fechar.
  const d = h.getDate() <= 10 ? new Date(h.getFullYear(), h.getMonth() - 1, 1) : h;
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
};

export function RelatorioPage({ repo, units }: { repo: ScheduleRepository; units: Unidade[] }) {
  const padrao = mesPadrao();
  const [ano, setAno] = useState(padrao.ano);
  const [mes, setMes] = useState(padrao.mes);
  const [escopo, setEscopo] = useState<string>(units.length === 1 ? units[0].id : 'todas');
  const [escalas, setEscalas] = useState<Schedule[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState<'xlsx' | 'pdf' | null>(null);

  const ids = useMemo(() => (escopo === 'todas' ? units.map((u) => u.id) : [escopo]), [escopo, units]);
  useEffect(() => {
    let vivo = true;
    setEscalas(null);
    setErro(null);
    escalasDoMes(repo, ano, mes, ids).then((e) => { if (vivo) setEscalas(e); }).catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui carregar o relatório.'); });
    return () => { vivo = false; };
  }, [repo, ano, mes, ids]);

  const linhas = useMemo(() => (escalas ? linhasDoRelatorio(escalas) : []), [escalas]);
  const pendencias = useMemo(() => (escalas ? pendenciasDoRelatorio(escalas, ids) : []), [escalas, ids]);
  const t = useMemo(() => totais(linhas), [linhas]);
  const grupos = useMemo(() => {
    const m = new Map<string, RelatorioLinha[]>();
    for (const l of linhas) m.set(`${l.unidade}|${l.team}`, [...(m.get(`${l.unidade}|${l.team}`) ?? []), l]);
    return [...m.values()];
  }, [linhas]);
  const meta = { year: ano, month: mes, escopo: escopoDoRelatorio(ids, escopo === 'todas' && units.length > 1), pendencias };
  const anos = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];

  const exportar = async (tipo: 'xlsx' | 'pdf') => {
    setExportando(tipo);
    setErro(null);
    try {
      let blob: Blob;
      let nome: string;
      if (tipo === 'xlsx') {
        const m = await import('../export/exportExcel');
        blob = await m.buildRelatorioXlsx(linhas, meta);
        nome = m.relatorioFileName(meta, 'xlsx');
      } else {
        const [p, e] = await Promise.all([import('../pdf/exportPdf'), import('../export/exportExcel')]);
        blob = p.buildRelatorioPdf(linhas, meta, { compress: true }).output('blob');
        nome = e.relatorioFileName(meta, 'pdf');
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui gerar o arquivo.');
    } finally {
      setExportando(null);
    }
  };

  return (
    <section className="relatorio">
      <div className="home-head">
        <div>
          <p className="muted">Horas e dias de cada pessoa, para enviar à contabilidade.</p>
        </div>
        <div className="relatorio-acoes">
          <button type="button" className="btn ghost" disabled={!linhas.length || !!exportando} onClick={() => void exportar('xlsx')}><FileSpreadsheet size={15} aria-hidden /> {exportando === 'xlsx' ? 'Montando…' : 'Exportar Excel'}</button>
          <button type="button" className="btn primary" disabled={!linhas.length || !!exportando} onClick={() => void exportar('pdf')}><FileText size={15} aria-hidden /> {exportando === 'pdf' ? 'Montando…' : 'Exportar PDF'}</button>
        </div>
      </div>

      <div className="relatorio-filtros">
        <Field label="Mês">
          <select className="input" aria-label="Mês do relatório" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MONTH_NAMES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
          </select>
        </Field>
        <Field label="Ano">
          <select className="input" aria-label="Ano do relatório" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </Field>
        {units.length > 1 && (
          <Field label="Unidade">
            <select className="input" aria-label="Unidade do relatório" value={escopo} onChange={(e) => setEscopo(e.target.value)}>
              <option value="todas">{units.length > 1 ? 'Todas as unidades' : nomeDaUnidade(units[0].id)}</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </Field>
        )}
      </div>

      {erro && <div className="banner danger left" role="alert">{erro}</div>}
      {!escalas && !erro && <p className="muted">Carregando…</p>}
      {escalas && pendencias.length > 0 && (
        <div className="banner warn left" role="status">
          <strong>Ainda não confirmado em {monthLabel(ano, mes).toLowerCase()}:</strong>{' '}
          {pendencias.slice(0, 6).map((p) => `${p.unidade} · ${p.coordenacao} (${MOTIVO[p.motivo]})`).join('; ')}
          {pendencias.length > 6 ? ` e mais ${pendencias.length - 6}` : ''}. Os números podem mudar até a confirmação.
        </div>
      )}

      {escalas && (
        <>
          <div className="relatorio-resumo">
            <div className="card"><span>Pessoas</span><strong>{t.pessoas}</strong></div>
            <div className="card"><span>Horas no mês</span><strong>{formatDuration(t.minutosNoMes)}</strong></div>
            <div className="card"><span>Horas adicionais</span><strong>{t.minutosAdicionais ? formatDuration(t.minutosAdicionais) : '0h'}</strong></div>
            <div className="card"><span>Feriados trabalhados</span><strong>{t.feriadosTrabalhados}</strong></div>
            <div className="card"><span>Dias de férias</span><strong>{t.diasFerias}</strong></div>
          </div>

          {!linhas.length ? <p className="muted">Nenhuma escala gerada em {monthLabel(ano, mes).toLowerCase()} para o que você escolheu.</p> : (
            <div className="card table-wrap">
              <table className="form-table wide relatorio-tabela">
                <thead>
                  <tr><th>Colaborador</th><th>Departamento</th><th>Dias trab.</th><th>Horas no mês</th><th>Horas adic.</th><th>Folgas</th><th>Fer. trab.</th><th>Sáb.</th><th>Dom.</th><th>Férias</th><th>Cob.</th></tr>
                </thead>
                <tbody>
                  {grupos.map((g) => {
                    const tg = totais(g);
                    return (
                      <Fragment key={`${g[0].unidade}|${g[0].team}`}>
                        <tr className="grupo"><th colSpan={11}>{g[0].unidade} · {g[0].coordenacao} <span className={`status-chip ${g[0].situacao === 'confirmada' ? 'confirmada' : 'rascunho'}`}>{SITUACAO[g[0].situacao]}</span></th></tr>
                        {g.map((l, i) => (
                          <tr key={`${l.nome}-${i}`}>
                            <td>{l.nome}</td><td>{l.departamento}</td><td>{l.diasTrabalhados}</td><td>{formatDuration(l.minutosNoMes)}</td>
                            <td>{l.minutosAdicionais ? formatDuration(l.minutosAdicionais) : '–'}</td>
                            <td>{l.folgas}{l.folgasFeriado ? ` + ${l.folgasFeriado} fer.` : ''}</td><td>{l.feriadosTrabalhados || '–'}</td>
                            <td>{l.sabados}</td><td>{l.domingos}</td><td>{l.diasFerias || '–'}</td><td>{l.coberturas || '–'}</td>
                          </tr>
                        ))}
                        <tr className="subtotal"><td colSpan={2}>Total · {tg.pessoas} {tg.pessoas === 1 ? 'pessoa' : 'pessoas'}</td><td>{tg.diasTrabalhados}</td><td>{formatDuration(tg.minutosNoMes)}</td><td>{tg.minutosAdicionais ? formatDuration(tg.minutosAdicionais) : '–'}</td><td></td><td>{tg.feriadosTrabalhados || '–'}</td><td></td><td></td><td>{tg.diasFerias || '–'}</td><td></td></tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
