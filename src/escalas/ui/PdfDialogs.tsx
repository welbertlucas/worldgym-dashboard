import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { jsPDF } from 'jspdf';
import { Field, Modal, Segmented, Toggle } from './components/form';
import { withLayoutSuffix, type PdfDepartments, type PdfLayout } from '../pdf/names';
import { deptName, type DeptId } from '../domain/types';

const LAST_MANAGER_KEY = 'wg-escala5x2:ultimo-gestor';

export function lastManager(): string {
  try {
    return window.localStorage.getItem(LAST_MANAGER_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberManager(name: string) {
  try {
    window.localStorage.setItem(LAST_MANAGER_KEY, name);
  } catch {
    // armazenamento indisponível: apenas não lembra o nome
  }
}

export interface PdfBuildOptions {
  managerName: string;
  includeSignature: boolean;
  includeAlerts: boolean;
  layout: PdfLayout;
  departments: PdfDepartments;
}

const DEPT_HINT: Record<PdfDepartments, string> = {
  ambos: 'Todos os departamentos juntos, com a assinatura de todos.',
  separados: 'Cada departamento em páginas próprias, com a assinatura só da sua equipe — para imprimir e entregar separado.',
  recepcao: 'Só a Recepção, com a assinatura da equipe da Recepção.',
  apoio: 'Só Serviços Gerais, com a assinatura da sua equipe.',
  professores: 'Só os Professores, com a assinatura dos professores.',
  estagiarios: 'Só os Estagiários, com a assinatura dos estagiários.',
};

/**
 * Pede o nome do gestor (obrigatório), monta o PDF e o mostra no navegador,
 * com as opções de baixar ou abrir em outra aba.
 */
export function PdfExportDialog({ title, initialManager, build, fileName, onManager, onClose, notice, allowAlerts = true, depts = ['recepcao', 'apoio'] }: {
  title: string;
  initialManager?: string;
  /** Monta o PDF (o gerador é carregado só na hora de exportar). */
  build: (opts: PdfBuildOptions) => Promise<jsPDF>;
  fileName: string;
  onManager?: (name: string) => void;
  onClose: () => void;
  notice?: ReactNode;
  allowAlerts?: boolean;
  /** Departamentos incluídos na escala: cada um ganha a opção "Só …". */
  depts?: DeptId[];
}) {
  const [manager, setManager] = useState(initialManager || lastManager());
  const [signature, setSignature] = useState(true);
  const [alerts, setAlerts] = useState(false);
  const [layout, setLayout] = useState<PdfLayout>('mes');
  const [departments, setDepartments] = useState<PdfDepartments>('ambos');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const valid = manager.trim().length >= 3;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const [building, setBuilding] = useState(false);
  const show = async () => {
    setError(null);
    setBuilding(true);
    try {
      const name = manager.trim();
      const doc = await build({ managerName: name, includeSignature: signature, includeAlerts: alerts, layout, departments });
      rememberManager(name);
      onManager?.(name);
      setPreview(URL.createObjectURL(doc.output('blob')));
    } catch (e) {
      setError(e instanceof Error ? `Falha ao gerar o PDF: ${e.message}` : 'Falha ao gerar o PDF.');
    } finally {
      setBuilding(false);
    }
  };

  if (preview) return <PdfPreview url={preview} fileName={withLayoutSuffix(fileName, layout, departments)} onBack={() => setPreview(null)} onClose={onClose} />;

  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
      <button type="button" className="btn primary" disabled={!valid || building} onClick={() => void show()}>{building ? 'Montando PDF…' : 'Visualizar PDF'}</button>
    </>}>
      {notice}
      <div className="stack-sm">
        <Field label="Nome do gestor que elaborou a escala" hint="Obrigatório. Sai impresso no cabeçalho, dispensando a assinatura do gestor."
          error={manager && !valid ? 'Informe o nome completo.' : null}>
          <input className="input" value={manager} onChange={(e) => setManager(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && valid) void show(); }} />
        </Field>
        <Field label="Formato" hint={layout === 'mes' ? 'O mês inteiro em uma página, com os dois departamentos.' : 'Uma página por semana, com quadros maiores e o horário de cada dia.'}>
          <Segmented ariaLabel="Formato do PDF" value={layout} onChange={setLayout} options={[{ value: 'mes', label: 'Mês em uma página' }, { value: 'semana', label: 'Uma página por semana' }]} />
        </Field>
        {depts.length > 1 && (
          <Field label="Departamentos" hint={DEPT_HINT[departments]}>
            <Segmented ariaLabel="Departamentos no PDF" value={departments} onChange={setDepartments} options={[
              { value: 'ambos', label: 'Juntos' }, { value: 'separados', label: 'Separados' },
              ...depts.map((id) => ({ value: id as PdfDepartments, label: `Só ${deptName(id)}` })),
            ]} />
          </Field>
        )}
        <Toggle checked={signature} onChange={setSignature} label="Incluir assinaturas dos colaboradores" />
        {allowAlerts && <Toggle checked={alerts} onChange={setAlerts} label="Incluir página de pendências (uso do gestor)" hint="Não inclua na versão entregue aos colaboradores." />}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </Modal>
  );
}

export function PdfPreview({ url, fileName, onBack, onClose }: { url: string; fileName: string; onBack: () => void; onClose: () => void }) {
  const download = useMemo(() => () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [url, fileName]);
  return (
    <Modal title="Visualizar escala em PDF" onClose={onClose} wide footer={<>
      <button type="button" className="btn ghost" onClick={onBack}>Alterar opções</button>
      <a className="btn ghost" href={url} target="_blank" rel="noreferrer">Abrir em nova aba</a>
      <button type="button" className="btn primary" onClick={download}>Baixar PDF</button>
    </>}>
      <iframe className="pdf-frame" src={url} title="Pré-visualização do PDF" />
      <p className="field-hint">Se a pré-visualização não aparecer (alguns celulares não exibem PDF dentro da página), use “Abrir em nova aba” ou “Baixar PDF”.</p>
    </Modal>
  );
}
