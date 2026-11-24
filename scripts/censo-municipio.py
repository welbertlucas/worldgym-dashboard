#!/usr/bin/env python3
"""
Malha do Censo 2022 de UM município para os Estudos de ponto (hexágonos de 200 m, os mesmos campos da malha v6 de estudos/censo.json).

Só dados públicos do IBGE (ftp.ibge.gov.br, Censo 2022): geometria dos setores (GeoPackage da UF) e as tabelas por setor
(básico, demografia, características do domicílio parte 1 e renda do responsável). Só a biblioteca padrão do Python.
Roda no computador de quem gera (nunca em função serverless); a gravação no Blob é outro script (censo-municipio-gravar.mjs).

Uso:
  python3 -I scripts/censo-municipio.py --gpkg GO_setores_CD2022.gpkg --pasta ibge --mun 5211909 --saida jatai.json [--comercio]
  (--pasta tem as subpastas basico/, demografia/, dom1/ e renda/ com os CSVs descompactados)

Método (o mesmo da malha v6):
  - reticulado: hexágonos "pointy-top" de raio 0,2 km, ancorados em (-15,8; -47,9), com 110,6 km por grau de latitude e 107,1141 km por grau
    de longitude (assim as malhas de municípios diferentes encaixam na malha atual);
  - cada setor reparte seus totais igualmente entre os hexágonos cujo centro cai dentro dele; setor menor que um hexágono, ou rural e
    esparso, vai inteiro para o hexágono do centro dele (os moradores se conservam);
  - classes de renda e gasto com esportes: lognormal por setor, com a média (V06004) e a variância (V06005) do rendimento do responsável,
    multiplicada pelo fator domicílio/responsável do estado; classes em salários mínimos de 2022 (R$ 1.212) e gasto pela POF 2017-2018
    corrigida pelo IPCA (x1,56).
"""
import argparse, csv, glob, json, math, sqlite3, struct, sys, time, urllib.request, urllib.parse

RK, LAT0, LNG0, KLAT, KLNG = 0.2, -15.8, -47.9, 110.6, 107.1141
S3 = math.sqrt(3)
SM_CENSO = 1212
FATOR_DOMICILIO = {"GO": 1.457, "DF": 1.49, "BA": 1.548}  # relação renda do domicílio / renda do responsável, por estado
CLASSES_SM = [15, 10, 5, 2, 1]  # AA acima de 15 SM, A 10-15, B 5-10, C 2-5, D 1-2, E até 1
POF = [(2, 3.94), (3, 6.43), (6, 14.41), (10, 34.11), (15, 49.75), (25, 87.96), (math.inf, 155.75)]  # gasto/mês com recreação e esportes (R$ 2018)
CORRECAO_POF = 1.56
LIM_ESPARSO = 3  # menos que isso de moradores por hexágono: o setor vira um ponto só
csv.field_size_limit(10**9)


def num(s):
    s = (s or "").strip()
    if s in ("", ".", "X", "-"):
        return None
    try:
        return float(s.replace(",", "."))
    except ValueError:
        return None


def ler_csv(pasta, prefixo_mun, chave):
    """Linhas do CSV (por código de setor) só do município."""
    arq = glob.glob(f"{pasta}/*.csv")[0]
    out = {}
    with open(arq, encoding="latin-1", newline="") as f:
        r = csv.reader(f, delimiter=";")
        cab = next(r)
        i = next(k for k, c in enumerate(cab) if c.lower() == chave.lower())
        for lin in r:
            cod = lin[i].strip().upper()
            if cod.startswith(prefixo_mun):
                out[cod] = dict(zip((c.upper() for c in cab), lin))
    return out


def poligonos(blob):
    """Geometria do GeoPackage (cabeçalho + WKB de Polygon/MultiPolygon) -> lista de polígonos; cada um, lista de anéis [(x, y)]."""
    flags = blob[3]
    env = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(flags >> 1) & 7]
    wkb = memoryview(blob)[8 + env:]

    def le(o):  # lê uma geometria a partir do deslocamento o; devolve (polígonos, novo o)
        ordem = "<" if wkb[o] == 1 else ">"
        tipo = struct.unpack_from(ordem + "I", wkb, o + 1)[0] % 1000
        o += 5
        if tipo == 3:
            n = struct.unpack_from(ordem + "I", wkb, o)[0]; o += 4
            aneis = []
            for _ in range(n):
                m = struct.unpack_from(ordem + "I", wkb, o)[0]; o += 4
                pts = struct.unpack_from(ordem + f"{2 * m}d", wkb, o); o += 16 * m
                aneis.append(list(zip(pts[0::2], pts[1::2])))
            return [aneis], o
        if tipo == 6:
            n = struct.unpack_from(ordem + "I", wkb, o)[0]; o += 4
            todos = []
            for _ in range(n):
                p, o = le(o)
                todos += p
            return todos, o
        raise ValueError(f"geometria {tipo} não prevista")
    return le(0)[0]


