"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";

import {
  DEFAULT_WORDS_PER_SECOND,
  useStreamingReveal,
  type Token,
} from "@/lib/streaming-text-reveal";

// Streaming Text, from https://www.gregbparker.com/artifacts/streaming-text
// Reveals an AI reply word by word as it streams in, with a cursor at the end
// and light markdown (bold, inline code, lists, fenced code) rendered as it lands.
// No dependencies beyond React. Text colors inherit from the parent.
//
// Pearl's chat path keeps the full markdown renderer (citations, tables, …)
// and only reuses the tokenizer/smoother/cursor — see StreamingMarkdownText.

export type StreamingTextReveal = "word" | "fade";
export type StreamingTextCursor = "bar" | "block" | "dot" | "none";

export type StreamingTextProps = {
  /** The reply so far. It grows as chunks arrive. */
  text: string;
  /** True while the model is still sending. */
  streaming: boolean;
  /** "word" drops each word in, "fade" eases it in. */
  reveal?: StreamingTextReveal;
  /** The mark at the end of the reply while it's still being written. */
  cursor?: StreamingTextCursor;
  /** Render bold, inline code, lists and fenced code. Off shows the raw text. */
  markdown?: boolean;
  /** How fast buffered words appear. Speeds up when >~2s of text is waiting. */
  wordsPerSecond?: number;
  className?: string;
};

const DEFAULTS = {
  reveal: "fade" as StreamingTextReveal,
  cursor: "dot" as StreamingTextCursor,
  markdown: true,
  wordsPerSecond: DEFAULT_WORDS_PER_SECOND,
};

const TICK = String.fromCharCode(96);
const FENCE = TICK + TICK + TICK;
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const STREAMING_TEXT_STYLES = [
  "@keyframes st-fade { from { opacity: 0; filter: blur(2px); } to { opacity: 1; filter: blur(0); } }",
  "@keyframes st-blink { 0%, 45% { opacity: 1; } 55%, 100% { opacity: 0; } }",
  "@keyframes st-pulse { 0%, 100% { opacity: 0.45; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1); } }",
  "@media (prefers-reduced-motion: no-preference) {",
  "  .st-word { animation: st-fade 400ms ease-out both; }",
  "  .st-blink { animation: st-blink 1.06s ease-in-out infinite; }",
  "  .st-pulse { animation: st-pulse 1.2s ease-in-out infinite; }",
  "}",
].join("\n");

type Run = { kind: "text" | "bold" | "code"; start: number; end: number };

type Block =
  | { kind: "paragraph"; start: number; runs: Run[] }
  | { kind: "list"; start: number; ordered: boolean; items: Run[][] }
  | { kind: "code"; start: number; body: Run };

type View = {
  text: string;
  tokens: readonly Token[];
  revealed: number;
  clip: number;
  fade: boolean;
  fadeFrom: number;
};

function parseInline(src: string, start: number, end: number): Run[] {
  const runs: Run[] = [];
  let kind: Run["kind"] = "text";
  let from = start;
  let i = start;
  const push = (to: number) => {
    if (to > from) runs.push({ kind, start: from, end: to });
  };
  while (i < end) {
    if (kind !== "code" && src.startsWith("**", i) && i + 2 <= end) {
      push(i);
      kind = kind === "bold" ? "text" : "bold";
      i += 2;
      from = i;
    } else if (kind !== "bold" && src[i] === TICK) {
      push(i);
      kind = kind === "code" ? "text" : "code";
      i += 1;
      from = i;
    } else {
      i += 1;
    }
  }
  push(end);
  return runs;
}

const LIST_ITEM = /^(- |\d+\. )/;

function parseBlocks(src: string): Block[] {
  const lines: { text: string; start: number; end: number }[] = [];
  let pos = 0;
  for (const text of src.split("\n")) {
    lines.push({ text, start: pos, end: pos + text.length });
    pos += text.length + 1;
  }

  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.text.trim() === "") {
      i += 1;
    } else if (line.text.startsWith(FENCE)) {
      const first = i + 1;
      let j = first;
      while (j < lines.length && !lines[j]!.text.startsWith(FENCE)) j += 1;
      const bodyStart = first < lines.length ? lines[first]!.start : line.end;
      const bodyEnd = j > first ? lines[j - 1]!.end : bodyStart;
      blocks.push({
        kind: "code",
        start: line.start,
        body: { kind: "code", start: bodyStart, end: bodyEnd },
      });
      i = j + 1;
    } else if (LIST_ITEM.test(line.text)) {
      const ordered = !line.text.startsWith("- ");
      const items: Run[][] = [];
      while (i < lines.length && LIST_ITEM.test(lines[i]!.text)) {
        const marker = (LIST_ITEM.exec(lines[i]!.text) as RegExpExecArray)[0]
          .length;
        items.push(parseInline(src, lines[i]!.start + marker, lines[i]!.end));
        i += 1;
      }
      blocks.push({ kind: "list", start: line.start, ordered, items });
    } else {
      let j = i;
      while (
        j < lines.length &&
        lines[j]!.text.trim() !== "" &&
        !lines[j]!.text.startsWith(FENCE) &&
        !LIST_ITEM.test(lines[j]!.text)
      ) {
        j += 1;
      }
      blocks.push({
        kind: "paragraph",
        start: line.start,
        runs: parseInline(src, line.start, lines[j - 1]!.end),
      });
      i = j;
    }
  }
  return blocks;
}

