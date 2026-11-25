// Unidades que aparecem na barra lateral. Enquanto a lista estiver vazia, a escolha de unidade não é exibida.
// Para incluir: { id: 'identificador-sem-espacos', nome: 'Nome exibido' }. Não altere o id depois de criado
// (as escalas salvas ficam ligadas a ele).
export interface Unidade {
  id: string;
  nome: string;
}

export const UNIDADES: Unidade[] = [
  { id: 'asa-norte', nome: 'Asa Norte' },
  { id: 'gama', nome: 'Gama' },
  { id: 'itapoa', nome: 'Itapoã' },
  { id: 'aguas-lindas', nome: 'Águas Lindas' },
  { id: 'ponte-alta', nome: 'Ponte Alta' },
  { id: 'goiania-pro', nome: 'Goiânia Pro' },
  { id: 'salvador-pro', nome: 'Salvador Pro' },
  { id: 'jardim-inga', nome: 'Jardim Ingá' },
  { id: 'santa-maria', nome: 'Santa Maria' },
];
