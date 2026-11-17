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
const CODER_TURN_0 = "prod-coder-0";
const CODER_TURN_1 = "prod-coder-1";
const CODER_TURN_2 = "prod-coder-2";
const LOGO_TURN_0 = "prod-logo-0";
const LOGO_TURN_1 = "prod-logo-1";
const KAISER_TURN = "prod-kaiser-0";

/** Neutral stock photos used in place of production uploads. */
const SAMPLE_LOGO_REF_A =
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=512&h=512&fit=crop";
const SAMPLE_LOGO_REF_B =
  "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=512&h=512&fit=crop";
const SAMPLE_LOGO_COMPANION =
  "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=512&h=512&fit=crop";

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

/** Mail tool + mid-turn prose + long summary — production inbox ask (PII scrubbed). */
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
            "Summarize today's received mail across all connected accounts, grouped usefully with senders, subjects, concise significance, needs reply vs FYI/noise. Read-only; no changes.",
        }),
        {
          type: "text",
          text: "Checking your inbox for today — pulling today's messages across your accounts now. I'll summarize them as soon as they load.",
        },
        {
          type: "reasoning",
          text: "Summarize today's mail. Highlight security alerts, bank link, Vercel failure.",
        },
        {
          type: "text",
          text: "You got **45 emails today** (Nov 14 UTC) — 43 unread. Most is promos, a few worth checking:\n\n**Needs a look:**\n* **Google — Security alert (5x around 17:24 UTC):** authenticator app, passkey, phone number, and 2-step verification changes on a connected account — if that wasn't you, check it now.\n* **Bank — Pearl linked** (18:50 UTC) — new data-sharing connection confirmed.\n* **Vercel — Production deployment failed for `my-agent`** (00:55 UTC) — worth checking logs.\n* **Kaiser Permanente — premium bill available** (2x, already read)\n\n**FYI (8):** Auto policy renewal, coffee receipt, app store receipt, Neon usage recap, travel reward promo, news briefing, sports score, music recs.\n\n**Rest (28) is noise/promos:** home goods, ski passes (prices increase soon — time-sensitive if you're buying), plus clothing/music spam.\n\nAnd **1 suspicious** email posing as SendGrid from an unfamiliar school domain — don't click, check SendGrid directly.\n\nNo personal threads needing a reply today. Want me to open any of those in full?",
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

/** Coder delegation — sanitized production GitHub/Vercel settings implementation. */
export const prodCoder: ThreadSample = {
  id: "prod-coder",
  label: "Prod · Coder",
  durationEvents: [
    ...durationEvents(CODER_TURN_0, "2026-11-13T22:25:14.000Z", "2026-11-13T22:26:42.000Z"),
    ...durationEvents(CODER_TURN_1, "2026-11-13T22:39:27.000Z", "2026-11-13T22:39:35.000Z"),
    ...durationEvents(CODER_TURN_2, "2026-11-13T23:17:07.000Z", "2026-11-13T23:45:00.000Z"),
  ],
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Implement the approved GitHub/Vercel settings plan in tonicagentic/pearl, under mobile/, test it, and open a draft PR into main without merging.",
        },
      ],
    },
    {
      role: "assistant",
      status: { type: "complete", reason: "stop" },
      content: [
        toolCall(
          "coder",
          {
            message:
              "Repo tonicagentic/pearl. Implement the approved GitHub/Vercel settings plan under mobile/, test it, and open a draft PR into main without merging.",
          },
          {
            result:
              "**Blocked: approved plan not found.** No project-file changes and no PR.\n\nChecked root and `mobile/` docs, plan documents, branches, and PR titles. No matching settings plan. Existing mobile settings still use the shared plugin-detail screen for GitHub/Vercel connection status.",
          },
        ),
        {
          type: "text",
          text: "The coder is starting in `tonicagentic/pearl`, first locating the approved plan. It will implement under `mobile/`, run tests, and open a draft PR into `main` without merging. If it can't find the plan, it will pause rather than invent the scope.",
        },
        {
          type: "text",
          text: "I couldn't locate the approved plan in the repo, and this chat has no attached project. No files changed, tests ran, or PR opened.\n\nCan you paste the plan or provide its `planId` (or project ID and plan slug)? I'll then resume implementation under `mobile/`, test it, and open a draft PR into `main` without merging.",
        },
      ],
      metadata: { custom: { turnId: CODER_TURN_0 } },
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "idk but here’s the plan: Proposed scope\n\n• GitHub: repository previews with visibility, description, and last update; “View all” opens the existing paginated repo browser.\n• Vercel: explicit account/team selection, paginated project browsing, and project details with recent deployments and domains.\n• Usage: permission-dependent Vercel billing/usage for a clearly labeled period. If access is unavailable, explain why and link to Vercel rather than showing zeroes. Defer GitHub billing metrics, which aren't currently integrated.\n• Connection handling: preserve connect/disconnect controls, refresh after authorization, and handle expired access, limited permissions, loading, and errors.\n\nRepository listing already exists. Vercel project browsing needs new read-only endpoints, and its current usage helper isn't reliable enough to reuse as-is. Provider permissions still need live verification.\n\nI'll test authentication isolation, pagination, usage parsing, and mobile interactions, then open a draft PR.",
        },
      ],
    },
    {
      role: "assistant",
      status: { type: "complete", reason: "stop" },
      content: [
        toolCall(
          "coder",
          {
            taskId: "coder-sample",
            message:
              "User supplied the approved plan; resume implementation. GitHub previews, Vercel account/team + projects + deployments/domains, permission-aware usage, preserve connection controls.",
          },
          {
            result:
              "Implemented locally on **`feat/mobile-provider-settings`**, commit **`9d601f2`**.\n\n- GitHub previews with visibility, description, updated date, and existing “View all” browser.\n- Vercel account/team selection, paginated projects, deployment/domain details.\n- Permission-aware usage for the last 30 complete UTC days.\n- Preserved connection controls and added authorization-return refresh.\n\n**Validation:** 12 backend tests and 13 mobile tests pass; root typecheck, changed-file lint, and Expo web export pass.",
          },
        ),
        {
          type: "text",
          text: "Resuming with this plan: mobile settings changes plus the read-only Vercel endpoints they require. The coder will test auth isolation, pagination, usage parsing, and mobile interactions, flag anything it can't verify live, and open a draft PR into `main` without merging.",
        },
      ],
      metadata: { custom: { turnId: CODER_TURN_1 } },
    },
    {
      role: "user",
      content: [{ type: "text", text: "status?" }],
    },
    {
      role: "assistant",
      status: { type: "complete", reason: "stop" },
      content: [
        {
          type: "text",
          text: "Implemented locally on `feat/mobile-provider-settings`, commit `9d601f2`.\n\n- Added GitHub previews, Vercel account/team selection, paginated projects, deployment/domain details, and permission-aware usage.\n- Preserved connection controls and added refresh after authorization.\n- Passed 12 backend tests, 13 mobile tests, root typecheck, changed-file lint, and Expo web export. Existing failures were reproduced on unchanged `main`.\n\n**Draft PR blocked:** GitHub returned 403 for push access to `tonicagentic/pearl`. No PR was created, and nothing was merged.\n\nLive Vercel permissions and simulator interactions remain unverified because the required authentication wasn't available. Restore GitHub push access, then I can retry publication.",
        },
      ],
      metadata: { custom: { turnId: CODER_TURN_2 } },
    },
  ],
};

