// Cores do menu Royalties: taxa fixa em ardósia neutra e royalties no vermelho da marca (a mesma regra dos outros gráficos do Atlas).
export const COR_FIXA = "hsl(222 14% 40%)";
export const COR_ROYALTIES = "hsl(4 90% 50%)";
export const corDaModalidade = (t: "fixa" | "royalties") => (t === "fixa" ? COR_FIXA : COR_ROYALTIES);
