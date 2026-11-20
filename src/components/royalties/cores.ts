// Cores do menu Royalties: taxa fixa em ardósia neutra e royalties no vermelho da marca (a mesma regra dos outros gráficos do Atlas).
export const COR_FIXA = "hsl(222 14% 40%)";
export const COR_ROYALTIES = "hsl(4 90% 50%)";
export const corDaModalidade = (t: "fixa" | "royalties") => (t === "fixa" ? COR_FIXA : COR_ROYALTIES);

/** Uma cor para cada unidade de royalties nas linhas do gráfico (repete depois de seis). */
export const CORES_DE_UNIDADE = ["hsl(4 90% 50%)", "hsl(222 14% 40%)", "hsl(32 92% 45%)", "hsl(160 60% 36%)", "hsl(262 52% 50%)", "hsl(200 70% 42%)"];
export const corDaUnidade = (unidades: string[], u: string) => CORES_DE_UNIDADE[Math.max(0, unidades.indexOf(u)) % CORES_DE_UNIDADE.length];
