// Horários, reputação e serviços das academias concorrentes (Estudos de ponto): tipos, rótulos e contas da tela e do PDF (sem React).
// Os serviços vêm do nome da academia e do site quando dá para ler (nas grandes redes, só do nome). Não achar um serviço não quer dizer que a
// academia não oferece: o que não foi achado aparece como "não foi possível encontrar outras modalidades".
export type FonteServico = "nome" | "site";
export interface ServicoInfo { id: string; fonte: FonteServico }
export interface Horario { h24: boolean; domingo: boolean; abre: string; fecha: string }
export interface InfoAcademia { nota: number | null; avaliacoes: number; horario: Horario | null; site: string | null; servicos: ServicoInfo[] }

/** Mesma lista do servidor (server/servicosAcademias.js), na mesma ordem. */
export const ROTULO_SERVICO: Record<string, string> = {
  musculacao: "Musculação", cross: "Cross", lutas: "Lutas", danca: "Dança", pilates: "Pilates", yoga: "Yoga", bike: "Bike / spinning",
  funcional: "Funcional", coletivas: "Aulas coletivas", natacao: "Piscina / natação", personal: "Studio / personal", kids: "Espaço kids",
  avaliacao: "Avaliação física", nutricao: "Nutricionista", wellhub: "Wellhub / Gympass", totalpass: "TotalPass",
};
export const ORDEM_SERVICOS = Object.keys(ROTULO_SERVICO);
export const ROTULO_FONTE: Record<FonteServico, string> = { nome: "pelo nome", site: "pelo site" };
export const SEM_MODALIDADES = "não foi possível encontrar outras modalidades";
/** Serviços além de musculação (quase toda academia tem). */
export const outrasModalidades = (i: InfoAcademia) => i.servicos.filter((s) => s.id !== "musculacao");

export const textoHorario = (h: Horario | null) => (!h ? "sem horário no Google" : h.h24 ? "24 horas" : `${h.abre} às ${h.fecha}${h.domingo ? ", abre no domingo" : ""}`);
export const textoNota = (i: InfoAcademia) => (i.nota == null ? "sem nota" : `${i.nota.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${i.avaliacoes.toLocaleString("pt-BR")} ${i.avaliacoes === 1 ? "avaliação" : "avaliações"})`);
/** Linha curta para a lista e o mapa: nota, horário e serviços. */
export const linhaInfo = (i: InfoAcademia) => {
  const mods = outrasModalidades(i).map((s) => ROTULO_SERVICO[s.id] ?? s.id);
  return [i.nota == null ? null : `★ ${textoNota(i)}`, i.horario ? (i.horario.h24 ? "24h" : `${i.horario.abre}–${i.horario.fecha}${i.horario.domingo ? " · domingo" : ""}`) : null, ...(mods.length ? mods : [SEM_MODALIDADES])].filter(Boolean).join(" · ");
};

/** Números da área (só as academias consultadas). Musculação fica de fora da contagem de serviços: quase toda academia tem. */
export function resumoServicos(infos: (InfoAcademia | null | undefined)[]) {
  const ok = infos.filter((x): x is InfoAcademia => !!x);
  const comHorario = ok.filter((x) => x.horario);
  const comNota = ok.filter((x) => x.nota != null && x.avaliacoes >= 5);
  const avaliacoes = comNota.reduce((a, x) => a + x.avaliacoes, 0);
  const porServico = ORDEM_SERVICOS.filter((s) => s !== "musculacao").map((id) => ({ id, rotulo: ROTULO_SERVICO[id], n: ok.filter((x) => x.servicos.some((s) => s.id === id)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  // cadastros estranhos no Google (abre "à meia-noite", fecha "às 4h") distorcem o horário da área: ficam de fora dessa conta
  const aberturas = comHorario.filter((x) => !x.horario!.h24).map((x) => x.horario!.abre).filter((h) => h > "00:00" && h < "12:00").sort();
  const fechamentos = comHorario.filter((x) => !x.horario!.h24).map((x) => x.horario!.fecha).filter((h) => h > "12:00" && h < "24:00").sort();
  return {
    consultadas: ok.length,
    semResposta: infos.length - ok.length,
    comServico: ok.filter((x) => x.servicos.some((s) => s.id !== "musculacao")).length,
    comHorario: comHorario.length,
    h24: comHorario.filter((x) => x.horario!.h24).length,
    domingo: comHorario.filter((x) => x.horario!.domingo).length,
    abreMaisCedo: aberturas[0] ?? null,
    fechaMaisTarde: fechamentos.at(-1) ?? null,
    /** Média ponderada pelo número de avaliações (academias com pelo menos 5). */
    notaMedia: avaliacoes ? comNota.reduce((a, x) => a + x.nota! * x.avaliacoes, 0) / avaliacoes : null,
    comNota: comNota.length,
    porServico,
  };
}
