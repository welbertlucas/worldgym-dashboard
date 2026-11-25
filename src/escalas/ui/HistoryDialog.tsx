// Histórico de versões de uma escala: quem alterou e quando, com opção de voltar a uma versão.
import { useEffect, useState } from 'react';
import type { Schedule } from '../domain/types';
import type { ScheduleRepository, ScheduleVersion } from '../storage/repository';
import { Modal } from './components/form';

const MARCO: Record<NonNullable<ScheduleVersion['milestone']>, string> = {
  criada: 'Escala criada',
  gerada: 'Escala gerada',
  confirmada: 'Versão final confirmada',
  restaurada: 'Versão antiga restaurada',
};
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function periodo(v: ScheduleVersion) {
  const a = quando(v.createdAt);
  const b = quando(v.updatedAt);
  return a === b ? a : `${a} até ${b.slice(-5)}`;
}

export function HistoryDialog({ repo, schedule, onClose, onRestored }: { repo: ScheduleRepository; schedule: Schedule; onClose: () => void; onRestored: (s: Schedule) => void }) {
  const [versions, setVersions] = useState<ScheduleVersion[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    repo.listVersions?.(schedule.id).then(setVersions).catch((e) => setErro(e instanceof Error ? e.message : 'Não consegui carregar o histórico.'));
  }, [repo, schedule.id]);

  const restaurar = async (v: ScheduleVersion) => {
    if (!window.confirm(`Voltar a escala para a versão de ${quando(v.updatedAt)}? A versão atual continua guardada no histórico.`)) return;
    setBusy(v.id);
    try {
      const s = await repo.restoreVersion?.(v.id, schedule.id);
      if (s) onRestored(s);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui restaurar.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title="Histórico da escala" onClose={onClose} wide footer={<button type="button" className="btn ghost" onClick={onClose}>Fechar</button>}>
      <p className="muted">Cada linha é uma versão guardada. Edições seguidas da mesma pessoa, em até 15 minutos, ficam juntas numa versão só.</p>
      {erro && <p className="field-error" role="alert">{erro}</p>}
      {!versions && !erro && <p className="muted">Carregando…</p>}
      {versions?.length === 0 && <p className="muted">Ainda não há versões guardadas desta escala.</p>}
      {versions && versions.length > 0 && (
        <ol className="history-list">
          {versions.map((v, i) => (
            <li key={v.id} className={i === 0 ? 'atual' : ''}>
              <div>
                <strong>{v.milestone ? MARCO[v.milestone] : 'Edições'}</strong>
                <span className="muted small">{periodo(v)} · {v.author ?? 'pessoa removida'}</span>
                <span className={`status-chip ${v.status}`}>{v.status === 'confirmada' ? 'Confirmada' : v.generated ? 'Rascunho' : 'Em configuração'}</span>
              </div>
              {i === 0 ? <span className="tag">Versão atual</span> : (
                <button type="button" className="btn ghost small" disabled={busy !== null} onClick={() => void restaurar(v)}>{busy === v.id ? 'Restaurando…' : 'Restaurar'}</button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
