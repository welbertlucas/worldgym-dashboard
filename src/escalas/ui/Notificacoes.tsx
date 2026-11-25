// Sino de notificações da barra do topo: lembrete do prazo da rede para a escala do próximo mês
// (a partir de 10 dias antes do prazo), por coordenação que ainda não confirmou.
import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { formatDayMonth, MONTH_NAMES } from '../domain/calendar';
import { diasAtePrazo, prazoDaEscala, textoDias } from '../domain/prazo';
import { avisosDasEscalas } from '../domain/avisos';
import { TEAMS } from '../domain/types';
import type { ScheduleRepository, ScheduleSummary } from '../storage/repository';

interface Aviso { id: string; titulo: string; escalaId?: string; dispensavel?: boolean }

const chaveLido = (unitId: string) => `wg-avisos-lidos:${unitId}`;
const lerLido = (unitId: string) => { try { return window.localStorage.getItem(chaveLido(unitId)); } catch { return null; } };

export function Notificacoes({ repo, unitId, atualizar, onAbrirEscala, onIrEscalas, usuario }: {
  usuario?: string;
  repo: ScheduleRepository;
  unitId: string | null;
  /** Muda quando algo pode ter alterado as escalas (recarrega os avisos). */
  atualizar: unknown;
  onAbrirEscala: (id: string) => void;
  onIrEscalas: () => void;
}) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [resumo, setResumo] = useState<{ texto: string; vencido: boolean } | null>(null);
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!unitId) { setAvisos([]); setResumo(null); return; }
    let vivo = true;
    (async () => {
      const itens: Aviso[] = [];
      let res: { texto: string; vencido: boolean } | null = null;
      try {
        const lista = await repo.listSchedules(unitId);
        const d = repo.getNetworkDeadline ? await repo.getNetworkDeadline().catch(() => null) : null;
        const hoje = new Date();
        const prox = hoje.getMonth() === 11 ? { y: hoje.getFullYear() + 1, m: 1 } : { y: hoje.getFullYear(), m: hoje.getMonth() + 2 };
        if (d) {
          const limite = prazoDaEscala(prox.y, prox.m, d.day);
          const dias = diasAtePrazo(limite);
          if (dias <= 10) {
            const doMes = (t: string) => lista.find((s: ScheduleSummary) => s.year === prox.y && s.month === prox.m && (s.team ?? 'administrativa') === t);
            const mes = MONTH_NAMES[prox.m - 1].toLowerCase();
            for (const t of TEAMS) {
              const s = doMes(t.id);
              if (s?.status === 'confirmada') continue;
              const situacao = !s ? 'ainda não foi criada' : s.generated ? 'está gerada e falta confirmar' : 'foi criada e ainda não foi gerada';
              itens.push({ id: t.id, titulo: `${t.name}: escala de ${mes} ${situacao}`, escalaId: s?.id });
            }
            res = { texto: `Prazo da rede: ${formatDayMonth(limite)} (${textoDias(dias)})`, vencido: dias < 0 };
          }
        }
        const atual = hoje.getFullYear() * 12 + hoje.getMonth() + 1;
        const recentes = lista.filter((s) => s.generated && s.year * 12 + s.month >= atual && s.year * 12 + s.month <= atual + 1);
        const completas = (await Promise.all(recentes.map((s) => repo.getSchedule(s.id).catch(() => null)))).filter((s): s is NonNullable<typeof s> => !!s);
        for (const a of avisosDasEscalas(completas, { hoje, usuario, lidoEm: lerLido(unitId) })) itens.push({ id: a.id, titulo: a.titulo, escalaId: a.escalaId, dispensavel: a.dispensavel });
      } catch { /* mostra o que deu para montar */ }
      if (vivo) { setAvisos(itens); setResumo(res); }
    })();
    return () => { vivo = false; };
  }, [repo, unitId, atualizar, usuario]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); window.removeEventListener('keydown', esc); };
  }, [aberto]);

  if (!unitId) return null;
  const marcarLidas = () => {
    try { window.localStorage.setItem(chaveLido(unitId), new Date().toISOString()); } catch { /* sem armazenamento */ }
    setAvisos((l) => l.filter((a) => !a.dispensavel));
  };
  const n = avisos.length;
  return (
    <div className="notif" ref={ref}>
      <button type="button" className={`notif-btn ${n ? (resumo?.vencido ? 'vencido' : 'perto') : ''}`} aria-haspopup="dialog" aria-expanded={aberto}
        aria-label={n ? `Notificações: ${n} ${n === 1 ? 'aviso' : 'avisos'}` : 'Notificações: nenhum aviso'} onClick={() => setAberto((a) => !a)}>
        <Bell size={18} strokeWidth={2} aria-hidden />
        {n > 0 && <span className="notif-badge">{n}</span>}
      </button>
      {aberto && (
        <div className="notif-pop" role="dialog" aria-label="Notificações">
          <div className="notif-head">
            <strong>Notificações</strong>
            {resumo && <span className={`notif-prazo ${resumo.vencido ? 'vencido' : ''}`}>{resumo.texto}</span>}
          </div>
          {avisos.some((a) => a.dispensavel) && <button type="button" className="link notif-lidas" onClick={marcarLidas}>Marcar alterações como lidas</button>}
          {n === 0 ? <p className="muted small notif-vazio">Nenhum aviso agora.</p> : (
            <ul>
              {avisos.map((a) => (
                <li key={a.id}>
                  <p className="notif-titulo">{a.titulo}</p>
                  <button type="button" className="link" onClick={() => { setAberto(false); if (a.escalaId) onAbrirEscala(a.escalaId); else onIrEscalas(); }}>
                    {a.escalaId ? 'Abrir a escala' : 'Ir para Escalas e criar'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
