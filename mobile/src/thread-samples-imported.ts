/**
 * Production chat fixtures imported for message-rendering polish.
 * Source: production `chat_event` rows (deduped). Never written back to /api/chats.
 */
import type { ThreadMessageLike } from "@assistant-ui/react-native";
import type { ReadonlyJSONObject } from "assistant-stream/utils";

import type { ThreadSample } from "./thread-samples";

type SampleToolPart = Extract<
  Exclude<ThreadMessageLike["content"], string>[number],
  { type: "tool-call" }
>;

function toolCall(
  toolName: string,
  args: ReadonlyJSONObject,
  extras: Partial<SampleToolPart> = {},
): SampleToolPart {
  return {
    type: "tool-call",
    toolCallId: `prod-${toolName}-${Object.keys(args).join("-").slice(0, 24) || "x"}`,
    toolName,
    args,
    argsText: JSON.stringify(args, null, 2),
    result: "ok",
    ...extras,
  };
}

function durationEvents(turnId: string, startAt: string, endAt: string) {
  return [
    {
      type: "message.appended",
      data: { turnId },
      meta: { at: startAt },
    },
    {
      type: "session.completed",
      data: { turnId },
      meta: { at: endAt },
    },
  ] as const;
}

const TWITCH_TURN_0 = "prod-twitch-0";
const TWITCH_TURN_1 = "prod-twitch-1";
const MAIL_TURN = "prod-mail-0";
const PEARL_TURN = "prod-pearl-0";
const CACIO_TURN = "prod-cacio-0";

/** Short Q&A + web_search — production “who founded twitch?” */
export const prodTwitch: ThreadSample = {
  id: "prod-twitch",
  label: "Prod · Twitch",
  durationEvents: [
    ...durationEvents(TWITCH_TURN_0, "2026-11-15T16:33:40.000Z", "2026-11-15T16:33:45.000Z"),
    ...durationEvents(TWITCH_TURN_1, "2026-11-15T16:33:59.000Z", "2026-11-15T16:34:05.000Z"),
  ],
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: "who founded twitch?" }],
    },
    {
      role: "assistant",
      status: { type: "complete", reason: "stop" },
      content: [
        {
          type: "text",
          text: "Twitch was founded in 2011 by **Justin Kan, Emmett Shear, Michael Seibel, and Kyle Vogt**. It spun out of their earlier livestreaming platform, Justin.tv, with Shear serving as Twitch’s CEO.",
        },
      ],
      metadata: { custom: { turnId: TWITCH_TURN_0 } },
    },
    {
      role: "user",
      content: [{ type: "text", text: "what about ceo?" }],
    },
    {
      role: "assistant",
      status: { type: "complete", reason: "stop" },
      content: [
        toolCall("web_search", {
          query: "Twitch current CEO Dan Clancy Emmett Shear March 2023",
          num_results: 3,
        }),
        {
          type: "text",
          text: "**Emmett Shear** was Twitch's founding CEO, serving from 2011 until March 2023. **Dan Clancy** succeeded him. [1](https://blog.twitch.tv/en/2023/03/16/16-years-of-twitch/)",
        },
      ],
      metadata: { custom: { turnId: TWITCH_TURN_1 } },
    },
  ],
};

