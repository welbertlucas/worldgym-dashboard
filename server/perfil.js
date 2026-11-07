// Perfil dos alunos e das oportunidades: gênero, faixa etária e estado civil. Só contagens; nascimento e nome nunca são guardados.

/** Faixas de idade: até 17, 18–24, 25–34, 35–44, 45–54, 55–64, 65+ e sem data de nascimento. */
export const FAIXAS_IDADE = 8;
export const SEM_IDADE = 7;

/** 0 = feminino, 1 = masculino, 2 = não informado/outros. */
export function generoDe(g) {
  const t = String(g ?? "").trim().toLowerCase();
  if (["f", "female", "feminino"].includes(t)) return 0;
  if (["m", "male", "masculino"].includes(t)) return 1;
  return 2;
}

/** Índice da faixa de idade em `hoje` (AAAA-MM-DD). Datas vazias, futuras ou absurdas (>110 anos) caem em "sem data". */
export function faixaDeIdade(nascimento, hoje) {
  const n = String(nascimento ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n)) return SEM_IDADE;
  let anos = Number(hoje.slice(0, 4)) - Number(n.slice(0, 4));
  if (hoje.slice(5) < n.slice(5)) anos--;
  if (anos < 0 || anos > 110) return SEM_IDADE;
  return anos < 18 ? 0 : anos < 25 ? 1 : anos < 35 ? 2 : anos < 45 ? 3 : anos < 55 ? 4 : anos < 65 ? 5 : 6;
}

const titulo = (s) => { const t = String(s).trim().toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };

/** Perfil dos alunos já filtrados como ativos: { g: [fem, masc, outros], i: [8 faixas], c: { "Solteiro": n } }. */
export function perfilDosAlunos(membrosAtivos, hoje) {
  const g = [0, 0, 0], i = Array(FAIXAS_IDADE).fill(0), c = {};
  for (const m of membrosAtivos) {
    g[generoDe(m.gender)]++;
    i[faixaDeIdade(m.birthDate, hoje)]++;
    const e = String(m.maritalStatus ?? "").trim();
    if (e) c[titulo(e)] = (c[titulo(e)] ?? 0) + 1;
  }
  return { g, i, c };
}

/**
 * Perfil das oportunidades cadastradas no período [de, ate]: cada contagem é [cadastradas, convertidas no período].
 * `prospects` vêm de /api/v1/prospects (registerDate, conversionDate, gender, birthDate).
 */
export function perfilDasOportunidades(prospects, de, ate, hoje) {
  const g = [0, 1, 2].map(() => [0, 0]), i = Array.from({ length: FAIXAS_IDADE }, () => [0, 0]);
  for (const p of prospects) {
    const cad = String(p.registerDate ?? "").slice(0, 10);
    if (!cad || cad < de || cad > ate) continue;
    const conv = String(p.conversionDate ?? "").slice(0, 10);
    const k = conv && conv >= de && conv <= ate ? 1 : 0;
    const gi = generoDe(p.gender), ii = faixaDeIdade(p.birthDate, cad);
    g[gi][0]++; i[ii][0]++;
    if (k) { g[gi][1]++; i[ii][1]++; }
  }
  return { g, i };
}
