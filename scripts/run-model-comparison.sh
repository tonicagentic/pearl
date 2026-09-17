#!/usr/bin/env zsh
# Model comparison experiment: run the full behavior eval suite against each
# model on the AI Gateway, capturing per-model artifacts.
#
# Usage: zsh scripts/run-model-comparison.sh <outdir>
# Each model's run lands in .eve/evals/<timestamp>/; the newest artifact dir
# after each run is recorded in <outdir>/<slug>.txt.

set -e

OUTDIR="${1:-.eve/model-comparison}"
mkdir -p "$OUTDIR"

MODELS=(
  "zai/glm-5.3-fast"
  "google/gemini-3.5-flash"
  "openai/gpt-5.4-mini"
  "anthropic/claude-haiku-4.5"
  "anthropic/claude-opus-4.8"
)

for MODEL in $MODELS; do
  SLUG=$(echo "$MODEL" | tr '/.' '__')
  BEFORE=$(ls -t .eve/evals/ 2>/dev/null | head -1)

  echo "=== model: $MODEL ==="
  AGENT_MODEL_OVERRIDE="$MODEL" pnpm exec eve eval behavior --strict --max-concurrency 2 || true

  AFTER=$(ls -t .eve/evals/ 2>/dev/null | head -1)
  if [ "$AFTER" != "$BEFORE" ]; then
    echo "$AFTER" > "$OUTDIR/$SLUG.txt"
    echo "artifact: $AFTER"
  else
    echo "WARN: no new artifact dir for $MODEL" >&2
  fi
done

echo "=== done ==="
