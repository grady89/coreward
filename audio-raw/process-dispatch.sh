#!/usr/bin/env bash
# Applies the Dispatch comms-radio treatment (DISPATCH.md: band-pass, presence
# bump, soft saturation, gentle compression, squelch tail) to a raw ElevenLabs
# take, then peak-normalizes in a second pass (loudnorm's LUFS gating is
# unreliable on clips this short).
#
# Usage: process-dispatch.sh <in.mp3> <out.mp3>
# Output belongs under public/audio/dispatch/ — that's the only folder Vite
# serves/bundles verbatim, in dev and in a packaged build alike. After adding
# files, regenerate src/audio/voice-manifest.ts (see the comment at its top).
set -euo pipefail

# ffmpeg, found rather than assumed: $FFMPEG wins, then PATH, then the winget
# install (whose folder carries the version, so it moves on every upgrade).
if [ -n "${FFMPEG:-}" ] && [ -x "$FFMPEG" ]; then
  FF="$FFMPEG"
elif command -v ffmpeg >/dev/null 2>&1; then
  FF="$(command -v ffmpeg)"
else
  FF=$(ls -1d /c/Users/*/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_*/ffmpeg-*/bin/ffmpeg.exe 2>/dev/null | sort -V | tail -1)
fi
if [ -z "${FF:-}" ] || [ ! -x "$FF" ]; then
  echo "ffmpeg not found. Install it (winget install Gyan.FFmpeg) or set FFMPEG=/path/to/ffmpeg" >&2
  exit 1
fi

TARGET_PEAK_DB=-2.0

IN="$1"
OUT="$2"
mkdir -p "$(dirname "$OUT")"

CHAIN='
    [0:a]highpass=f=300:poles=2,highpass=f=300:poles=2,
    lowpass=f=3400:poles=2,lowpass=f=3400:poles=2,
    equalizer=f=2000:width_type=o:width=1:g=3,
    volume=6dB,
    asoftclip=type=tanh:param=0.6,
    acompressor=threshold=-18dB:ratio=3:attack=5:release=80:makeup=1,
    alimiter=limit=0.95[voice];
    [1:a]highpass=f=400:poles=2,highpass=f=400:poles=2,lowpass=f=2800:poles=2,
    volume=-16dB,
    afade=t=in:d=0.01,afade=t=out:st=0.15:d=0.03[tail];
    [voice][tail]concat=n=2:v=0:a=1[out]
'

# pass 1 — measure peak of the processed (unnormalized) signal
MEASURED=$("$FF" -y -loglevel info -i "$IN" \
  -f lavfi -i "anoisesrc=color=white:duration=0.18:sample_rate=44100:amplitude=1" \
  -filter_complex "${CHAIN};[out]volumedetect[metered]" \
  -map "[metered]" -f null - 2>&1 | grep "max_volume" | grep -oE '\-?[0-9]+\.[0-9]+')

GAIN=$(awk -v t="$TARGET_PEAK_DB" -v m="$MEASURED" 'BEGIN { printf "%.2f", t - m }')

# pass 2 — apply the makeup gain and render
"$FF" -y -loglevel error -i "$IN" \
  -f lavfi -i "anoisesrc=color=white:duration=0.18:sample_rate=44100:amplitude=1" \
  -filter_complex "${CHAIN};[out]volume=${GAIN}dB[final]" \
  -map "[final]" -ar 44100 -ac 1 -b:a 128k "$OUT"

echo "  measured peak ${MEASURED}dB -> applied ${GAIN}dB makeup"
