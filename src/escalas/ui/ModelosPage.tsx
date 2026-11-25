// Modelos prontos de escala: cards por coordenação, com exemplo do mês gerado e "Usar este modelo".
import { useMemo, useState } from 'react';
import { Eye, PencilRuler, Sparkles } from 'lucide-react';
import { monthLabel } from '../domain/calendar';
import { aplicarModelo, MODELOS, type Modelo } from '../domain/modelos';
import { applySettings, normalizeUnitRules } from '../domain/roster';
import { analyze, applyGeneration, createSchedule } from '../domain/scheduleOps';
import { defaultScheduleConfig } from '../domain/defaults';
import { deptName, teamDepts, TEAMS, type Schedule, type ScheduleConfig, type Team } from '../domain/types';
import type { ScheduleRepository } from '../storage/repository';
import { CalendarView, Legend } from './CalendarView';
import { Ajuda, Modal, Segmented } from './components/form';
import { generateInBackground } from './generation';

const proximoMes = () => {
  const h = new Date();
  return h.getMonth() === 11 ? { y: h.getFullYear() + 1, m: 1 } : { y: h.getFullYear(), m: h.getMonth() + 2 };
};

/** Configuração do exemplo: horário da unidade (quando há) e o modelo aplicado. */
async function configDoExemplo(repo: ScheduleRepository, unitId: string | null, modelo: Modelo) {
  const { y, m } = proximoMes();
  let c: ScheduleConfig = { ...defaultScheduleConfig(y, m), team: modelo.team };
  if (unitId && repo.getUnitSettings) {
    const u = await repo.getUnitSettings(unitId).catch(() => null);
    if (u) c = applySettings(c, u.settings);
  }
  c = aplicarModelo(c, modelo);
  normalizeUnitRules(c);
  return c;
}

