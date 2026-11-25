#!/usr/bin/env python3
# Tabela CEP -> posição de um estado, a partir do CNEFE 2022 do IBGE (dado público): a posição de cada CEP é a MEDIANA das coordenadas dos endereços
# daquele CEP (só os de boa qualidade: NV_GEO_COORD 1 = original do Censo, 2 = modificada e 4 = face de quadra), e `p90` é o raio, em km, que cobre 90% dos
# endereços do CEP (CEP rural ou de estrada longa tem p90 grande: a posição vale menos). Usada para pôr os alunos no mapa pelo CEP, sem guardar CEP de aluno.
#
# Uso: python3 -I scripts/cep-posicoes.py --uf DF --fonte 53_DF.zip --saida cep_DF.json
#   --fonte aceita o .zip do IBGE (ftp.ibge.gov.br/Cadastro_Nacional_de_Enderecos_para_Fins_Estatisticos/Censo_Demografico_2022/Arquivos_CNEFE/CSV/UF/<cod>_<UF>.zip)
#   ou o .csv já descompactado. Só biblioteca padrão.
import argparse, collections, csv, io, json, math, statistics, sys, zipfile
from datetime import date

NIVEIS_BONS = ("1", "2", "4")

def abrir(fonte):
    """Devolve um iterador de linhas de texto do CSV (de dentro do zip, quando for zip)."""
    if fonte.lower().endswith(".zip"):
        zf = zipfile.ZipFile(fonte)
        nome = next(n for n in zf.namelist() if n.lower().endswith(".csv"))
        return io.TextIOWrapper(zf.open(nome), encoding="utf-8", errors="replace", newline="")
    return open(fonte, encoding="utf-8", errors="replace", newline="")

def km(a, b):
    return math.hypot((a[0] - b[0]) * 110.6, (a[1] - b[1]) * 111.32 * math.cos(math.radians(a[0])))

def montar(linhas):
    por_cep = collections.defaultdict(list)
    total = sem_cep = sem_coord = 0
    niveis = collections.Counter()
    for r in csv.DictReader(linhas, delimiter=";"):
        total += 1
        niveis[r.get("NV_GEO_COORD", "")] += 1
        cep = (r.get("CEP") or "").strip()
        if len(cep) != 8 or not cep.isdigit() or cep == "00000000":
            sem_cep += 1
            continue
        if r.get("NV_GEO_COORD") not in NIVEIS_BONS:
            continue
        try:
            la, ln = float(r["LATITUDE"]), float(r["LONGITUDE"])
        except (ValueError, KeyError):
            sem_coord += 1
            continue
        por_cep[cep].append((la, ln))
    ceps = {}
    for cep, pts in por_cep.items():
        c = (statistics.median(p[0] for p in pts), statistics.median(p[1] for p in pts))
        d = sorted(km(c, p) for p in pts)
        p90 = d[min(len(d) - 1, int(len(d) * 0.9))]
        ceps[cep] = [round(c[0], 5), round(c[1], 5), len(pts), round(p90, 2)]
    return ceps, {"enderecos": total, "semCep": sem_cep, "semCoordenada": sem_coord, "niveis": dict(niveis)}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--uf", required=True)
    ap.add_argument("--fonte", required=True)
    ap.add_argument("--saida", required=True)
    a = ap.parse_args()
    uf = a.uf.upper()
    if len(uf) != 2 or not uf.isalpha():
        sys.exit("Informe a sigla do estado (2 letras).")
    ceps, resumo = montar(abrir(a.fonte))
    if not ceps:
        sys.exit("Nenhum CEP com posição: confira o arquivo (precisa das colunas CEP, LATITUDE, LONGITUDE e NV_GEO_COORD).")
    espalhos = sorted(v[3] for v in ceps.values())
    q = lambda p: espalhos[min(len(espalhos) - 1, int(len(espalhos) * p))]
    saida = {"uf": uf, "fonte": "IBGE, CNEFE 2022", "versao": 1, "gerado": date.today().isoformat(), "resumo": resumo, "ceps": ceps}
    json.dump(saida, open(a.saida, "w"), separators=(",", ":"))
    print(f"{uf}: {resumo['enderecos']:,} endereços, {len(ceps):,} CEPs com posição; espalhamento do CEP (90% dos endereços): mediana {q(0.5):.2f} km, p90 {q(0.9):.2f} km, p99 {q(0.99):.2f} km")

if __name__ == "__main__":
    main()