/** Logo critique with stock sample images instead of production uploads. */
export const prodLogo: ThreadSample = {
  id: "prod-logo",
  label: "Prod · Logo",
  durationEvents: [
    ...durationEvents(LOGO_TURN_0, "2026-11-16T05:43:12.000Z", "2026-11-16T05:44:40.000Z"),
    ...durationEvents(LOGO_TURN_1, "2026-11-16T05:45:03.000Z", "2026-11-16T05:45:50.000Z"),
  ],
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "would something like this make sense for a logo for Pearl?",
        },
        { type: "image", image: SAMPLE_LOGO_REF_A },
        { type: "image", image: SAMPLE_LOGO_REF_B },
      ],
    },
    {
      role: "assistant",
      status: { type: "complete", reason: "stop" },
      content: [
        {
          type: "text",
          text: "Yes — **a shell holding a pearl makes sense as a direction.** It gives Pearl a recognizable object and could feel more personal than a generic AI sparkle or orb.\n\nI'd separate what works in these two references:\n\n- **The first has the stronger idea:** the pearl is the focal point, and the shell frames it. But fine ornamental detail would disappear at app-icon size.\n- **The second has the stronger construction:** bold shapes, clear silhouette, and fewer details — better for a compact mark.\n\n**I'd borrow the first one's composition and the second one's simplicity, not either one's styling.** A prominent circle, a shell reduced to a few broad shapes, and enough negative space that the pearl remains distinct in one color.\n\nFor Pearl, I'd lean toward **the pearl as the subject, with just enough shell to make it recognizable** — less seashell illustration, more compact mark.",
        },
      ],
      metadata: { custom: { turnId: LOGO_TURN_0 } },
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "I want it to feel like it goes alongside one of these",
        },
        { type: "image", image: SAMPLE_LOGO_COMPANION },
      ],
    },
    {
      role: "assistant",
      status: { type: "complete", reason: "stop" },
      content: [
        {
          type: "text",
          text: "Yes — that clarifies it. **You want a compact graphic symbol, not a decorative shell.** Something that holds its own in black alongside those marks.\n\nThe shared language here is bold mass, deliberate negative space, repeated geometry, and a recognizable silhouette.\n\nFor Pearl, I'd explore:\n- **Three to five broad shell segments**, rather than thin radiating ribs.\n- **A pearl cut out in negative space**, so shell and pearl form one symbol.\n- **A compact, slightly rounded silhouette**, with no hinge details or enclosing outline.\n\n**I'd start with a black, five-part shell surrounding a circular white opening.** Recognizably a shell on a second look; a strong standalone shape on the first.",
        },
      ],
      metadata: { custom: { turnId: LOGO_TURN_1 } },
    },
  ],
};

/**
 * Kaiser Permanente bill notice — sanitized from the production inbox summary.
 * The only Kaiser-titled production thread was medical; that content is not imported.
 */
export const prodKaiser: ThreadSample = {
  id: "prod-kaiser",
  label: "Prod · Kaiser",
  durationEvents: durationEvents(
    KAISER_TURN,
    "2026-11-14T19:48:00.000Z",
    "2026-11-14T19:48:45.000Z",
  ),
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: "what was the Kaiser email about?" }],
    },
    {
      role: "assistant",
      status: { type: "complete", reason: "stop" },
      content: [
        toolCall("mail", {
          message:
            "Summarize the recent Kaiser Permanente message(s): subject, sender, and whether action is needed. Read-only.",
        }),
        {
          type: "text",
          text: "**Kaiser Permanente — premium bill available** (two copies of the same notice; already read).\n\nIt's a billing reminder that a premium bill is ready to view online — not a collections notice and not a clinical message. No reply needed unless you want to open the bill in the member portal.",
        },
      ],
      metadata: { custom: { turnId: KAISER_TURN } },
    },
  ],
};

export const IMPORTED_THREAD_SAMPLES: readonly ThreadSample[] = [
  prodTwitch,
  prodMail,
  prodPearl,
  prodCacio,
  prodCoder,
  prodLogo,
  prodKaiser,
];
