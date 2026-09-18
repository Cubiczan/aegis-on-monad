#!/bin/bash
# Assemble the Aegis 3-minute demo video:
#   raw webm scenes -> normalized mp4 segments
#   card PNGs -> slow-zoom mp4 cards
#   concat + ambient bed -> final mp4 (+faststart)
set -euo pipefail
cd /home/z/my-project/media

mkdir -p seg out

echo "== 1/4 normalize scene webms =="
for s in scene01 scene02 scene03 scene04 scene05 scene06 scene07 scene08; do
  ffmpeg -y -v error -i raw/$s.webm \
    -c:v libx264 -preset medium -crf 20 -r 30 -pix_fmt yuv420p \
    -vf "scale=1920:1080:flags=lanczos" -an seg/$s.mp4
  echo "  $s done"
done

echo "== 2/4 card stills -> zooming segments =="
render_card () { # id duration fade("in"|"out"|none)
  local id=$1 dur=$2 fade=${3:-none}
  local frames=$(python3 -c "print(round($dur*30))")
  local vf="zoompan=z='1+0.00045*in':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30,format=yuv420p"
  case $fade in
    in) vf="$vf,fade=t=in:st=0:d=0.6";;
    out) vf="$vf,fade=t=out:st=$(python3 -c "print(max(0,$dur-1.4))"):d=1.4";;
  esac
  ffmpeg -y -v error -loop 1 -framerate 30 -t $dur -i cards/$id.png \
    -vf "$vf" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -t $dur seg/$id.mp4
  echo "  $id done ($dur s)"
}
render_card c-title    3.4 in
render_card c-desk     2.2
render_card c-treasury 2.2
render_card c-sentinel 2.2
render_card c-proof    2.2
render_card c-identity 2.2
render_card c-end      8.0 out

echo "== 3/4 concat =="
cat > out/list.txt <<EOF
file 'seg/c-title.mp4'
file 'seg/scene01.mp4'
file 'seg/c-desk.mp4'
file 'seg/scene02.mp4'
file 'seg/scene03.mp4'
file 'seg/c-treasury.mp4'
file 'seg/scene04.mp4'
file 'seg/c-sentinel.mp4'
file 'seg/scene05.mp4'
file 'seg/scene06.mp4'
file 'seg/c-proof.mp4'
file 'seg/scene07.mp4'
file 'seg/c-identity.mp4'
file 'seg/scene08.mp4'
file 'seg/c-end.mp4'
EOF
ffmpeg -y -v error -f concat -safe 0 -i out/list.txt -c copy out/concat.mp4

echo "== 4/4 ambient bed + mux =="
DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 out/concat.mp4)
FADE_ST=$(python3 -c "print(max(0,$DUR-8))")
node /home/z/my-project/scripts/gen-audio.mjs $DUR
ffmpeg -y -v error -i out/concat.mp4 -i bed.wav \
  -filter_complex "[1:a]afade=t=in:st=0:d=2.5,afade=t=out:st=$FADE_ST:d=8[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -movflags +faststart \
  /home/z/my-project/download/aegis-demo.mp4

FINAL=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /home/z/my-project/download/aegis-demo.mp4)
SIZE=$(du -h /home/z/my-project/download/aegis-demo.mp4 | cut -f1)
echo "== done: $FINAL s, $SIZE =="