/** Mail tool + mid-turn prose + long summary — production inbox ask. */
export const prodMail: ThreadSample = {
  id: "prod-mail",
  label: "Prod · Mail",
  durationEvents: durationEvents(
    MAIL_TURN,
    "2026-11-14T19:46:00.000Z",
    "2026-11-14T19:47:30.000Z",
  ),
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: "what emails have i gotten today?" }],
    },
    {
      role: "assistant",
      status: { type: "complete", reason: "stop" },
      content: [
        {
          type: "reasoning",
          text: "We have mail task pending. Waiting.",
        },
        toolCall("mail", {
          message:
            "Alex asks: what emails have I gotten today? Summarize today's received mail across all connected accounts, grouped usefully with senders, subjects, concise significance, needs reply vs FYI/noise. Read-only; no changes.",
        }),
        {
          type: "text",
          text: "Checking your inbox for today — pulling today's messages across your accounts now. I'll summarize them as soon as they load.",
        },
        {
          type: "reasoning",
          text: "We should summarize for Alex what emails gotten today. Need to highlight important items: security alerts, Capital One link, Vercel failure.",
        },
        {
          type: "text",
          text: "You got **45 emails today** (Nov 14 UTC) — 43 unread. Most is promos, a few worth checking:\n\n**Needs a look:**\n* **Google — Security alert (5x around 17:24 UTC):** authenticator app, passkey, phone number, and 2-step verification changes on alex@tonicagentic.com — if that wasn't you, check it now.\n* **Capital One — Pearl by Tonic Agentic linked** (18:50 UTC) — new data-sharing connection confirmed.\n* **Vercel — Production deployment failed for `my-agent`** (00:55 UTC, commit ea25663) — worth checking logs.\n* **Kaiser Permanente — premium bill available** (2x, already read)\n\n**FYI (8):** Progressive auto policy renewed/rate down, $12 Chestnut Street Coffee receipt, Apple/Tinder receipt, Neon usage recap, Capital One 15% travel reward (through Dec 14), Economist briefing, CU Buffs win 42-32 over Houston, Bandcamp recs.\n\n**Rest (28) is noise/promos:** Parachute, Wayfair, CB2, Crate & Barrel, ski passes (Epic says prices increase tomorrow / Breck in 2 days — time-sensitive if you're buying), plus clothing/music spam.\n\nAnd **1 suspicious** email posing as SendGrid from `noreply@qa.ucdsb.on.ca` — don't click, check SendGrid directly.\n\nNo personal threads needing a reply today. Want me to open any of those in full?",
        },
      ],
      metadata: { custom: { turnId: MAIL_TURN } },
    },
  ],
};

/** Long markdown reply — production “what can I do with pearl”. */
export const prodPearl: ThreadSample = {
  id: "prod-pearl",
  label: "Prod · Pearl",
  durationEvents: durationEvents(
    PEARL_TURN,
    "2026-11-15T13:41:48.000Z",
    "2026-11-15T13:41:55.000Z",
  ),
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: "Tell me what I can do with pearl" }],
    },
    {
      role: "assistant",
      status: { type: "complete", reason: "stop" },
      content: [
        {
          type: "text",
          text: "Pearl can help you think, write, research, and get work done through connected tools.\n\n- **Think through an idea:** explore an observation, test an argument, or clarify a decision without jumping straight to an answer.\n- **Write and edit:** collaborate on essays, blog posts, announcements, and proposals, with drafts saved as files you can revisit.\n- **Research:** get quick sourced answers or deeper company, competitor, and market research.\n- **Build software:** delegate code changes, review work in a pull request, and get previews or deployments through the coding agent.\n- **Manage email:** summarize unread mail, identify what needs a reply, draft responses, and propose cleanup batches.\n- **Organize ongoing work:** keep related chats and durable plans in projects, and capture unresolved issues to revisit later.\n- **Create visual work:** make diagrams, graphics, mockups, and print-ready PDFs.\n\nYour listed connections also let me **read GitHub repositories and pull requests, inspect Vercel projects and deployments, and answer Xero financial questions using your actual records**. Other services may need connecting first.\n\nFor consequential actions, such as sending messages or deleting data, Pearl asks for confirmation.\n\nTry something concrete: “What needs my attention in my inbox?”, “Review this draft,” “Explain this GitHub repo,” or “How much did we spend on software last month?”",
        },
      ],
      metadata: { custom: { turnId: PEARL_TURN } },
    },
  ],
};

/** Tiny prose reply — production pronunciation ask. */
export const prodCacio: ThreadSample = {
  id: "prod-cacio",
  label: "Prod · Cacio",
  durationEvents: durationEvents(
    CACIO_TURN,
    "2026-11-13T04:20:08.000Z",
    "2026-11-13T04:20:14.000Z",
  ),
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: "how do you pronounce cacio e pepe" }],
    },
    {
      role: "assistant",
      status: { type: "complete", reason: "stop" },
      content: [
        {
          type: "text",
          text: "**“KAH-choh eh PEH-peh”**\n\nItalian for “cheese and pepper.”",
        },
      ],
      metadata: { custom: { turnId: CACIO_TURN } },
    },
  ],
};

export const IMPORTED_THREAD_SAMPLES: readonly ThreadSample[] = [
  prodTwitch,
  prodMail,
  prodPearl,
  prodCacio,
];
