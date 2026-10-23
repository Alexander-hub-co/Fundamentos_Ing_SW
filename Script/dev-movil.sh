#!/usr/bin/env bash
#
# Arranca el servidor de desarrollo accesible desde el celular.
#
# Hace tres cosas que `next dev` a secas no hace:
#
#   1. Escucha en todas las interfaces de red, no sólo en localhost. Sin esto
#      el teléfono no encuentra nada, aunque esté en el mismo wifi.
#   2. Averigua la dirección del computador en la red y la pone en APP_URL,
#      para que Better Auth no crea que responde en localhost. Sin esto la
#      página carga pero el inicio de sesión puede fallar de formas confusas.
#   3. Imprime la dirección exacta que hay que escribir en el teléfono.
#
# El computador y el celular tienen que estar en la MISMA red wifi.

set -euo pipefail

IP="$(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '^127\.' | head -1)"

if [ -z "$IP" ]; then
  echo "No se encontró una dirección de red. ¿El computador está conectado al wifi?" >&2
  exit 1
fi

echo
echo "  Abra esto en el celular, conectado al mismo wifi:"
echo
echo "      http://$IP:3000"
echo
echo "  En el computador sigue funcionando http://localhost:3000"
echo "  Para detenerlo: Control+C"
echo

APP_URL="http://$IP:3000" exec npx next dev -H 0.0.0.0
