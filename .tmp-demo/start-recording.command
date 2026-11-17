#!/bin/zsh
OUT="/Users/alex/Movies/pearl-oauth-demo/pearl-oauth-cursor-$(date +%Y%m%d-%H%M%S).mp4"
echo "$OUT" > /tmp/pearl-demo-path.txt
: > /tmp/pearl-demo-ffmpeg.log
echo starting > /tmp/pearl-demo-status.txt
/usr/sbin/screencapture -x -C -v "$OUT" >> /tmp/pearl-demo-ffmpeg.log 2>&1 &
echo $! > /tmp/pearl-demo-screencapture.pid
sleep 2
if kill -0 "$(cat /tmp/pearl-demo-screencapture.pid)" 2>/dev/null; then echo "RECORDING $OUT pid=$(cat /tmp/pearl-demo-screencapture.pid)" > /tmp/pearl-demo-status.txt; else echo FAILED > /tmp/pearl-demo-status.txt; cat /tmp/pearl-demo-ffmpeg.log >> /tmp/pearl-demo-status.txt; fi
