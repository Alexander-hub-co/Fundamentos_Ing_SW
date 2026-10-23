"""Genera diagrama-componentes.svg (UML 2: componentes, interfaces provistas y requeridas)."""
from pathlib import Path

AZUL, BORDE, NARANJA, BORDE_EXT = "#7CCBF2", "#1F3B57", "#F6C177", "#8A5A12"
W, H = 400, 170
partes = []


def icono(x, y):
    """Ícono UML de componente en la esquina superior derecha."""
    return (f'<rect x="{x}" y="{y}" width="18" height="14" fill="white" stroke="{BORDE}"/>'
            f'<rect x="{x-4}" y="{y+2}" width="8" height="4" fill="white" stroke="{BORDE}"/>'
            f'<rect x="{x-4}" y="{y+8}" width="8" height="4" fill="white" stroke="{BORDE}"/>')


def componente(x, y, nombre, hijos, color=AZUL, borde=BORDE, estereotipo="«component»", alto=H):
    s = [f'<rect x="{x}" y="{y}" width="{W}" height="{alto}" rx="4" fill="{color}" stroke="{borde}" stroke-width="1.6"/>',
         icono(x + W - 28, y + 8),
         f'<text x="{x+W/2}" y="{y+24}" class="est">{estereotipo}</text>',
         f'<text x="{x+W/2}" y="{y+44}" class="nom">{nombre}</text>']
    if hijos:
        n = len(hijos)
        ancho = (W - 20 - 10 * (n - 1)) / n
        for i, h in enumerate(hijos):
            hx = x + 10 + i * (ancho + 10)
            s.append(f'<rect x="{hx}" y="{y+70}" width="{ancho}" height="70" fill="#BFE6FA" stroke="{borde}"/>')
            s.append(icono(hx + ancho - 24, y + 76))
            s.append(f'<text x="{hx+ancho/2}" y="{y+100}" class="est">«component»</text>')
            s.append(f'<text x="{hx+ancho/2}" y="{y+120}" class="sub">{h}</text>')
    partes.append("".join(s))


def provista(x1, y1, cx, cy, nombre, dx=0, dy=-22):
    """Línea del proveedor hasta el círculo (lollipop)."""
    partes.append(f'<line x1="{x1}" y1="{y1}" x2="{cx}" y2="{cy}" stroke="{BORDE}" stroke-width="1.6"/>'
                  f'<circle cx="{cx}" cy="{cy}" r="11" fill="{AZUL}" stroke="{BORDE}" stroke-width="1.6"/>'
                  f'<text x="{cx+dx}" y="{cy+dy}" class="itf">{nombre}</text>')


def requerida(puntos, cx, cy, desde):
    """Polilínea del consumidor que termina en un semicírculo abrazando el círculo."""
    r = 19
    fin = {"arriba": (cx, cy - r), "abajo": (cx, cy + r), "izq": (cx - r, cy), "der": (cx + r, cy)}[desde]
    pts = " ".join(f"{a},{b}" for a, b in puntos + [fin])
    arco = {
        "arriba": f"M {cx-r} {cy} A {r} {r} 0 0 1 {cx+r} {cy}",
        "abajo": f"M {cx-r} {cy} A {r} {r} 0 0 0 {cx+r} {cy}",
        "izq": f"M {cx} {cy-r} A {r} {r} 0 0 0 {cx} {cy+r}",
        "der": f"M {cx} {cy-r} A {r} {r} 0 0 1 {cx} {cy+r}",
    }[desde]
    partes.append(f'<polyline points="{pts}" fill="none" stroke="{BORDE}" stroke-width="1.6"/>'
                  f'<path d="{arco}" fill="none" stroke="{BORDE}" stroke-width="1.6"/>')


def dependencia(puntos, etiqueta, lx, ly):
    pts = " ".join(f"{a},{b}" for a, b in puntos)
    partes.append(f'<polyline points="{pts}" fill="none" stroke="{BORDE_EXT}" stroke-width="1.6" '
                  f'stroke-dasharray="7 5" marker-end="url(#flecha)"/>'
                  f'<text x="{lx}" y="{ly}" class="dep">{etiqueta}</text>')


C1, C2, C3 = 60, 580, 1100
R1, R2, R3 = 110, 400, 700

# ---------------- Componentes internos ----------------
componente(C2, R1, "Interfaz de Taquilla", ["CampoPlaca", "PanelSalida", "Impresión"])
componente(C3, R1, "Interfaz de Configuración", ["FormularioTarifa", "ProbadorCálculo"])
componente(C1, R2, "Autenticación y Autorización", ["Sesión", "Permisos"])
componente(C2, R2, "Taquilla", ["ResolverPlaca", "RegistrarMovimiento", "Comprobante"])
componente(C3, R2, "Tarifas", ["DeclararTarifa", "TarifaVigente", "CalcularImporte"])
componente(C3, R3, "Cobro y Convenios", ["AplicarConvenios", "PolíticaRedondeo"])
componente(C2, 960, "Persistencia", ["ConÁmbito (RLS)", "Esquema Drizzle"])

