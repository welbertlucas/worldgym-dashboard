// Escala individual em PDF: uma página por pessoa (ou só a de uma pessoa), para entregar a cada colaborador.
import { useEffect, useState } from 'react';
import type { Analysis } from '../domain/analyze';
import { deptName, type Schedule } from '../domain/types';
import { Field, Modal, Toggle } from './components/form';

export function PdfIndividualDialog({ schedule, analysis, onClose }: { schedule: Schedule; analysis: Analysis; onClose: () => void }) {
  const [quem, setQuem] = useState('todos');
  const [assinatura, setAssinatura] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pessoas, setPessoas] = useState<{ id: string; nome: string; dept: string }[] | null>(null);

  // O gerador de PDF só é carregado quando a janela abre.
  useEffect(() => {
    let vivo = true;
    void import('../pdf/exportPdf').then((m) => {
      if (vivo) setPessoas(m.individualPeople(schedule, analysis).map((p) => ({ id: p.emp.id, nome: p.emp.name || 'Colaborador', dept: deptName(p.deptId) })));
    });
    return () => { vivo = false; };
  }, [schedule, analysis]);

  const gerar = async () => {
    setGerando(true);
    setErro(null);
    try {
      const m = await import('../pdf/exportPdf');
      const escolhida = pessoas?.find((p) => p.id === quem);
      const doc = m.buildIndividualPdf(schedule, analysis, {
        employeeIds: quem === 'todos' ? undefined : [quem],
        includeSignature: assinatura,
        managerName: schedule.managerName,
        compress: true,
      });
      const url = URL.createObjectURL(doc.output('blob'));
      const a = document.createElement('a');
      a.href = url;
      a.download = m.individualFileName(schedule, escolhida?.nome);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui gerar o PDF.');
    } finally {
      setGerando(false);
    }
  };

  const departamentos = [...new Set((pessoas ?? []).map((p) => p.dept))];
  return (
    <Modal title="PDF individual" onClose={onClose} footer={<>
      <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
      <button type="button" className="btn primary" disabled={gerando || !pessoas} onClick={() => void gerar()}>{gerando ? 'Gerando…' : 'Gerar PDF'}</button>
    </>}>
      <p className="muted">Uma página por pessoa, só com os dias dela: horários, folgas, férias e feriados do mês.</p>
      <div className="stack-sm">
        <Field label="Quem">
          <select className="input" aria-label="Quem" value={quem} onChange={(e) => setQuem(e.target.value)} disabled={!pessoas}>
            <option value="todos">Todas as pessoas{pessoas ? ` (${pessoas.length} páginas)` : ''}</option>
            {departamentos.map((d) => (
              <optgroup key={d} label={d}>
                {(pessoas ?? []).filter((p) => p.dept === d).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Toggle checked={assinatura} onChange={setAssinatura} label="Linha de assinatura do colaborador" />
        {erro && <p className="form-error" role="alert">{erro}</p>}
      </div>
    </Modal>
  );
}
