// Limiares das regras de alerta — ponto de partida calibrado com set/2026 (23 unidades).
// Ajuste aqui; nenhuma outra parte do código tem número de limiar.
export const ALERT_CONFIG = {
  // Mínimo de meses fechados de histórico da unidade para avaliar variações.
  minHistoryMonths: 3,
  faturamento: {
    attentionPct: -7,
    criticalPct: -12,
    // Queda abaixo de (média - z * desvio) das variações mensais da própria unidade (6 meses).
    zScore: 1.5,
    zMinSamples: 4,
    // A regra estatística só vale para quedas de pelo menos este tamanho (evita alertar -2%).
    zMinDropPct: -3,
  },
  vendasOnline: {
    // Compara com a média dos 3 meses anteriores (a série é muito instável mês a mês).
    dropPct: -30,
    baselineMonths: 3,
    minBaseline: 500,
  },
  churn: { deltaPp: 1.5, criticalLevel: 8 },
  inadimplencia: { deltaPp: 1.5, criticalLevel: 8 },
  recebimento: { minRatio: 0.9 },
  // Abaixo do nível mais baixo cadastrado (em geral o bronze) = atenção; crítico se tiver menos de criticalPct dele.
  meta: { criticalPct: 75 },
  // Comparativo com o MESMO mês do ano anterior. A unidade precisa ter pelo menos
  // `minHistoryBeforeBase` meses de dados antes do mês-base (evita comparar com unidade em ramp-up).
  yoy: {
    minHistoryBeforeBase: 3,
    faturamento: { attentionPct: -10, criticalPct: -20 },
    churn: { deltaPp: 2 },
    inadimplencia: { deltaPp: 2 },
    renovacoes: { dropPp: -8 },
    // Novos contratos e vendas online caíram em quase toda a rede vs. 2025, então o alerta da rede
    // vem primeiro e a unidade só alerta se for pior que a rede (comparáveis) por `belowNetworkPp`.
    volume: { networkAttentionPct: -20, networkCriticalPct: -35, unitMinDropPct: -20, belowNetworkPp: 20, minBaseVendasOnline: 500 },
  },
} as const;