# ---------------- Externos ----------------
componente(C1, R1, "Impresora térmica", [], NARANJA, BORDE_EXT, "«dispositivo externo»", 70)
componente(C1, R3, "Better Auth", [], NARANJA, BORDE_EXT, "«librería externa»", 70)
# PostgreSQL como cilindro
px, py = C2 + 80, 1230
partes.append(f'<path d="M {px} {py+18} L {px} {py+120} A 120 18 0 0 0 {px+240} {py+120} L {px+240} {py+18}" '
              f'fill="{NARANJA}" stroke="{BORDE_EXT}" stroke-width="1.6"/>'
              f'<ellipse cx="{px+120}" cy="{py+18}" rx="120" ry="18" fill="#F9D49E" stroke="{BORDE_EXT}" stroke-width="1.6"/>'
              f'<text x="{px+120}" y="{py+68}" class="est">«servicio externo»</text>'
              f'<text x="{px+120}" y="{py+90}" class="nom">PostgreSQL 16</text>')

# ---------------- Interfaces ----------------
# ITaquilla: la provee Taquilla, la requiere la Interfaz de Taquilla
provista(C2 + 200, R2, C2 + 200, 340, "ITaquilla", dx=70, dy=5)
requerida([(C2 + 200, R1 + H)], C2 + 200, 340, "arriba")
# IConfigTarifas: la provee Tarifas, la requiere la Interfaz de Configuración
provista(C3 + 200, R2, C3 + 200, 340, "IConfigTarifas", dx=88, dy=5)
requerida([(C3 + 200, R1 + H)], C3 + 200, 340, "arriba")
# IContexto: la provee Autenticación, la requiere Taquilla y Tarifas
provista(C1 + W, R2 + 85, 520, R2 + 85, "IContexto", dy=40)
requerida([(C2, R2 + 85)], 520, R2 + 85, "der")
requerida([(C3 + 60, R2), (C3 + 60, 375), (520, 375)], 520, R2 + 85, "arriba")
# ICalculoCobro: la provee Cobro y Convenios, la requiere Taquilla
provista(C3, R3 + 85, 1040, R3 + 85, "ICalculoCobro", dx=-70, dy=5)
requerida([(C2 + W, R2 + 130), (1040, R2 + 130)], 1040, R3 + 85, "arriba")
# ITarifaVigente: la provee Tarifas, la requiere Cobro y Convenios
provista(C3 + 300, R2 + H, C3 + 300, 635, "ITarifaVigente", dx=80, dy=5)
requerida([(C3 + 300, R3)], C3 + 300, 635, "abajo")
# IAmbito: la provee Persistencia, la requieren Taquilla, Cobro y Autenticación
provista(C2 + 200, 960, C2 + 200, 900, "IAmbito", dx=55, dy=30)
requerida([(C2 + 200, R2 + H)], C2 + 200, 900, "arriba")
requerida([(C3 + 200, R3 + H), (C3 + 200, 900)], C2 + 200, 900, "der")
requerida([(C1 + W, R2 + 150), (500, R2 + 150), (500, 900)], C2 + 200, 900, "izq")

# ---------------- Conexiones con externos ----------------
dependencia([(C2, R1 + 35), (C1 + W + 6, R1 + 35)], "spooler del SO", 520, R1 + 25)
partes.append(f'<text x="520" y="{R1 + 60}" class="dep">USB · Red</text><text x="520" y="{R1 + 76}" class="dep">Bluetooth</text>')
dependencia([(C1 + 200, R2 + H), (C1 + 200, R3 - 6)], "sesiones y contraseñas", C1 + 290, R2 + H + 70)
dependencia([(C2 + 200, 960 + H), (C2 + 200, 1224)], "SQL · TCP 5432", C2 + 270, 1205)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1580" height="1420" viewBox="0 0 1580 1420">
<defs><marker id="flecha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto">
<path d="M0,0 L10,5 L0,10" fill="none" stroke="{BORDE_EXT}" stroke-width="1.6"/></marker></defs>
<style>
text{{font-family:Arial,'Liberation Sans',sans-serif;text-anchor:middle;fill:#0E2235}}
.tit{{font-size:24px;font-weight:bold}} .est{{font-size:12px;font-style:italic}}
.nom{{font-size:16px;font-weight:bold}} .sub{{font-size:12px}} .itf{{font-size:13px;font-weight:bold}}
.dep{{font-size:12px;fill:#6B430A}} .ley{{font-size:13px;text-anchor:start}}
</style>
<rect width="100%" height="100%" fill="white"/>
<text x="790" y="50" class="tit">Diagrama de Componentes — Parquivo</text>
{"".join(partes)}
<g transform="translate(1100,1250)">
<rect x="0" y="0" width="420" height="120" fill="white" stroke="{BORDE}"/>
<circle cx="25" cy="28" r="10" fill="{AZUL}" stroke="{BORDE}" stroke-width="1.6"/>
<text x="50" y="33" class="ley">Interfaz provista (la ofrece el componente)</text>
<path d="M 33 52 A 14 14 0 0 0 33 80" fill="none" stroke="{BORDE}" stroke-width="1.6"/>
<line x1="8" y1="66" x2="19" y2="66" stroke="{BORDE}" stroke-width="1.6"/>
<text x="50" y="71" class="ley">Interfaz requerida (la necesita)</text>
<rect x="14" y="90" width="22" height="16" fill="{NARANJA}" stroke="{BORDE_EXT}"/>
<text x="50" y="103" class="ley">Servicio, librería o dispositivo externo</text>
</g>
</svg>'''
Path(__file__).with_name("diagrama-componentes.svg").write_text(svg, encoding="utf-8")
