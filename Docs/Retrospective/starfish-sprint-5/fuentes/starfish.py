"""Dibuja el diagrama Starfish de la retrospectiva como SVG (luego se exporta a PNG)."""
import math, sys
from pathlib import Path

salida = Path(sys.argv[1])
CX, CY, R = 700, 640, 530
partes = [
    ("EMPEZAR A HACER", "#7CCBF2", [
        "Respetar el horario de los dailys", "Planear cada sección del proyecto",
        "Revisar el repositorio y corregir incoherencias", "Exigirnos más entre compañeros",
        "Trabajar sin esperar a que llegue una entrega", "Pensar en marketing y venta del producto"]),
    ("HACER MÁS", "#A8DDB5", [
        "Reuniones del equipo", "Documentación", "Diagramas", "Aprovechar mejor el tiempo",
        "Cuidar la presentación del GitHub"]),
    ("SEGUIR HACIENDO", "#F6E58D", ["La buena actitud del grupo"]),
    ("HACER MENOS", "#F6C177", ["Desorden y confusión en el GitHub", "Falta de seriedad con el proyecto"]),
    ("DEJAR DE HACER", "#F4A6A6", [
        "Procrastinar", "Perder tiempo en cosas innecesarias", "Buscar excusas en vez de soluciones",
        "Dejarle todo a un solo integrante", "Faltar a clase"]),
]

def p(ang, r):
    a = math.radians(ang - 90)
    return CX + r * math.cos(a), CY + r * math.sin(a)

svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1200" viewBox="0 0 1400 1200">',
       '<style>text{font-family:Arial,"Liberation Sans",sans-serif;fill:#0E2235}'
       '.t{font-size:22px;font-weight:bold;text-anchor:middle}.i{font-size:15.5px;text-anchor:middle}'
       '.h{font-size:30px;font-weight:bold;text-anchor:middle}.s{font-size:16px;text-anchor:middle;fill:#334}</style>',
       '<rect width="100%" height="100%" fill="white"/>',
       '<text x="700" y="52" class="h">Retrospectiva Starfish — Sprint 5</text>',
       '<text x="700" y="80" class="s">Parquivo · 22 de octubre de 2026 · aportes del equipo agrupados por idea</text>']
n = len(partes)
for k, (titulo, color, items) in enumerate(partes):
    a0, a1 = k * 360 / n, (k + 1) * 360 / n
    x0, y0 = p(a0, R); x1, y1 = p(a1, R)
    svg.append(f'<path d="M {CX} {CY} L {x0:.1f} {y0:.1f} A {R} {R} 0 0 1 {x1:.1f} {y1:.1f} Z" '
               f'fill="{color}" stroke="#1F3B57" stroke-width="2"/>')
    am = (a0 + a1) / 2
    tx, ty = p(am, R * 0.9)
    ty += 8
    svg.append(f'<text x="{tx:.1f}" y="{ty:.1f}" class="t">{titulo}</text>')
    r0 = R * 0.55
    for j, it in enumerate(items):
        ix, iy = p(am, r0 - j * 0)  # columna centrada en el sector
        yy = iy - (len(items) - 1) * 12 + j * 24
        svg.append(f'<text x="{ix:.1f}" y="{yy:.1f}" class="i">• {it}</text>')
svg.append(f'<circle cx="{CX}" cy="{CY}" r="70" fill="white" stroke="#1F3B57" stroke-width="2"/>'
           f'<text x="{CX}" y="{CY-4}" class="t">Equipo</text><text x="{CX}" y="{CY+20}" class="s">Parquivo</text>')
svg.append('</svg>')
salida.write_text("\n".join(svg), encoding="utf-8")
