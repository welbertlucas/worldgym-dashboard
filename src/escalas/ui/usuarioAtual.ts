// Quem está usando o sistema agora: quando foi a própria pessoa que alterou algo, não repetimos
// "por <nome>" (o nome só aparece quando a alteração foi de outra pessoa).
let atual: string | null = null;

export function setUsuarioAtual(nome: string | null | undefined) {
  atual = nome?.trim() || null;
}

/** " por Fulano" quando outra pessoa alterou; vazio quando foi quem está usando o sistema. */
export function porQuem(nome?: string | null): string {
  const n = nome?.trim();
  if (!n || (atual && n.localeCompare(atual, 'pt-BR', { sensitivity: 'base' }) === 0)) return '';
  return ` por ${n}`;
}
