// Gerador de escalas 5x2 dentro do Atlas (veio do site separado geradordeescala.worldgymacademia.com.br, 25/11/2026).
// A pessoa já entrou pelo Atlas: não há login nem troca de senha aqui; o servidor (/api/escalas) decide quais unidades ela enxerga.
// O visual do site antigo fica isolado em `.escalas` (escalas.css) para não mexer no resto do Atlas.
import { useEffect, useMemo, useState } from 'react';
import './escalas.css';
import './escalas-atlas.css';
import { API_BASE, authFetch } from '@/lib/auth';
import { Abas } from '@/components/Abas';
import { SectionTitle } from '@/components/SectionTitle';
import { Select } from '@/components/ui/select';
import { CalendarDays } from 'lucide-react';
import type { Schedule, Team } from './domain/types';
import { ApiScheduleRepository } from './storage/apiRepository';
import { UNIDADES, type Unidade } from './config/unidades';
import { Home } from './ui/Home';
import { ScheduleEditor } from './ui/ScheduleEditor';
import { RosterPage } from './ui/RosterPage';
import { PainelPage } from './ui/PainelPage';
import { RelatorioPage } from './ui/RelatorioPage';
import { Notificacoes } from './ui/Notificacoes';
import type { UnitTab } from './ui/steps/MonthSteps';
import { setUsuarioAtual } from './ui/usuarioAtual';

const UNIT_KEY = 'wg-escala5x2:unidade';

interface Info { unidades: { id: string; nome: string }[]; papel: 'dono' | 'master' | 'unidades'; nome: string; mudaRegras: boolean }

function unidadeLembrada(): string | null {
  try { return window.localStorage.getItem(UNIT_KEY); } catch { return null; }
}