export function StreamingTextCursorMark({
  cursor,
}: {
  cursor: StreamingTextCursor;
}) {
  if (cursor === "none") return null;
  if (cursor === "dot") {
    return (
      <span
        aria-hidden="true"
        className="st-pulse"
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          marginLeft: 6,
          borderRadius: 9999,
          background: "currentColor",
          verticalAlign: "middle",
        }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="st-blink"
      style={{
        display: "inline-block",
        width: cursor === "bar" ? 2 : "0.55em",
        height: "1.1em",
        marginLeft: 2,
        borderRadius: cursor === "bar" ? 9999 : 0,
        background: "currentColor",
        opacity: cursor === "block" ? 0.8 : 1,
        verticalAlign: "-0.2em",
      }}
    />
  );
}

function pieces(runs: Run[], view: View, codeBlock: boolean): ReactNode[] {
  const out: ReactNode[] = [];
  for (const run of runs) {
    const words: ReactNode[] = [];
    for (const tok of view.tokens) {
      if (tok.end > view.revealed) break;
      const s = Math.max(tok.start, run.start);
      const e = Math.min(tok.end, run.end, view.clip);
      if (e <= s) continue;
      words.push(
        <span
          key={s}
          className={
            view.fade && tok.start >= view.fadeFrom ? "st-word" : undefined
          }
        >
          {view.text.slice(s, e)}
        </span>,
      );
    }
    if (!words.length) continue;
    if (run.kind === "bold") {
      out.push(
        <strong key={run.start} style={{ fontWeight: 600 }}>
          {words}
        </strong>,
      );
    } else if (run.kind === "code" && !codeBlock) {
      out.push(
        <code
          key={run.start}
          style={{
            fontFamily: MONO,
            fontSize: "0.88em",
            padding: "0.1em 0.3em",
            borderRadius: 4,
            background: "rgba(127, 127, 127, 0.16)",
          }}
        >
          {words}
        </code>,
      );
    } else {
      out.push(...words);
    }
  }
  return out;
}

function Markdown({
  blocks,
  view,
  cursor,
}: {
  blocks: Block[];
  view: View;
  cursor: ReactNode;
}) {
  const rendered = blocks.map((block) => ({
    block,
    parts:
      block.kind === "paragraph"
        ? [pieces(block.runs, view, false)]
        : block.kind === "list"
          ? block.items.map((item) => pieces(item, view, false))
          : [pieces([block.body], view, true)],
  }));

  if (cursor) {
    let placed = false;
    for (let i = rendered.length - 1; i >= 0 && !placed; i--) {
      const parts = rendered[i]!.parts;
      for (let j = parts.length - 1; j >= 0; j--) {
        if (parts[j]!.length) {
          parts[j]!.push(<span key="cursor">{cursor}</span>);
          placed = true;
          break;
        }
      }
    }
    if (!placed) return <p style={{ margin: 0 }}>{cursor}</p>;
  }

  return (
    <>
      {rendered
        .filter((r) => r.parts.some((p) => p.length))
        .map(({ block, parts }) => {
          if (block.kind === "paragraph") {
            return (
              <p key={block.start} style={{ margin: 0 }}>
                {parts[0]}
              </p>
            );
          }
          if (block.kind === "code") {
            return (
              <pre
                key={block.start}
                style={{
                  margin: 0,
                  padding: 16,
                  overflowX: "auto",
                  borderRadius: 12,
                  background: "rgba(127, 127, 127, 0.1)",
                  fontFamily: MONO,
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <code>{parts[0]}</code>
              </pre>
            );
          }
          const style = {
            margin: 0,
            paddingLeft: "1.25em",
            listStyle: block.ordered ? "decimal" : ("disc" as const),
          };
          const items = parts.map((p, idx) =>
            p.length ? (
              <li key={idx} style={{ marginTop: idx ? 4 : 0 }}>
                {p}
              </li>
            ) : null,
          );
          return block.ordered ? (
            <ol key={block.start} style={style}>
              {items}
            </ol>
          ) : (
            <ul key={block.start} style={style}>
              {items}
            </ul>
          );
        })}
    </>
  );
}

export default function StreamingText(props: StreamingTextProps) {
  const { text, streaming, className } = props;
  const reveal = props.reveal ?? DEFAULTS.reveal;
  const cursor = props.cursor ?? DEFAULTS.cursor;
  const markdown = props.markdown ?? DEFAULTS.markdown;
  const wordsPerSecond = props.wordsPerSecond ?? DEFAULTS.wordsPerSecond;

  const blocks = useMemo(
    () => (markdown ? parseBlocks(text) : []),
    [text, markdown],
  );
  const {
    revealed,
    clip,
    writing,
    fadeFrom,
    tokens,
  } = useStreamingReveal(text, streaming, wordsPerSecond);

  const view: View = {
    text,
    tokens,
    revealed,
    clip,
    fade: reveal === "fade",
    fadeFrom,
  };
  const mark =
    writing && cursor !== "none" ? (
      <StreamingTextCursorMark cursor={cursor} />
    ) : null;

  return (
    <div
      className={className}
      aria-busy={writing}
      style={{ display: "flex", flexDirection: "column", gap: "1em" }}
    >
      <style>{STREAMING_TEXT_STYLES}</style>
      {markdown ? (
        <Markdown blocks={blocks} view={view} cursor={mark} />
      ) : (
        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          {tokens
            .filter((t) => t.end <= view.revealed)
            .map((t) => (
              <span
                key={t.start}
                className={
                  view.fade && t.start >= fadeFrom ? "st-word" : undefined
                }
              >
                {text.slice(t.start, Math.min(t.end, view.clip))}
              </span>
            ))}
          {mark}
        </p>
      )}
    </div>
  );
}