def para_km(pol):
    return [[((lng - LNG0) * KLNG, (lat - LAT0) * KLAT) for lng, lat in anel] for anel in pol]


def hexagonos_dentro(polis):
    """(linha, coluna) dos hexágonos cujo centro cai dentro dos polígonos (varredura por linha, buracos pelo par-ímpar)."""
    out = set()
    for aneis in polis:
        ys = [y for a in aneis for _, y in a]
        r0, r1 = math.ceil(min(ys) / (1.5 * RK)), math.floor(max(ys) / (1.5 * RK))
        for r in range(r0, r1 + 1):
            y = r * 1.5 * RK
            xs = []
            for a in aneis:
                for k in range(len(a) - 1):
                    (x1, y1), (x2, y2) = a[k], a[k + 1]
                    if (y1 <= y < y2) or (y2 <= y < y1):
                        xs.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
            xs.sort()
            off = S3 * RK / 2 if (r & 1) else 0.0
            for j in range(0, len(xs) - 1, 2):
                c0, c1 = math.ceil((xs[j] - off) / (S3 * RK)), math.floor((xs[j + 1] - off) / (S3 * RK))
                for c in range(c0, c1 + 1):
                    out.add((r, c))
    return out


def vertices_hexagono(r, c):
    off = S3 * RK / 2 if (r & 1) else 0.0
    cx, cy = c * S3 * RK + off, r * 1.5 * RK
    return [(cx + RK * math.cos(math.radians(30 + 60 * k)), cy + RK * math.sin(math.radians(30 + 60 * k))) for k in range(6)]


def recorta(poligono, clip):
    """Sutherland-Hodgman: recorta `poligono` (qualquer) por `clip` (convexo, anti-horário)."""
    saida = poligono
    for k in range(len(clip)):
        (ax, ay), (bx, by) = clip[k], clip[(k + 1) % len(clip)]
        entrada, saida = saida, []
        if not entrada:
            break
        def dentro(p):
            return (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax) >= 0
        def cruza(p, q):
            x1, y1, x2, y2 = p[0], p[1], q[0], q[1]
            den = (x1 - x2) * (ay - by) - (y1 - y2) * (ax - bx)
            t = ((x1 - ax) * (ay - by) - (y1 - ay) * (ax - bx)) / den
            return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))
        for i in range(len(entrada)):
            p, q = entrada[i], entrada[(i + 1) % len(entrada)]
            if dentro(q):
                if not dentro(p):
                    saida.append(cruza(p, q))
                saida.append(q)
            elif dentro(p):
                saida.append(cruza(p, q))
    return saida


def area_anel(a):
    return abs(sum(a[k][0] * a[(k + 1) % len(a)][1] - a[(k + 1) % len(a)][0] * a[k][1] for k in range(len(a)))) / 2


def pesos_por_area(polis):
    """{(linha, coluna): parte do setor} pela área de sobreposição do hexágono com o setor (buracos descontados); soma 1."""
    pesos = {}
    for aneis in polis:
        fechado = [a[:-1] if a[0] == a[-1] else a for a in aneis]
        xs = [x for a in fechado for x, _ in a]; ys = [y for a in fechado for _, y in a]
        r0, r1 = math.floor((min(ys) - RK) / (1.5 * RK)), math.ceil((max(ys) + RK) / (1.5 * RK))
        for r in range(r0, r1 + 1):
            off = S3 * RK / 2 if (r & 1) else 0.0
            c0, c1 = math.floor((min(xs) - RK - off) / (S3 * RK)), math.ceil((max(xs) + RK - off) / (S3 * RK))
            for c in range(c0, c1 + 1):
                hv = vertices_hexagono(r, c)
                # antihorário garantido: a ordem dos ângulos já é crescente
                area = area_anel(recorta(fechado[0], hv)) - sum(area_anel(recorta(b, hv)) for b in fechado[1:])
                if area > 1e-9:
                    pesos[(r, c)] = pesos.get((r, c), 0.0) + area
    tot = sum(pesos.values())
    return {h: v / tot for h, v in pesos.items()} if tot > 0 else {}


