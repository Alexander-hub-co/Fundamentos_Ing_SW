#!/usr/bin/env bash
# Comprueba la coherencia interna de la documentación del repositorio.
#
#   bash Script/verificar.sh
#
# Devuelve 0 si todo cuadra y 1 si encuentra al menos un problema.
# No necesita nada instalado más allá de bash, grep y find.

set -uo pipefail
cd "$(dirname "$0")/.."

fallos=0
aviso() { printf '  \033[31mFALLA\033[0m  %s\n' "$1"; fallos=$((fallos + 1)); }
bien()  { printf '  \033[32m  ok \033[0m  %s\n' "$1"; }

echo
echo "Comprobando la documentación de $(basename "$PWD")"
echo

# ---------------------------------------------------------------- enlaces
echo "Enlaces relativos"
rotos=0
while IFS= read -r archivo; do
  base=$(dirname "$archivo")
  while IFS= read -r destino; do
    [ -z "$destino" ] && continue
    case "$destino" in http*|\#*|mailto:*|../../wiki) continue ;; esac
    ruta="${destino%%#*}"
    # los enlaces de markdown pueden venir codificados (%20 por espacio)
    ruta=$(printf '%b' "${ruta//%/\\x}")
    [ -z "$ruta" ] && continue
    [ -e "$base/$ruta" ] || { aviso "$archivo apunta a $ruta, que no existe"; rotos=1; }
  done < <(grep -oE '\]\([^)]+\)' "$archivo" | sed 's/^](//; s/)$//')
done < <(find . -name '*.md' -not -path './.git/*')
[ "$rotos" -eq 0 ] && bien "todos los enlaces resuelven"

# ------------------------------------------------------- cuentas del SRS
echo
echo "Conteos del SRS"
fr=$(grep -c '^- \*\*FR-' Docs/SRS/SRS-simplificado.md)
citado=$(grep -oE '\| Requisitos funcionales \| [0-9]+ \|' Docs/Entrega-1/reporte-gerencial.md | tr -dc '0-9')
if [ "$fr" = "$citado" ]; then
  bien "$fr requisitos funcionales, y es lo que dice el reporte gerencial"
else
  aviso "el SRS tiene $fr requisitos y el reporte gerencial dice $citado"
fi

for modulo in 1 2 3 4 5; do
  encabezado=$(grep -oE "#### Requisitos funcionales \([0-9]+\)" Docs/SRS/SRS-simplificado.md | sed -n "${modulo}p" | tr -dc '0-9')
  real=$(awk -v m="### 3.$modulo M" 'index($0,m)==1{f=1;next} f&&/^### /{exit} f&&/^- \*\*FR-/{c++} END{print c+0}' Docs/SRS/SRS-simplificado.md)
  if [ "$encabezado" = "$real" ]; then
    bien "M$modulo declara $encabezado requisitos y tiene $real"
  else
    aviso "M$modulo declara $encabezado requisitos pero tiene $real"
  fi
done

# ------------------------------------------- numeración sin huecos por módulo
echo
echo "Numeración de requisitos"
for modulo in 1 2 3 4 5; do
  hueco=$(awk -v m="### 3.$modulo M" '
    index($0,m)==1 { f=1; next }
    f && /^### / { exit }
    f && /^- \*\*FR-[0-9]+\*\*/ {
      n = $0; sub(/^- \*\*FR-0*/, "", n); sub(/\*\*.*$/, "", n); n += 0
      esperado++
      if (n != esperado) { print n; exit }
    }
  ' Docs/SRS/SRS-simplificado.md)
  if [ -z "$hueco" ]; then bien "M$modulo numera de forma continua"
  else aviso "M$modulo salta en FR-$hueco"; fi
done

# ------------------------------------------------------------- marcadores
echo
echo "Marcadores sin completar"
patron='por definir|por completar|por estimar|pendiente de escribir|TBD|XXXX'
encontrados=0
while IFS= read -r l; do
  aviso "$l"
  encontrados=1
done < <(grep -rniE "$patron" --include='*.md' . 2>/dev/null)
[ "$encontrados" -eq 0 ] && bien "ningún documento tiene marcadores sin completar"

echo
if [ "$fallos" -eq 0 ]; then
  echo "Todo cuadra."
else
  echo "$fallos problema(s)."
fi
exit $(( fallos > 0 ))
