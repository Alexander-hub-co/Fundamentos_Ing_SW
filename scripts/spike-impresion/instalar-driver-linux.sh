#!/usr/bin/env bash
#
# Instala un driver ESC/POS para la térmica, EN LINUX.
#
# Sólo hace falta en la máquina de desarrollo. Las casetas usan Windows, donde
# el fabricante entrega el driver y el equipo ve la impresora como una normal;
# en Linux estas térmicas genéricas no traen ninguno, y de los ~17.000 modelos
# que ofrece CUPS ninguno es ESC/POS. Eso fue lo que hizo fracasar el primer
# ensayo: la cola existía apuntando a un PPD de plóter HP DesignJet y CUPS le
# mandaba páginas A4 en lenguaje de plóter a una térmica, que las escupía como
# texto sin sentido.
#
# Usa zj-58, que es el driver habitual para las POS-58/POS-80 genéricas.
#
#   bash scripts/spike-impresion/instalar-driver-linux.sh
#
# Pide la contraseña dos veces: para instalar dependencias y para copiar el
# driver a los directorios de CUPS.

set -euo pipefail

NOMBRE="${1:-Termica58}"
TRABAJO="$(mktemp -d)"

echo "==> 1/5  Dependencias para compilar"
sudo apt-get update -qq
sudo apt-get install -y cmake make gcc libcups2-dev libcupsimage2-dev git

echo "==> 2/5  Descargando zj-58"
git clone --depth 1 https://github.com/klirichek/zj-58 "$TRABAJO/zj-58"

echo "==> 3/5  Compilando"
cd "$TRABAJO/zj-58"
cmake .
make

echo "==> 4/5  Instalando el filtro y el PPD"
sudo make install

echo "==> 5/5  Creando la cola «$NOMBRE»"
# El dispositivo se detecta en vez de escribirse a mano: el número de serie
# cambia entre impresoras y una URI copiada de otra máquina no sirve.
URI="$(lpinfo -v 2>/dev/null | awk '/usb:/ {print $2}' | head -1)"
if [ -z "$URI" ]; then
  echo "No se encontró ninguna impresora USB. ¿Está conectada y encendida?" >&2
  exit 1
fi
echo "    dispositivo: $URI"

# -E la habilita; sin eso la cola nace parada.
sudo lpadmin -p "$NOMBRE" -E -v "$URI" -P /usr/share/cups/model/zjiang/ZJ-58.ppd

# Que un fallo puntual no vuelva a dejar la cola deshabilitada, que es lo que
# venía pasando cada vez que se desconectaba la impresora.
sudo lpadmin -p "$NOMBRE" -o printer-error-policy=retry-job

# EL PASO QUE MÁS SE OLVIDA: el modo silencioso del navegador imprime a la
# PREDETERMINADA. Sin una fijada, Chrome hace lo que puede.
lpoptions -d "$NOMBRE"

echo
echo "Listo. Comprobación:"
lpstat -p "$NOMBRE" -d
echo
echo "Prueba:  lp -d $NOMBRE scripts/spike-impresion/58mm-ticket-salida.html"
echo "Si la cola vieja «POS-80» sigue estorbando:  sudo lpadmin -x POS-80"

rm -rf "$TRABAJO"