def hexagono_de(x, y):
    """Hexágono (linha, coluna) cujo centro está mais perto do ponto (x, y) em km."""
    r0 = round(y / (1.5 * RK))
    melhor = None
    for r in (r0 - 1, r0, r0 + 1):
        off = S3 * RK / 2 if (r & 1) else 0.0
        c = round((x - off) / (S3 * RK))
        for cc in (c - 1, c, c + 1):
            d = (x - (cc * S3 * RK + off)) ** 2 + (y - r * 1.5 * RK) ** 2
            if melhor is None or d < melhor[0]:
                melhor = (d, r, cc)
    return melhor[1], melhor[2]


def centroide(aneis):
    a = aneis[0]
    area = cx = cy = 0.0
    for k in range(len(a) - 1):
        (x1, y1), (x2, y2) = a[k], a[k + 1]
        t = x1 * y2 - x2 * y1
        area += t; cx += (x1 + x2) * t; cy += (y1 + y2) * t
    if abs(area) < 1e-12:
        xs, ys = [p[0] for p in a], [p[1] for p in a]
        return sum(xs) / len(xs), sum(ys) / len(ys)
    return cx / (3 * area), cy / (3 * area)


def phi(z):
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def distribuicao(media, variancia, fator):
    """Lognormal da renda do domicílio (renda do responsável x fator). Devolve cdf(valor em R$)."""
    m = media * fator
    s2 = math.log(1 + (variancia * fator * fator) / (m * m)) if variancia and variancia > 0 else 0.0
    sigma = math.sqrt(s2)
    mu = math.log(m) - s2 / 2
    if sigma < 1e-6:
        return lambda t: 1.0 if t > m else 0.0
    return lambda t: phi((math.log(t) - mu) / sigma)


def classes_e_gasto(media, variancia, fator):
    """([AA, A, B, C, D, E] como proporção dos domicílios, gasto médio mensal por domicílio com recreação e esportes)."""
    cdf = distribuicao(media, variancia, fator)
    cortes = [cdf(sm * SM_CENSO) for sm in CLASSES_SM]  # P(renda <= 15 SM), <=10, <=5, <=2, <=1
    prop = [1 - cortes[0], cortes[0] - cortes[1], cortes[1] - cortes[2], cortes[2] - cortes[3], cortes[3] - cortes[4], cortes[4]]
    gasto, ant = 0.0, 0.0
    for ate, g in POF:
        acum = 1.0 if ate == math.inf else cdf(ate * SM_CENSO)
        gasto += (acum - ant) * g * CORRECAO_POF
        ant = acum
    return prop, gasto


AMENIDADES = "restaurant|fast_food|cafe|bar|pub|pharmacy|bank|atm|school|kindergarten|college|university|clinic|doctors|dentist|hospital|marketplace|veterinary|fuel|car_wash|post_office|cinema|theatre|ice_cream|food_court"


def overpass(consulta):
    """Uma consulta ao Overpass (OpenStreetMap), com nova tentativa quando o servidor público está sobrecarregado (502, 504, 429)."""
    for tentativa in range(6):
        try:
            req = urllib.request.Request("https://overpass-api.de/api/interpreter", data=urllib.parse.urlencode({"data": consulta}).encode(),
                                         headers={"User-Agent": "atlas-censo/1.0", "Accept": "*/*"})
            dados = json.load(urllib.request.urlopen(req, timeout=120))
            # servidor sobrecarregado responde 200 com o aviso no campo "remark" e nenhum dado: conta como falha
            if "runtime error" in (dados.get("remark") or "") or "timeout" in (dados.get("remark") or "").lower():
                raise RuntimeError(dados["remark"][:60])
            return dados
        except Exception as ex:  # noqa: BLE001
            print(f"  Overpass falhou ({str(ex)[:40]}), tentativa {tentativa + 1} de 6", file=sys.stderr, flush=True)
            time.sleep(8 * (tentativa + 1))
    return None