export function ModelosPage({ repo, unitId, onUsar, onUsarLivre, embutido }: { repo: ScheduleRepository; unitId: string | null; onUsar: (modelo: Modelo) => void; /** Começa uma escala livre (sem modelo, sem regras, só o limite semanal). */ onUsarLivre?: () => void; /** Dentro de Escalas: sem o título da página. */ embutido?: boolean }) {
  const [filtro, setFiltro] = useState<'todas' | Team>('todas');
  const [exemplo, setExemplo] = useState<{ modelo: Modelo; schedule: Schedule | null; erro?: string } | null>(null);
  const lista = MODELOS.filter((m) => filtro === 'todas' || m.team === filtro);

  const verExemplo = async (modelo: Modelo) => {
    setExemplo({ modelo, schedule: null });
    try {
      const config = await configDoExemplo(repo, unitId, modelo);
      const r = await generateInBackground(config, 0, null);
      setExemplo({ modelo, schedule: applyGeneration(createSchedule(config.year, config.month, config, unitId ?? undefined, modelo.team), r, 0) });
    } catch (e) {
      setExemplo({ modelo, schedule: null, erro: e instanceof Error ? e.message : 'Não consegui gerar o exemplo.' });
    }
  };

  return (
    <section className="modelos">
      <div className="home-head">
        <div>
          {!embutido && <h1>Modelos de escala</h1>}
          <p className="muted">Pontos de partida prontos, com nomes fictícios. Escolha um, veja o exemplo e use na sua unidade.</p>
          <Ajuda label="Regras que todos seguem">5x2 com jornada de 8h24min por dia (42h em 5 dias, autorizada até 2028), 2 folgas por semana e 11h de descanso entre jornadas. Para estagiários, a Lei do Estágio: até 6h por dia e 30h por semana.</Ajuda>
        </div>
      </div>
      <div className="modelos-filtro">
        <Segmented ariaLabel="Coordenação dos modelos" value={filtro} onChange={setFiltro}
          options={[{ value: 'todas', label: 'Todos' }, ...TEAMS.map((t) => ({ value: t.id, label: t.name }))]} />
      </div>
      <div className="modelos-cards">
        {onUsarLivre && (
          <article className="card-surface modelo-mini" aria-label="Escala livre"
            title="Monte a escala do jeito que quiser, dia a dia. Sem regra de folga, cobertura ou turnos prontos; a única trava é o limite de 42 horas por semana (30 para estagiários).">
            <div className="modelo-mini-topo">
              <PencilRuler size={15} aria-hidden className="modelo-icone" />
              <span className="modelo-selo">Livre</span>
            </div>
            <h3>Escala livre</h3>
            <p className="modelo-mini-sub">Todas as coordenações</p>
            <p className="modelo-mini-nums">Limite de <b>42 h</b> por semana</p>
            <div className="modelo-mini-acoes">
              <button type="button" className="btn primary small" disabled={!unitId} title={unitId ? '' : 'Escolha a unidade no alto da tela'} onClick={onUsarLivre}>Montar</button>
            </div>
          </article>
        )}
        {lista.map((m) => {
          const total = m.resumo.reduce((n, r) => n + r.pessoas, 0);
          const sab = m.resumo.reduce((n, r) => n + r.sabado, 0);
          const dom = m.resumo.reduce((n, r) => n + r.domingo, 0);
          return (
            <article key={m.id} className="card-surface modelo-mini" aria-label={`Modelo ${m.nome}`} title={`${m.descricao}\n${m.resumo.map((r) => `${deptName(r.dept)}: ${r.pessoas} pessoas, sáb ${r.sabado}, dom ${r.domingo}`).join('\n')}`}>
              <div className="modelo-mini-topo">
                <span className="modelo-mini-coord">{TEAMS.find((t) => t.id === m.team)!.name.replace('Coordenação ', '')}</span>
                {m.sugerido && <span className="modelo-selo"><Sparkles size={11} aria-hidden /> Sugestão</span>}
              </div>
              <h3>{m.nome}</h3>
              <p className="modelo-mini-nums"><b>{total}</b> pessoas <span>· sáb <b>{sab}</b> · dom <b>{dom}</b></span></p>
              <div className="modelo-mini-acoes">
                <button type="button" className="btn ghost small" onClick={() => void verExemplo(m)}><Eye size={14} aria-hidden /> Exemplo</button>
                <button type="button" className="btn primary small" disabled={!unitId} title={unitId ? '' : 'Escolha a unidade no alto da tela'} onClick={() => onUsar(m)}>Usar</button>
              </div>
            </article>
          );
        })}
      </div>
      {exemplo && <ExemploDialog exemplo={exemplo} onClose={() => setExemplo(null)} onUsar={unitId ? () => { setExemplo(null); onUsar(exemplo.modelo); } : undefined} />}
    </section>
  );
}

function ExemploDialog({ exemplo, onClose, onUsar }: { exemplo: { modelo: Modelo; schedule: Schedule | null; erro?: string }; onClose: () => void; onUsar?: () => void }) {
  const analysis = useMemo(() => (exemplo.schedule ? analyze(exemplo.schedule) : null), [exemplo.schedule]);
  const s = exemplo.schedule;
  return (
    <Modal title={`Exemplo: ${exemplo.modelo.nome}`} onClose={onClose} wide footer={<>
      <button type="button" className="btn ghost" onClick={onClose}>Fechar</button>
      {onUsar && <button type="button" className="btn primary" onClick={onUsar}>Usar este modelo</button>}
    </>}>
      {exemplo.erro && <p className="form-error">{exemplo.erro}</p>}
      {!s && !exemplo.erro && <p className="muted">Gerando o exemplo do mês…</p>}
      <p className="muted small">{exemplo.modelo.descricao}</p>
      <ul className="modelo-destaques">{exemplo.modelo.destaques.map((d) => <li key={d}>{d}</li>)}</ul>
      {s && analysis && (
        <div className="stack-sm">
          <p className="muted small">
            Exemplo de {monthLabel(s.year, s.month)}, gerado agora com os feriados nacionais{analysis.valid ? ', sem conflitos obrigatórios' : ''}. Ao usar o modelo, a escala é gerada de novo para o mês escolhido.
          </p>
          <Legend />
          {teamDepts(s.config).filter((id) => s.config.departments[id].employees.length).map((id) => (
            <CalendarView key={id} analysis={analysis} config={s.config} deptId={id} showEdgeDays={false} onCell={() => {}} onEmployee={() => {}} onDay={() => {}} />
          ))}
        </div>
      )}
    </Modal>
  );
}
