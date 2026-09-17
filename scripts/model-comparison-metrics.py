import json
import glob
import os
from datetime import datetime

def load(path):
    return json.load(open(path))

def iso(ts):
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))

rows = []
for mapping in sorted(glob.glob(".eve/model-comparison/*.txt")):
    slug = os.path.basename(mapping).replace(".txt", "")
    artifact = open(mapping).read().strip()
    summary = load(f".eve/evals/{artifact}/summary.json")

    evals = summary.get("evals", [])
    latencies = []
    in_chars = 0
    out_chars = 0

    for ev in evals:
        # Per-eval wall duration from the captured event stream timestamps.
        events_file = None
        for path in glob.glob(f".eve/evals/{artifact}/evals/**/*.events.ndjson", recursive=True):
            if os.path.basename(path).startswith(ev["id"].split("/")[-1]):
                events_file = path
        if events_file:
            first_at = last_at = None
            for line in open(events_file, encoding="utf-8"):
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                at = (e.get("meta") or {}).get("at")
                if at:
                    if first_at is None:
                        first_at = at
                    last_at = at
            if first_at and last_at:
                dur = (iso(last_at) - iso(first_at)).total_seconds()
                latencies.append(dur)

        # Char counts for the cost estimate: input side = user/received text,
        # output side = assistant completions.
        events_file = events_file or ""
        if events_file:
            for line in open(events_file, encoding="utf-8"):
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                t = e.get("type", "")
                d = e.get("data", {})
                if t == "message.received":
                    in_chars += len(d.get("message") or "")
                elif t == "message.completed":
                    out_chars += len(d.get("message") or "")
                elif t == "message.appended":
                    out_chars += len(d.get("messageDelta") or "")
                elif t == "action.input.appended":
                    out_chars += len(d.get("inputTextDelta") or "")
                elif t == "action.result":
                    out_chars += len(str(d.get("output") or ""))

    failed_ids = [e["id"] for e in evals if e["verdict"] == "failed"]
    scored_ids = [e["id"] for e in evals if e["verdict"] == "scored"]

    # Per-eval turn counts for the input-cost estimate: the model re-reads its
    # context each turn (system + instructions + tool schemas + memory recall
    # + growing history).
    turns_by_eval = {}
    for ev in evals:
        for path in glob.glob(f".eve/evals/{artifact}/evals/**/*.events.ndjson", recursive=True):
            if os.path.basename(path).startswith(ev["id"].split("/")[-1]):
                turns = 0
                for line in open(path, encoding="utf-8"):
                    if '"message.received"' in line:
                        turns += 1
                turns_by_eval[ev["id"]] = turns

    latencies.sort()
    n = len(latencies)
    median = latencies[n // 2] if n else 0
    p90 = latencies[int(n * 0.9)] if n else 0

    rows.append({
        "model": slug,
        "passed": summary["passed"],
        "failed": summary["failed"],
        "scored": summary["scored"],
        "total": summary["totalEvals"],
        "wall_minutes": round((iso(summary["completedAt"]) - iso(summary["startedAt"])).total_seconds() / 60, 2),
        "median_eval_s": round(median, 1),
        "p90_eval_s": round(p90, 1),
        "in_chars": in_chars,
        "out_chars": out_chars,
        "turns": sum(turns_by_eval.values()),
        "failed_ids": failed_ids,
        "scored_ids": scored_ids,
    })

# Estimated cost from the AI Gateway list prices (retrieved from
# /v1/models pricing fields, 2026-09-17) and a chars/4 tokenization heuristic.
# Input estimate: each turn consumes a fixed base context (system prompt +
# instructions + tool schemas + memory recall) plus the cumulative session
# history read so far. Output is measured precisely from the streams. The
# pinned judge model's cost is constant across arms and excluded.
PRICES = {  # USD per token: (input, output)
    "zai_glm-5_3-fast": (0.0000021, 0.0000066),
    "google_gemini-3_5-flash": (0.0000015, 0.000009),
    "openai_gpt-5_4-mini": (0.00000075, 0.0000045),
    "anthropic_claude-haiku-4_5": (0.000001, 0.000005),
    "anthropic_claude-opus-4_8": (0.000005, 0.000025),
}
BASE_CONTEXT_TOKENS = 5_000
CHARS_PER_TOKEN = 4

for r in rows:
    in_price, out_price = PRICES[r["model"]]
    # Per-eval cost with history re-read per turn (approximate 50% of the
    # eval's chars are in context by the average turn).
    evals_n = max(r["total"], 1)
    turns = max(r["turns"], 1)
    avg_turns = turns / evals_n
    history_tokens = (r["in_chars"] + r["out_chars"]) / CHARS_PER_TOKEN
    in_tokens = evals_n * avg_turns * BASE_CONTEXT_TOKENS + 0.5 * history_tokens * avg_turns
    out_tokens = r["out_chars"] / CHARS_PER_TOKEN
    r["in_tokens_est_k"] = round(in_tokens / 1000)
    r["out_tokens_est_k"] = round(out_tokens / 1000)
    r["cost_usd"] = round(in_tokens * in_price + out_tokens * out_price, 2)

json.dump(rows, open(".eve/model-comparison/summary.json", "w"), indent=1)
print()
for r in rows:
    rate = round(100 * r["passed"] / r["total"], 1)
    print(f"{r['model']:28s} pass {rate:5.1f}% | wall {r['wall_minutes']:5.2f}m | med {r['median_eval_s']:5.1f}s p90 {r['p90_eval_s']:6.1f}s | est cost ${r['cost_usd']:.2f} (in {r['in_tokens_est_k']}k out {r['out_tokens_est_k']}k)")