def comercio_osm(celulas_por_hex):
    """
    Pontos de comércio e serviços do OpenStreetMap por hexágono: lojas (shop), escritórios (office) e as amenidades de AMENIDADES.
    Conferido em 24/11/2026 contra a malha v6 de Goiânia: 91% das células iguais, soma 2% acima (diferenças de edição do OSM).
    A busca é por quadros de 0,1 grau, só os de cidade (a caixa do município inclui toda a zona rural, sem comércio).
    """
    passo = 0.1
    quadros = {}
    for (r, c), v in celulas_por_hex.items():
        # só as áreas de cidade (4 hexágonos povoados no quadro): a zona rural tem um hexágono isolado por setor e quase nenhum comércio
        if v["mor"] >= 40:
            lat = LAT0 + (r * 1.5 * RK) / KLAT
            lng = LNG0 + (c * S3 * RK + (S3 * RK / 2 if (r & 1) else 0.0)) / KLNG
            k = (math.floor(lat / passo), math.floor(lng / passo))
            quadros[k] = quadros.get(k, 0) + 1
    quadros = {k: 1 for k, n in quadros.items() if n >= 4}
    vistos, cont = set(), {}
    for i, (qa, qo) in enumerate(sorted(quadros), 1):
        s, w = qa * passo, qo * passo
        n, e = s + passo, w + passo
        q = (f'[out:json][timeout:120];(nwr["shop"]({s},{w},{n},{e});nwr["office"]({s},{w},{n},{e});'
             f'nwr["amenity"~"^({AMENIDADES})$"]({s},{w},{n},{e}););out center;')
        dados = overpass(q)
        print(f"  quadro {i}/{len(quadros)}: {'falhou' if dados is None else len(dados.get('elements', []))}", file=sys.stderr, flush=True)
        if dados is None:
            return None
        for el in dados.get("elements", []):
            ident = (el.get("type"), el.get("id"))
            if ident in vistos:
                continue
            vistos.add(ident)
            lat = el.get("lat", (el.get("center") or {}).get("lat")); lng = el.get("lon", (el.get("center") or {}).get("lon"))
            if lat is None or lng is None:
                continue
            h = hexagono_de((lng - LNG0) * KLNG, (lat - LAT0) * KLAT)
            if h in celulas_por_hex:
                cont[h] = cont.get(h, 0) + 1
    return cont


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gpkg", required=True); ap.add_argument("--pasta", required=True); ap.add_argument("--mun", required=True)
    ap.add_argument("--saida", required=True); ap.add_argument("--comercio", action="store_true")
    ap.add_argument("--alocacao", choices=["area", "centro"], default="area")
    ap.add_argument("--moradores-de", choices=["demografia", "basico"], default="demografia")
    ap.add_argument("--domicilios-de", choices=["dppo", "ocupados"], default="dppo")
    a = ap.parse_args()
    mun = a.mun.strip()

    con = sqlite3.connect(f"file:{a.gpkg}?mode=ro", uri=True)
    tab = con.execute("select table_name from gpkg_contents").fetchone()[0]
    linhas = con.execute(f'select CD_SETOR, NM_MUN, NM_UF, CD_SIT, AREA_KM2, geom from "{tab}" where CD_MUN = ?', (mun,)).fetchall()
    if not linhas:
        sys.exit(f"Município {mun} não está nesse GeoPackage.")
    uf = {"Goiás": "GO", "Distrito Federal": "DF", "Bahia": "BA"}.get(linhas[0][2])
    if uf not in FATOR_DOMICILIO:
        sys.exit(f"O fator domicílio/responsável de {linhas[0][2]} ainda não foi cadastrado (só GO, DF e BA): peça ao dono antes de gerar.")
    fator = FATOR_DOMICILIO[uf]
    print(f"{linhas[0][1]}/{uf}: {len(linhas)} setores; fator {fator}")

    bas = ler_csv(f"{a.pasta}/basico", mun, "CD_SETOR")
    dem = ler_csv(f"{a.pasta}/demografia", mun, "CD_setor")
    dom = ler_csv(f"{a.pasta}/dom1", mun, "setor")
    ren = ler_csv(f"{a.pasta}/renda", mun, "CD_SETOR")

    # renda média e variância do município (para setores sem dado de renda)
    pesos = [(num(r.get("V06001")), num(r.get("V06004")), num(r.get("V06005"))) for r in ren.values()]
    pesos = [(w, m, v) for w, m, v in pesos if w and m and m > 0 and v is not None]
    m_mun = sum(w * m for w, m, _ in pesos) / sum(w for w, _, _ in pesos)
    v_mun = sum(w * v for w, _, v in pesos) / sum(w for w, _, _ in pesos)

    acc = {}  # (linha, coluna) -> acumuladores
    total_mor = total_dom = 0.0
    sem_renda = 0
    for cod, _nm, _uf, cd_sit, area_km2, geom in linhas:
        cod = cod.strip().upper()
        b, d, k, r = bas.get(cod), dem.get(cod), dom.get(cod), ren.get(cod)
        if not (b and d and k):
            continue
        mor = num(d.get("V01006")) if a.moradores_de == "demografia" else num(b.get("V0001"))
        doms = num(k.get("V00001")) if a.domicilios_de == "dppo" else num(b.get("V0007"))
        if not mor or not doms:
            continue
        g = lambda c: num(d.get(c)) or 0.0  # noqa: E731
        idade = [g("V01031") + g("V01032"), g("V01033") + g("V01034"), g("V01035") + g("V01036"), g("V01037"), g("V01038"), g("V01039"), g("V01040") + g("V01041")]
        h = lambda c: num(k.get(c)) or 0.0  # noqa: E731
        tam = [h("V00017"), h("V00018"), h("V00019"), h("V00020")]
        tam.append(max(0.0, (num(k.get("V00001")) or 0.0) - sum(tam)))
        m_resp, v_resp = (num(r.get("V06004")) if r else None), (num(r.get("V06005")) if r else None)
        if not m_resp or m_resp <= 0:
            m_resp, v_resp = m_mun, v_mun
            sem_renda += 1
        prop, gasto_dom = classes_e_gasto(m_resp, v_resp, fator)
        # hexágonos do setor
        polis = [para_km(p) for p in poligonos(geom)]
        esparso = (area_km2 or 0) > 0 and mor / max(1.0, (area_km2 / (2 * S3 * RK * RK))) < LIM_ESPARSO
        if esparso:
            peso = {}
        elif a.alocacao == "area":
            peso = pesos_por_area(polis)
        else:
            hs = hexagonos_dentro(polis)
            peso = {h: 1.0 / len(hs) for h in hs}
        if not peso:
            cx, cy = centroide(max(polis, key=lambda p: len(p[0])))
            peso = {hexagono_de(cx, cy): 1.0}
        for hx, w in peso.items():
            n = 1.0 / w
            c = acc.setdefault(hx, {"mor": 0.0, "dom": 0.0, "ida": [0.0] * 7, "tam": [0.0] * 5, "cls": [0.0] * 6, "rr": 0.0, "rd": 0.0, "gas": 0.0})
            c["mor"] += mor / n; c["dom"] += doms / n
            for i in range(7): c["ida"][i] += idade[i] / n
            for i in range(5): c["tam"][i] += tam[i] / n
            for i in range(6): c["cls"][i] += doms * prop[i] / n
            c["rr"] += (doms / n) * m_resp; c["rd"] += (doms / n) * m_resp * fator; c["gas"] += (doms / n) * gasto_dom
        total_mor += mor; total_dom += doms

    celulas_hex = {hx: c for hx, c in acc.items() if round(c["mor"]) >= 1}
    com = None
    if a.comercio and celulas_hex:
        com = comercio_osm(celulas_hex)
        print("comércio OSM:", "indisponível (o campo fica fora)" if com is None else f"{sum(com.values())} pontos")
    saida = []
    for (r, c), v in sorted(celulas_hex.items()):
        off = S3 * RK / 2 if (r & 1) else 0.0
        lat = LAT0 + (r * 1.5 * RK) / KLAT
        lng = LNG0 + (c * S3 * RK + off) / KLNG
        doms = v["dom"] or 1.0
        cel = [round(lat, 4), round(lng, 4), round(v["mor"]), round(v["rr"] / doms), round(v["dom"]), [round(x) for x in v["ida"]], [round(x) for x in v["tam"]],
               [round(x, 1) for x in v["cls"]], round(v["rd"] / doms), round(v["gas"])]
        if com is not None:
            cel.append(com.get((r, c), 0))
        saida.append(cel)
    meta = {"rk": RK, "lat0": LAT0, "lng0": LNG0, "kLat": KLAT, "kLng": KLNG, "versao": 6,
            "municipio": {"cod": mun, "nome": linhas[0][1], "uf": uf}, "celulas": saida}
    with open(a.saida, "w") as f:
        json.dump(meta, f, separators=(",", ":"), ensure_ascii=False)
    lat_min, lat_max = min(c[0] for c in saida), max(c[0] for c in saida)
    lng_min, lng_max = min(c[1] for c in saida), max(c[1] for c in saida)
    print(f"{len(saida)} hexágonos | moradores {round(total_mor)} (na malha {sum(c[2] for c in saida)}) | domicílios {round(total_dom)} | setores sem renda: {sem_renda}")
    print(f"caixa: lat {lat_min:.3f} a {lat_max:.3f}, lng {lng_min:.3f} a {lng_max:.3f}")


if __name__ == "__main__":
    main()
