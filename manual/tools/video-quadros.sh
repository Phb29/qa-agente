#!/usr/bin/env bash
# Extrai quadros de um video (ex: gravacao de tela anexada ao ticket) para o agente "ver" como
# imagens. Usa o ffmpeg em Docker (linuxserver/ffmpeg), sem instalar nada na maquina.
#
# Uso (na pasta do agente):
#   bash tools/video-quadros.sh <video> <pasta destino> [segundos entre quadros, padrao 2]
#
# Gera em <pasta destino>:
#   mosaico_NN.jpg   folhas 3x3 (9 quadros cada, na ordem do video) -> leia estas primeiro:
#                    economizam leitura e mostram o fluxo inteiro
#   q_NNNN.jpg       quadros individuais em tamanho maior -> abra so os que interessam
#   quadros.txt      quadro -> tempo no video (mm:ss), para citar no relatorio
set -euo pipefail

VIDEO="${1:?uso: bash tools/video-quadros.sh <video> <pasta destino> [segundos]}"
DEST="${2:?uso: bash tools/video-quadros.sh <video> <pasta destino> [segundos]}"
PASSO="${3:-2}"
[ -f "$VIDEO" ] || { echo "Video nao encontrado: $VIDEO"; exit 1; }
mkdir -p "$DEST"

DIR_VIDEO=$(cd "$(dirname "$VIDEO")" && pwd -W 2>/dev/null || pwd)
DIR_DEST=$(cd "$DEST" && pwd -W 2>/dev/null || pwd)
ARQ=$(basename "$VIDEO")

ff() { MSYS_NO_PATHCONV=1 docker run --rm --memory 2g -v "$DIR_VIDEO:/in:ro" -v "$DIR_DEST:/out" linuxserver/ffmpeg "$@"; }

ff -hide_banner -loglevel error -i "/in/$ARQ" -vf "fps=1/$PASSO,scale=1280:-2" -q:v 3 /out/q_%04d.jpg
ff -hide_banner -loglevel error -i "/in/$ARQ" -vf "fps=1/$PASSO,scale=640:-2,tile=3x3" -q:v 4 /out/mosaico_%02d.jpg

n=0
: > "$DEST/quadros.txt"
for f in "$DEST"/q_*.jpg; do
  [ -e "$f" ] || continue
  t=$(( n * PASSO ))
  printf '%s  %02d:%02d\n' "$(basename "$f")" $((t / 60)) $((t % 60)) >> "$DEST/quadros.txt"
  n=$((n + 1))
done
echo "Quadros: $n (1 a cada ${PASSO}s) | mosaicos: $(ls "$DEST"/mosaico_*.jpg 2>/dev/null | wc -l) | $DEST"
