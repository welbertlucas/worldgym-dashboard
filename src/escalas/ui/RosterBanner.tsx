import { useState } from 'react';
import { describeDiff } from '../domain/roster';
import type { RosterState } from './useRosterSync';
import { porQuem } from './usuarioAtual';

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Avisos do cadastro da equipe no editor (no topo e na aba Ausências). */
export function RosterBanner({ state, onBring, onSend, step }: { state: RosterState; onBring: () => void; onSend: () => Promise<void>; step: string }) {
  const [fechado, setFechado] = useState(false);
  const [busy, setBusy] = useState(false);

  if (state.kind === 'diff') {
    return (
      <div className="banner warn left roster-banner" role="status">
        <strong>Esta escala está diferente do cadastro da unidade</strong>
        <p>{describeDiff(state.diff)}. Cadastro alterado em {quando(state.stored.updatedAt)}{porQuem(state.stored.updatedBy)}.</p>
        <div className="roster-actions">
          <button type="button" className="btn primary small" onClick={onBring}>Atualizar esta escala com o cadastro</button>
          <button type="button" className="btn ghost small" disabled={busy} onClick={async () => { setBusy(true); await onSend(); setBusy(false); }}>
            Manter esta equipe e salvar no cadastro
          </button>
        </div>
        <p className="small">Ao atualizar, a escala precisa ser gerada de novo para valer a nova equipe.</p>
      </div>
    );
  }
  if (state.kind === 'erro') return <div className="banner danger left" role="alert">{state.message}</div>;
  if (state.kind === 'sync' && state.applied && !fechado) {
    return (
      <div className="banner info left roster-banner" role="status">
        <button type="button" className="icon-btn" aria-label="Fechar aviso" onClick={() => setFechado(true)}>×</button>
        Equipe e regras trazidas do cadastro da unidade{state.stored ? ` (alterado em ${quando(state.stored.updatedAt)}${porQuem(state.stored.updatedBy)})` : ''}.
      </div>
    );
  }
  if (step !== 'ausencias' && step !== 'colaboradores') return null;
  if (state.kind === 'sync') return <p className="roster-note">Férias lançadas aqui também ficam no <strong>cadastro da unidade</strong> e aparecem nas próximas escalas. Os dias indisponíveis valem só para este mês.</p>;
  if (state.kind === 'off' && state.reason !== 'sem-cadastro')
    return <p className="roster-note">{state.reason === 'confirmada' ? 'Escala confirmada' : 'Escala de mês passado'}: as mudanças aqui valem só para esta escala e não alteram o cadastro da equipe da unidade.</p>;
  return null;
}
