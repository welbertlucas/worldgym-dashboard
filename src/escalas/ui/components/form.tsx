import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { WEEKDAY_SHORT } from '../../domain/calendar';
import { breakMinutes, effectiveMinutes, formatDuration, requiredBreakMinutes, shiftErrors } from '../../domain/time';
import type { BreakRule, Shift, Weekday } from '../../domain/types';

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className ?? ''}`}>
      <label className="field-control">
        <span className="field-label">{label}</span>
        {children}
      </label>
      {hint && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export function TimeInput({ value, onChange, disabled, ariaLabel }: { value: string | null; onChange: (v: string) => void; disabled?: boolean; ariaLabel?: string }) {
  return (
    <input
      type="time"
      step={300}
      className="input time"
      value={value ?? ''}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function NumberInput({ value, onChange, min, max, step = 1, suffix, ariaLabel }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; ariaLabel?: string }) {
  return (
    <span className="number-wrap">
      <input
        type="number"
        className="input number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </span>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="toggle">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>
        <span>{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </label>
    </div>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, ariaLabel }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button type="button" role="radio" aria-checked={o.value === value} key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function WeekdayPicker({ value, onChange, ariaLabel }: { value: Weekday[]; onChange: (v: Weekday[]) => void; ariaLabel?: string }) {
  return (
    <div className="weekday-picker" role="group" aria-label={ariaLabel}>
      {ORDER.map((w) => {
        const on = value.includes(w);
        return (
          <button type="button" key={w} aria-pressed={on} className={on ? 'on' : ''} onClick={() => onChange(on ? value.filter((x) => x !== w) : [...value, w].sort())}>
            {WEEKDAY_SHORT[w]}
          </button>
        );
      })}
    </div>
  );
}

export function ShiftEditor({ shift, onChange, compact, breakRules }: { shift: Shift; onChange: (s: Shift) => void; compact?: boolean; breakRules?: BreakRule[] }) {
  const errors = shiftErrors(shift, 'Horário');
  const hasBreak = shift.breakStart !== null || shift.breakEnd !== null;
  return (
    <div className={`shift-editor ${compact ? 'compact' : ''}`}>
      <div className="shift-row">
        <Field label="Entrada"><TimeInput value={shift.start} onChange={(v) => onChange({ ...shift, start: v })} /></Field>
        <Field label="Saída"><TimeInput value={shift.end} onChange={(v) => onChange({ ...shift, end: v })} /></Field>
        {hasBreak ? (
          <>
            <Field label="Início do intervalo"><TimeInput value={shift.breakStart} onChange={(v) => onChange({ ...shift, breakStart: v })} /></Field>
            <Field label="Fim do intervalo"><TimeInput value={shift.breakEnd} onChange={(v) => onChange({ ...shift, breakEnd: v })} /></Field>
          </>
        ) : null}
      </div>
      <div className="shift-foot">
        <button type="button" className="link" onClick={() => onChange(hasBreak ? { ...shift, breakStart: null, breakEnd: null } : { ...shift, breakStart: shift.start, breakEnd: shift.start })}>
          {hasBreak ? 'Remover intervalo' : '+ Adicionar intervalo'}
        </button>
        {errors.length === 0 ? (
          <span className="effective">
            Jornada efetiva: <strong>{formatDuration(effectiveMinutes(shift))}</strong>
            {breakMinutes(shift) > 0 && <> (intervalo de {breakMinutes(shift)} min não contado)</>}
            {breakRules && breakMinutes(shift) < requiredBreakMinutes(effectiveMinutes(shift), breakRules) && (
              <span className="field-error block">
                Falta intervalo: {formatDuration(effectiveMinutes(shift))} de trabalho pedem {requiredBreakMinutes(effectiveMinutes(shift), breakRules)} min (regra de jornada).
              </span>
            )}
          </span>
        ) : (
          <span className="field-error">{errors[0]}</span>
        )}
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>×</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: 'critico' | 'atencao' | 'info' }) {
  const label = severity === 'critico' ? 'Crítico' : severity === 'atencao' ? 'Atenção' : 'Info';
  return <span className={`badge sev-${severity}`}>{label}</span>;
}

export interface MenuItem { label: string; onClick: () => void; disabled?: boolean; title?: string }

/** Botão com lista de ações secundárias (fecha ao escolher, ao clicar fora ou com Esc). */
export function MenuButton({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', fora);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); window.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="btn ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{label} <span aria-hidden className="menu-caret">▾</span></button>
      {open && (
        <div className="menu" role="menu">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" disabled={it.disabled} title={it.title} onClick={() => { setOpen(false); it.onClick(); }}>{it.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Explicação recolhida: um "?" que mostra o texto quando a pessoa quer. */
export function Ajuda({ children, label = 'Como funciona' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ajuda">
      <button type="button" className="ajuda-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}><span aria-hidden className="ajuda-q">?</span>{label}</button>
      {open && <div className="ajuda-texto">{children}</div>}
    </div>
  );
}