export default function GeradorDeEscalas() {
  const [info, setInfo] = useState<Info | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [unitId, setUnitId] = useState<string | null>(unidadeLembrada);
  const [page, setPage] = useState<'escalas' | 'painel' | 'relatorio'>('escalas');
  /** Cadastro da unidade aberto: equipe, aba, item a destacar e a escala para onde voltar. */
  const [rosterCtx, setRosterCtx] = useState<{ team: Team; tab: UnitTab; focusId?: string; returnId?: string } | null>(null);
  const [openSeq, setOpenSeq] = useState(0);
  const [homeKey, setHomeKey] = useState(0);
  const repo = useMemo(() => new ApiScheduleRepository(), []);

  useEffect(() => {
    let vivo = true;
    authFetch(`${API_BASE}/escalas`).then(async (r) => {
      if (!r.ok) throw new Error(r.status === 403 ? 'Você ainda não tem acesso ao Gerador de escalas. Peça a liberação ao dono.' : 'Não consegui abrir o Gerador de escalas agora.');
      const j = await r.json();
      if (vivo) setInfo(j as Info);
    }).catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui abrir o Gerador de escalas agora.'); });
    return () => { vivo = false; };
  }, []);

  // Quem está usando: as alterações da própria pessoa não mostram "por <nome>".
  useEffect(() => { setUsuarioAtual(info?.nome); }, [info?.nome]);

  const units: Unidade[] = useMemo(() => (info ? UNIDADES.filter((u) => info.unidades.some((x) => x.id === u.id)) : []), [info]);
  const activeUnit = units.length ? (unitId && units.some((u) => u.id === unitId) ? unitId : units.length === 1 ? units[0].id : null) : null;

  const openSchedule = (s: Schedule) => { setSchedule(s); setRosterCtx(null); setOpenSeq((n) => n + 1); };
  const chooseUnit = (id: string) => {
    setSchedule(null); setRosterCtx(null); setPage('escalas'); setUnitId(id);
    try { window.localStorage.setItem(UNIT_KEY, id); } catch { /* sem armazenamento: só não lembra */ }
  };

  if (erro) return <div className="escalas"><div className="card center choose-unit"><h2>Gerador de escalas</h2><p className="muted">{erro}</p></div></div>;
  if (!info) return <div className="escalas"><p className="muted" style={{ padding: '1rem' }}>Carregando…</p></div>;
  if (!units.length) return <div className="escalas"><div className="card center choose-unit"><h2>Gerador de escalas</h2><p className="muted">Nenhuma das suas unidades usa o Gerador de escalas ainda.</p></div></div>;

  const perfilNome = info.nome;
  const ready = !!activeUnit;
  const nomeDaUnidade = units.find((u) => u.id === activeUnit)?.nome;
  // As seções viram abas no topo, como nos outros menus do Atlas (a barra lateral do sistema antigo saiu).
  const abas = [
    { id: 'escalas', rotulo: 'Escalas' },
    { id: 'equipe', rotulo: 'Equipe e regras da unidade' },
    { id: 'relatorio', rotulo: 'Relatório do mês' },
    ...(info.papel !== 'unidades' ? [{ id: 'painel', rotulo: 'Painel da rede' }] : []),
  ];
  const abaAtual = page === 'escalas' && rosterCtx ? 'equipe' : page;
  const irPara = (id: string) => {
    setSchedule(null);
    if (id === 'equipe') { if (!activeUnit) return; setPage('escalas'); setRosterCtx({ team: 'administrativa', tab: 'pessoas' }); return; }
    setRosterCtx(null);
    setPage(id as 'escalas' | 'painel' | 'relatorio');
  };
  return (
    <div>
      <SectionTitle level="page"><span className="inline-flex items-center gap-2"><CalendarDays className="h-6 w-6" aria-hidden />Gerador de escalas</span></SectionTitle>
      {/* A unidade fica à vista, com rótulo, como nos outros menus; o sino das notificações fica ao lado. */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <label className="block text-sm">
          <span className="block text-xs text-muted-foreground">Unidade</span>
          {units.length > 1 ? (
            <Select aria-label="Unidade" className="mt-1 h-9 w-64" value={activeUnit ?? ''} onChange={(e) => e.target.value && chooseUnit(e.target.value)}>
              {!activeUnit && <option value="" disabled>Escolha…</option>}
              {units.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Select>
          ) : (
            <span className="mt-1 flex h-9 items-center text-sm font-medium text-foreground">{nomeDaUnidade}</span>
          )}
        </label>
        <div className="escalas escalas-barra">
          <Notificacoes repo={repo} unitId={activeUnit} usuario={perfilNome} atualizar={`${homeKey}-${schedule?.id ?? ''}-${schedule?.status ?? ''}-${page}`}
            onAbrirEscala={async (id) => { const s = await repo.getSchedule(id); if (s) { setRosterCtx(null); setPage('escalas'); openSchedule(s); } }}
            onIrEscalas={() => { setSchedule(null); setRosterCtx(null); setPage('escalas'); }} />
        </div>
      </div>
      <Abas tela="escalas" titulo="Gerador de escalas" abas={abas} ativa={abaAtual} onChange={irPara} />
      <div className="escalas">
        <main className="main">
          {info.papel !== 'unidades' && page === 'painel' && (
            <PainelPage repo={repo} onOpen={(u, s) => { chooseUnit(u); openSchedule(s); }} />
          )}
          {page === 'relatorio' && <RelatorioPage repo={repo} units={units} />}
          {page === 'escalas' && (
            <>
              {!activeUnit && (
                <div className="card center choose-unit">
                  <h2>Escolha a unidade</h2>
                  <p className="muted">Selecione a unidade no campo acima para criar ou abrir as escalas dela.</p>
                </div>
              )}
              {ready && !schedule && rosterCtx && activeUnit && (
                <RosterPage key={`${activeUnit}-${rosterCtx.tab}-${rosterCtx.focusId ?? ''}`} repo={repo} unitId={activeUnit} initialTeam={rosterCtx.team} initialTab={rosterCtx.tab}
                  focusId={rosterCtx.focusId} canEditLabor={info.mudaRegras}
                  backLabel={rosterCtx.returnId ? 'Voltar para a escala' : 'Escalas salvas'} mostrarVoltar={!!rosterCtx.returnId}
                  onBack={async () => {
                    const id = rosterCtx.returnId;
                    setRosterCtx(null);
                    const s = id ? await repo.getSchedule(id) : null;
                    if (s) openSchedule(s);
                  }} />
              )}
              {ready && !schedule && !(rosterCtx && activeUnit) && (
                <Home key={`${activeUnit ?? 'geral'}-${homeKey}`} repo={repo} unitId={activeUnit ?? undefined} onOpen={openSchedule} managerName={perfilNome}
                  onRoster={activeUnit ? (team) => setRosterCtx({ team, tab: 'pessoas' }) : undefined} />
              )}
              {ready && schedule && (
                <ScheduleEditor key={`${schedule.id}-${openSeq}`} repo={repo} initial={schedule} onClose={() => { setSchedule(null); setHomeKey((k) => k + 1); }} onOpen={openSchedule} userName={perfilNome}
                  onOpenUnit={schedule.unitId ? (team, tab, focusId) => { const returnId = schedule.id; setSchedule(null); setRosterCtx({ team, tab, focusId, returnId }); } : undefined} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
