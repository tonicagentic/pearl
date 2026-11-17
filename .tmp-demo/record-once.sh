#!/bin/zsh
OUT="/Users/alex/Movies/pearl-oauth-demo/pearl-oauth-cursor-$(date +%Y%m%d-%H%M%S).mp4"
echo "$OUT" > /tmp/pearl-demo-path.txt
: > /tmp/pearl-demo-ffmpeg.log
/opt/homebrew/bin/ffmpeg -y -f avfoundation -framerate 10 -capture_cursor 1 -i "2:none" \
  -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p \
  -movflags +frag_keyframe+empty_moov+default_base_moof \
  "$OUT" >> /tmp/pearl-demo-ffmpeg.log 2>&1
