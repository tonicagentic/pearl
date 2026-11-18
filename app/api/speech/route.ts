import { NextResponse } from "next/server";

import {
  generatePronunciationSpeech,
  SPEECH_MAX_CHARS,
} from "@/lib/speech/generate";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

/**
 * Text-to-speech for Pronounce / Phrase cards via AI SDK + AI Gateway.
 * POST { text, lang? } → audio/mpeg
 */
export async function POST(request: Request) {
  const setupStatus = await getSetupStatus();
  if (!setupStatus.appReady) {
    return NextResponse.json(
      { error: "App is not ready." },
      { status: 503, ...NO_STORE },
    );
  }

  const viewer = await getServerViewer(setupStatus);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in required." },
      { status: 401, ...NO_STORE },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body." },
      { status: 400, ...NO_STORE },
    );
  }

  const text =
    body &&
    typeof body === "object" &&
    typeof (body as { text?: unknown }).text === "string"
      ? (body as { text: string }).text
      : "";
  const lang =
    body &&
    typeof body === "object" &&
    typeof (body as { lang?: unknown }).lang === "string"
      ? (body as { lang: string }).lang
      : null;

  if (!text.trim()) {
    return NextResponse.json(
      { error: "text is required." },
      { status: 400, ...NO_STORE },
    );
  }
  if (text.trim().length > SPEECH_MAX_CHARS) {
    return NextResponse.json(
      { error: `text must be ${SPEECH_MAX_CHARS} characters or fewer.` },
      { status: 400, ...NO_STORE },
    );
  }

  try {
    const speech = await generatePronunciationSpeech({
      text,
      lang,
      signal: request.signal,
    });
    return new NextResponse(Buffer.from(speech.bytes), {
      status: 200,
      headers: {
        "Content-Type": speech.mediaType,
        "Cache-Control": "private, max-age=3600",
        "X-Speech-Model": speech.modelId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Speech generation failed.";
    return NextResponse.json({ error: message }, { status: 502, ...NO_STORE });
  }
}
