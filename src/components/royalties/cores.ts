// Cores do menu Royalties: taxa fixa em ardósia neutra e royalties em azul. O vermelho fica reservado para dívida e problema (saldo devedor, mês sem pagamento).
export const COR_FIXA = "hsl(222 14% 40%)";
export const COR_ROYALTIES = "hsl(215 75% 48%)";
export const corDaModalidade = (t: "fixa" | "royalties") => (t === "fixa" ? COR_FIXA : COR_ROYALTIES);

/** Uma cor para cada unidade de royalties nas linhas do gráfico (repete depois de seis). */
export const CORES_DE_UNIDADE = ["hsl(215 75% 48%)", "hsl(160 60% 36%)", "hsl(32 92% 45%)", "hsl(262 52% 50%)", "hsl(190 70% 38%)", "hsl(330 60% 48%)"];
export const corDaUnidade = (unidades: string[], u: string) => CORES_DE_UNIDADE[Math.max(0, unidades.indexOf(u)) % CORES_DE_UNIDADE.length];
