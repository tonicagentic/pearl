/** FEN placement → 8×8 board helpers (no chess.js). */

export type ChessOrientation = "white" | "black";

export type ChessSquare = {
  readonly file: number; // 0=a … 7=h
  readonly rank: number; // 0=1 … 7=8
};

export type ChessCell = {
  readonly square: ChessSquare;
  readonly piece: string | null; // FEN letter or null
  readonly light: boolean;
  readonly highlighted: boolean;
};

const PIECE_GLYPH: Record<string, string> = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function pieceGlyph(piece: string | null | undefined): string {
  if (!piece) return "";
  return PIECE_GLYPH[piece] ?? piece;
}

/** Extract placement field; fall back to start position on bad input. */
export function fenPlacement(fen: string | null | undefined): string {
  if (typeof fen !== "string" || !fen.trim()) {
    return START_FEN.split(" ")[0]!;
  }
  const placement = fen.trim().split(/\s+/)[0] ?? "";
  const ranks = placement.split("/");
  if (ranks.length !== 8) return START_FEN.split(" ")[0]!;
  return placement;
}

/**
 * Parse FEN placement into a board indexed [rank][file] with rank 0 = rank 1.
 * Returns null pieces for empty squares.
 */
export function parseFenBoard(
  fen: string | null | undefined,
): (string | null)[][] {
  const placement = fenPlacement(fen);
  const ranks = placement.split("/");
  const board: (string | null)[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null),
  );

  for (let fenRank = 0; fenRank < 8; fenRank += 1) {
    const rankIndex = 7 - fenRank; // FEN starts at rank 8
    const row = ranks[fenRank] ?? "";
    let file = 0;
    for (const ch of row) {
      if (file >= 8) break;
      if (ch >= "1" && ch <= "8") {
        file += Number(ch);
        continue;
      }
      if (/[prnbqkPRNBQK]/.test(ch)) {
        board[rankIndex]![file] = ch;
        file += 1;
      }
    }
  }
  return board;
}

/** Parse UCI like `e2e4` or `e7e8q` into from/to squares. */
export function parseUciMove(
  lastMove: string | null | undefined,
): { from: ChessSquare; to: ChessSquare } | null {
  if (typeof lastMove !== "string") return null;
  const match = lastMove
    .trim()
    .toLowerCase()
    .match(/^([a-h])([1-8])([a-h])([1-8])/);
  if (!match) return null;
  return {
    from: { file: match[1]!.charCodeAt(0) - 97, rank: Number(match[2]) - 1 },
    to: { file: match[3]!.charCodeAt(0) - 97, rank: Number(match[4]) - 1 },
  };
}

export function squareKey(square: ChessSquare): string {
  return `${square.file},${square.rank}`;
}

/** Display order of squares for orientation (row-major from top-left). */
export function boardCells(args: {
  readonly fen: string;
  readonly orientation?: ChessOrientation | null;
  readonly lastMove?: string | null;
}): readonly ChessCell[] {
  const board = parseFenBoard(args.fen);
  const orientation = args.orientation === "black" ? "black" : "white";
  const uci = parseUciMove(args.lastMove);
  const highlights = new Set<string>();
  if (uci) {
    highlights.add(squareKey(uci.from));
    highlights.add(squareKey(uci.to));
  }

  const cells: ChessCell[] = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const file = orientation === "white" ? col : 7 - col;
      const rank = orientation === "white" ? 7 - row : row;
      const piece = board[rank]?.[file] ?? null;
      cells.push({
        square: { file, rank },
        piece,
        light: (file + rank) % 2 === 1,
        highlighted: highlights.has(squareKey({ file, rank })),
      });
    }
  }
  return cells;
}

export function fileLabel(file: number): string {
  return String.fromCharCode(97 + Math.max(0, Math.min(7, file)));
}

export function rankLabel(rank: number): string {
  return String(Math.max(0, Math.min(7, rank)) + 1);
}

export function formatDurationMs(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${minutes}m ${rem}s`;
}

/** Strip ANSI CSI / OSC sequences for terminal display. */
export function stripAnsi(text: string): string {
  return text
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b./g, "");
}
