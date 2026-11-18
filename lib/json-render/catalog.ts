import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

/** Shared by SurfSpotPick / MountainPick / RepoPick / ProjectPick / NeonBranchPick. */
const pickCardProps = z.object({
  pick: z.string(),
  reason: z.string().nullable(),
  timeframe: z.string().nullable(),
  options: z
    .array(
      z.object({
        name: z.string(),
        detail: z.string().nullable(),
        meta: z.string().nullable(),
      }),
    )
    .min(2)
    .max(6),
});

const searchResultItem = z.object({
  title: z.string(),
  detail: z.string().nullable(),
  meta: z.string().nullable(),
  /** Optional https image URL (prefer for product results). */
  image: z.string().nullable(),
});

const placePin = z.object({
  label: z.string(),
  /** 0–100 horizontal position inside the schematic map. */
  x: z.number(),
  /** 0–100 vertical position inside the schematic map. */
  y: z.number(),
  detail: z.string().nullable(),
});

const encyclopediaSection = z.object({
  heading: z.string(),
  body: z.string(),
});

const infoboxPair = z.object({
  label: z.string(),
  value: z.string(),
});

const explainerStep = z.object({
  heading: z.string(),
  body: z.string(),
});

const regionBar = z.object({
  label: z.string(),
  value: z.number(),
  hint: z.string().nullable(),
});

const specRow = z.object({
  label: z.string(),
  value: z.string(),
  emphasis: z.boolean().nullable(),
});

const mailBatchItem = z.object({
  accountId: z.string(),
  threadId: z.string(),
  action: z.enum(["archive", "mark_read"]),
  subject: z.string().nullable(),
  from: z.string().nullable(),
});

const dayEvent = z.object({
  title: z.string(),
  time: z.string(),
  tag: z.string().nullable(),
});

const surfPeriod = z.object({
  label: z.string(),
  wave: z.string(),
  wind: z.string(),
});

const dailyStory = z.object({
  headline: z.string(),
  dek: z.string().nullable(),
  source: z.string().nullable(),
  url: z.string().nullable(),
  image: z.string().nullable(),
});

const snowTrailLevel = z.object({
  /** Difficulty: beginner (green), intermediate (blue), advanced (black), expert (double-black). */
  level: z.enum(["beginner", "intermediate", "advanced", "expert"]),
  open: z.number(),
  total: z.number().nullable(),
});

const surfSpotOption = z.object({
  name: z.string(),
  rating: z.string().nullable(),
  wave: z.string().nullable(),
  wind: z.string().nullable(),
  note: z.string().nullable(),
});

const mountainOption = z.object({
  name: z.string(),
  newSnow: z.string().nullable(),
  baseDepth: z.string().nullable(),
  conditions: z.string().nullable(),
  liftsOpen: z.string().nullable(),
  note: z.string().nullable(),
});

const deployState = z.enum([
  "ready",
  "building",
  "error",
  "canceled",
  "queued",
]);

const deployEnvironment = z.enum(["production", "preview", "development"]);

const latestDeploy = z.object({
  state: deployState,
  env: deployEnvironment,
  url: z.string().nullable(),
  createdAt: z.string().nullable(),
});

const deploymentItem = z.object({
  state: deployState,
  environment: deployEnvironment,
  url: z.string().nullable(),
  commit: z.string().nullable(),
  branch: z.string().nullable(),
  createdAt: z.string().nullable(),
});

const checkState = z.enum(["pending", "pass", "fail", "neutral"]);

const prState = z.enum(["open", "merged", "closed"]);

const pullRequestItem = z.object({
  title: z.string(),
  number: z.number(),
  state: prState,
  checks: checkState.nullable(),
  author: z.string().nullable(),
  branch: z.string().nullable(),
  url: z.string().nullable(),
});

const issueState = z.enum(["open", "closed"]);

const issueItem = z.object({
  title: z.string(),
  number: z.number(),
  state: issueState,
  author: z.string().nullable(),
  labels: z.array(z.string()).nullable(),
  url: z.string().nullable(),
});

const computeState = z.enum(["idle", "active"]);

const schemaTable = z.object({
  name: z.string(),
  rows: z.string().nullable(),
  detail: z.string().nullable(),
});

const shipPr = z.object({
  number: z.number(),
  title: z.string().nullable(),
  url: z.string().nullable(),
  checks: checkState.nullable(),
});

const domainItem = z.object({
  name: z.string(),
  verified: z.boolean().nullable(),
  environment: deployEnvironment.nullable(),
});

const slowQueryItem = z.object({
  query: z.string(),
  duration: z.string().nullable(),
  calls: z.string().nullable(),
  note: z.string().nullable(),
});

const settingsRow = z.object({
  label: z.string(),
  value: z.string(),
});

const settingsGroup = z.object({
  name: z.string(),
  rows: z.array(settingsRow).min(1).max(8),
});

const musicTrack = z.object({
  name: z.string(),
  role: z.string().nullable(),
  level: z.string().nullable(),
  muted: z.boolean().nullable(),
});

const storyboardFrame = z.object({
  label: z.string().nullable(),
  image: z.string().nullable(),
  beat: z.string().nullable(),
  duration: z.string().nullable(),
});

const indicatorRegion = z.object({
  label: z.string(),
  value: z.number(),
  hint: z.string().nullable(),
});

const indicatorRow = z.object({
  label: z.string(),
  value: z.string(),
});

const slideItem = z.object({
  title: z.string(),
  bullets: z.array(z.string()).nullable(),
  image: z.string().nullable(),
  notes: z.string().nullable(),
});

const timelineEvent = z.object({
  id: z.string(),
  when: z.enum(["past", "now", "future"]),
  time: z.string(),
  title: z.string(),
  detail: z.string().nullable(),
});

const comparisonOption = z.object({
  id: z.string(),
  name: z.string(),
  headline: z.string(),
  traits: z.array(z.union([z.string(), z.literal(false)])),
});

const mathStep = z.object({
  expression: z.string(),
  note: z.string().nullable(),
});

const scoreCriterion = z.object({
  label: z.string(),
  score: z.number(),
  weight: z.number(),
  note: z.string().nullable(),
});

/**
 * Shared generative-UI vocabulary for Pearl chat.
 *
 * One catalog for web and mobile so the agent emits a single spec both
 * registries can render. Uses the React element-tree schema (zod only) so the
 * agent bundle never imports a renderer.
 */
export const chatCatalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({
        direction: z.enum(["vertical", "horizontal"]).nullable(),
        gap: z.enum(["sm", "md", "lg"]).nullable(),
      }),
      slots: ["default"],
      description: "Flex stack for grouping related elements",
    },
    Card: {
      props: z.object({
        title: z.string().nullable(),
        description: z.string().nullable(),
      }),
      slots: ["default"],
      description: "Container card; use as the root of every generated UI",
    },
    Divider: {
      props: z.object({}),
      description: "Horizontal rule between sections",
    },
    Heading: {
      props: z.object({
        text: z.string(),
        level: z.enum(["1", "2", "3"]).nullable(),
      }),
      description: "Section heading",
    },
    Text: {
      props: z.object({
        text: z.string(),
        muted: z.boolean().nullable(),
      }),
      description: "Body copy inside a card",
    },
    Metric: {
      props: z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        hint: z.string().nullable(),
      }),
      description: "Single labeled metric value",
    },
    Badge: {
      props: z.object({
        label: z.string(),
        tone: z.enum(["neutral", "positive", "negative", "warning"]).nullable(),
      }),
      description: "Compact status or category chip",
    },
    ComparisonBar: {
      props: z.object({
        leftLabel: z.string(),
        leftValue: z.number(),
        rightLabel: z.string(),
        rightValue: z.number(),
        caption: z.string().nullable(),
      }),
      description:
        "Horizontal two-way share bar for races or A/B splits (e.g. Yes vs No %). Values are percents.",
    },
    Table: {
      props: z.object({
        columns: z.array(z.string()),
        rows: z.array(z.array(z.string())),
      }),
      description: "Simple data table with string cells",
    },
    Image: {
      props: z.object({
        src: z.string(),
        alt: z.string().nullable(),
      }),
      description: "Image from an https URL only",
    },
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(["default", "secondary", "outline"]).nullable(),
      }),
      description:
        "Pressable control. Bind press to the reply action to continue the chat.",
    },
    SearchResults: {
      props: z.object({
        kind: z.enum(["web", "product"]).nullable(),
        items: z.array(searchResultItem).min(1).max(8),
      }),
      description:
        "Web or product search hits. Each item has title, optional detail, optional meta (domain or price), and optional https image (use for products).",
    },
    PlaceMap: {
      props: z.object({
        title: z.string().nullable(),
        address: z.string().nullable(),
        pins: z.array(placePin).min(1).max(8),
      }),
      description:
        "Schematic map with labeled pins (x/y 0–100). One pin for a location; several for nearby places.",
    },
    NewsBrief: {
      props: z.object({
        kicker: z.string().nullable(),
        headline: z.string(),
        dek: z.string().nullable(),
        bullets: z.array(z.string()).nullable(),
        sources: z.array(z.string()).nullable(),
      }),
      description: "News story or situation brief with headline, dek, bullets, and sources",
    },
    Encyclopedia: {
      props: z.object({
        title: z.string(),
        lead: z.string(),
        image: z.string().nullable(),
        infobox: z.array(infoboxPair).nullable(),
        sections: z.array(encyclopediaSection).nullable(),
      }),
      description:
        "Encyclopedia-style entry: title, lead, optional https image, optional infobox pairs and short sections",
    },
    Pronounce: {
      props: z.object({
        word: z.string(),
        ipa: z.string().nullable(),
        syllables: z.string().nullable(),
        note: z.string().nullable(),
        /** Optional https audio clip; otherwise the UI may TTS `spoken` or `word`. */
        audio: z.string().nullable(),
        /** BCP-47 language tag for TTS (e.g. it-IT). */
        lang: z.string().nullable(),
        /** Exact text to speak; defaults to word. */
        spoken: z.string().nullable(),
      }),
      description:
        "How to pronounce a word: surface form, IPA, stressed syllables; set lang for AI speech playback",
    },
    Phrase: {
      props: z.object({
        sourceLanguage: z.string(),
        targetLanguage: z.string(),
        phrase: z.string(),
        translation: z.string(),
        literal: z.string().nullable(),
        /** Optional https audio clip of the translation. */
        audio: z.string().nullable(),
        /** BCP-47 language tag for AI speech of the translation (e.g. ja-JP). */
        lang: z.string().nullable(),
        /** Exact text to speak; defaults to translation. */
        spoken: z.string().nullable(),
      }),
      description:
        "How to say a phrase in another language, with optional literal gloss; set lang for AI speech playback",
    },
    GuitarChord: {
      props: z.object({
        name: z.string(),
        /** Six strings low-E → high-e. -1 muted, 0 open, 1+ fret. Starting/default voicing. */
        frets: z.array(z.number()).length(6),
        baseFret: z.number().nullable(),
        /** Optional extra fingerings; the UI also browses a built-in chord library. */
        voicings: z
          .array(
            z.object({
              label: z.string(),
              frets: z.array(z.number()).length(6),
              baseFret: z.number().nullable(),
            }),
          )
          .nullable(),
      }),
      description:
        "Interactive guitar chord diagram. frets is six numbers (low E to high e): -1 muted, 0 open, positive fret. Emit the best default fingering; UI can browse voicings and a shared library.",
    },
    TheoryBoard: {
      props: z.object({
        title: z.string().nullable(),
        progression: z.array(z.string()).nullable(),
        highlightKey: z.string().nullable(),
        showCircle: z.boolean().nullable(),
      }),
      description:
        "Music theory board: roman-numeral progression chips and optional circle of fifths with one key highlighted",
    },
    RegionChart: {
      props: z.object({
        title: z.string().nullable(),
        unit: z.string().nullable(),
        regions: z.array(regionBar).min(1).max(12),
      }),
      description:
        "Labeled horizontal bars for regional votes or data maps (not a geo basemap)",
    },
    Explainer: {
      props: z.object({
        title: z.string(),
        steps: z.array(explainerStep).min(1).max(8),
      }),
      description: "Teach breakdown: titled numbered steps with a short sentence each",
    },
    Recipe: {
      props: z.object({
        title: z.string(),
        time: z.string().nullable(),
        yield: z.string().nullable(),
        ingredients: z.array(z.string()).min(1),
        method: z.array(z.string()).min(1),
      }),
      description: "Recipe card with time, yield, ingredients, and numbered method",
    },
    Chart: {
      props: z.object({
        label: z.string(),
        value: z.string(),
        delta: z.string().nullable(),
        trend: z.enum(["up", "down", "flat"]).nullable(),
        upIsGood: z.boolean().nullable(),
        points: z.array(z.number()).min(1),
        visibleCount: z.number().nullable(),
        variant: z.enum(["area", "line", "bars"]).nullable(),
      }),
      description:
        "Sparkline metric chart: label, headline value, optional delta, and a numeric series (area, line, or bars)",
    },
    SpecSheet: {
      props: z.object({
        title: z.string(),
        subtitle: z.string().nullable(),
        rows: z.array(specRow).min(1),
        visibleCount: z.number().nullable(),
      }),
      description:
        "Labeled object sheet: title, optional subtitle, and label/value rows (emphasis marks the deciding row)",
    },
    MermaidDiagram: {
      props: z.object({
        code: z.string(),
        title: z.string().nullable(),
        streaming: z.boolean().nullable(),
      }),
      description:
        "Mermaid diagram from source code (flowchart, sequence, class, state, ER, XY). Prefer this card for diagram answers inside Card.",
    },
    FlightTracker: {
      props: z.object({
        airline: z.string(),
        flightNumber: z.string(),
        status: z.string(),
        origin: z.string(),
        destination: z.string(),
        progress: z.number(),
        elapsed: z.string().nullable(),
        remaining: z.string().nullable(),
      }),
      description:
        "In-flight or scheduled flight card with origin/destination codes and a 0–100 route progress bar",
    },
    CalendarEvent: {
      props: z.object({
        date: z.string(),
        title: z.string(),
        time: z.string(),
        location: z.string().nullable(),
      }),
      description: "Compact single calendar event summary",
    },
    CreateEvent: {
      props: z.object({
        day: z.string(),
        month: z.string(),
        weekday: z.string(),
        events: z.array(dayEvent).nullable(),
        title: z.string(),
        start: z.string(),
        end: z.string().nullable(),
        location: z.string().nullable(),
        calendarId: z.string().nullable(),
      }),
      description:
        "Propose adding an event: day header, optional same-day events, and Add to calendar / Discard actions that reply into chat",
    },
    Booking: {
      props: z.object({
        restaurant: z.string().nullable(),
        name: z.string().nullable(),
        partySize: z.number(),
        date: z.string(),
        seating: z.enum(["indoor", "patio"]).nullable(),
        reminder: z.boolean().nullable(),
      }),
      description:
        "Table reservation card with party size, date, seating; Confirm/Cancel reply into chat",
    },
    EmailDraft: {
      props: z.object({
        to: z.string(),
        cc: z.string().nullable(),
        bcc: z.string().nullable(),
        subject: z.string(),
        body: z.string(),
        accountId: z.string().nullable(),
        threadId: z.string().nullable(),
      }),
      description:
        "Email draft preview with Save draft / Send buttons that reply so Pearl can call create_gmail_draft or send_gmail_message",
    },
    EmailBatch: {
      props: z.object({
        items: z.array(mailBatchItem).min(1).max(20),
      }),
      description:
        "Proposed Gmail archive/mark-read batch; Confirm batch replies so Pearl can call apply_mail_batch",
    },
    SurfReport: {
      props: z.object({
        spot: z.string(),
        region: z.string().nullable(),
        updated: z.string().nullable(),
        rating: z.string().nullable(),
        summary: z.string().nullable(),
        wave: z.string().nullable(),
        wind: z.string().nullable(),
        tide: z.string().nullable(),
        periods: z.array(surfPeriod).nullable(),
      }),
      description: "Surf conditions for a spot: wave, wind, tide, rating, optional periods",
    },
    SurfSpotPick: {
      props: z.object({
        /** Recommended spot name; should match one options[].name. */
        pick: z.string(),
        reason: z.string().nullable(),
        timeframe: z.string().nullable(),
        options: z.array(surfSpotOption).min(2).max(6),
      }),
      description:
        "Which surf spot to go to (e.g. best this morning): named pick, reason, and 2–6 compared spots",
    },
    SnowReport: {
      props: z.object({
        resort: z.string(),
        region: z.string().nullable(),
        updated: z.string().nullable(),
        baseDepth: z.string().nullable(),
        newSnow: z.string().nullable(),
        conditions: z.string().nullable(),
        liftsOpen: z.string().nullable(),
        trailsOpen: z.string().nullable(),
        /** Trails open by difficulty (green / blue / black / double-black). */
        trailLevels: z.array(snowTrailLevel).nullable(),
        summary: z.string().nullable(),
        image: z.string().nullable(),
      }),
      description:
        "Ski resort snow report with depth, new snow, lifts/trails, optional trailLevels breakdown and image",
    },
    MountainPick: {
      props: z.object({
        /** Recommended mountain name; should match one options[].name. */
        pick: z.string(),
        reason: z.string().nullable(),
        timeframe: z.string().nullable(),
        options: z.array(mountainOption).min(2).max(6),
      }),
      description:
        "Which ski mountain to go to: named pick, reason, and 2–6 compared resorts",
    },
    DailyBrief: {
      props: z.object({
        date: z.string().nullable(),
        title: z.string().nullable(),
        stories: z.array(dailyStory).min(3).max(8),
      }),
      description:
        "Multi-story daily brief (top headlines). Use NewsBrief for a single story deep-dive.",
    },
    Video: {
      props: z.object({
        title: z.string().nullable(),
        src: z.string(),
        provider: z.enum(["file", "youtube", "vimeo"]).nullable(),
        poster: z.string().nullable(),
      }),
      description:
        "Inline video from an https file URL or YouTube/Vimeo watch/embed URL (provider inferred when omitted)",
    },
    VercelProject: {
      props: z.object({
        name: z.string(),
        team: z.string().nullable(),
        framework: z.string().nullable(),
        productionUrl: z.string().nullable(),
        latestDeploy: latestDeploy.nullable(),
      }),
      description: "One Vercel project at a glance with optional latest deploy",
    },
    DeploymentStatus: {
      props: z.object({
        project: z.string(),
        state: deployState,
        environment: deployEnvironment,
        url: z.string().nullable(),
        commit: z.string().nullable(),
        branch: z.string().nullable(),
        duration: z.string().nullable(),
        createdAt: z.string().nullable(),
      }),
      description: "Single Vercel deployment status (preview or production)",
    },
    DeploymentList: {
      props: z.object({
        project: z.string().nullable(),
        items: z.array(deploymentItem).min(1).max(8),
      }),
      description: "Recent Vercel deployments with state badges",
    },
    PullRequest: {
      props: z.object({
        title: z.string(),
        number: z.number(),
        repo: z.string(),
        state: prState,
        checks: checkState.nullable(),
        url: z.string().nullable(),
        author: z.string().nullable(),
        branch: z.string().nullable(),
      }),
      description: "One GitHub pull request with checks summary",
    },
    PullRequestList: {
      props: z.object({
        repo: z.string().nullable(),
        items: z.array(pullRequestItem).min(1).max(8),
      }),
      description: "Open or recent pull requests for a repo",
    },
    Issue: {
      props: z.object({
        title: z.string(),
        number: z.number(),
        repo: z.string(),
        state: issueState,
        url: z.string().nullable(),
        author: z.string().nullable(),
        labels: z.array(z.string()).nullable(),
      }),
      description: "One GitHub issue",
    },
    IssueList: {
      props: z.object({
        repo: z.string().nullable(),
        items: z.array(issueItem).min(1).max(8),
      }),
      description: "List of GitHub issues",
    },
    NeonProject: {
      props: z.object({
        name: z.string(),
        region: z.string().nullable(),
        branchesOpen: z.string().nullable(),
        defaultBranch: z.string().nullable(),
        compute: computeState.nullable(),
      }),
      description: "One Neon project summary (no connection strings)",
    },
    NeonBranch: {
      props: z.object({
        name: z.string(),
        project: z.string().nullable(),
        parent: z.string().nullable(),
        primary: z.boolean().nullable(),
        compute: computeState.nullable(),
        /** Hostname only — never a full connection string. */
        endpointHost: z.string().nullable(),
      }),
      description: "One Neon branch with compute and endpoint host (no secrets)",
    },
    SchemaOverview: {
      props: z.object({
        database: z.string().nullable(),
        tableCount: z.number().nullable(),
        tables: z.array(schemaTable).min(1).max(20),
      }),
      description: "Database schema overview: table count and named tables",
    },
    ShipStatus: {
      props: z.object({
        repo: z.string(),
        pr: shipPr.nullable(),
        previewUrl: z.string().nullable(),
        deployState: deployState.nullable(),
        branch: z.string().nullable(),
      }),
      description:
        "Thin ship handoff: repo, optional PR, preview URL, and deploy state",
    },
    EnvVarList: {
      props: z.object({
        project: z.string().nullable(),
        environment: deployEnvironment.nullable(),
        names: z.array(z.string()).min(1).max(40),
      }),
      description:
        "Environment variable NAMES only for a Vercel project — never values or secrets",
    },
    DomainList: {
      props: z.object({
        project: z.string().nullable(),
        domains: z.array(domainItem).min(1).max(20),
      }),
      description: "Custom domains for a Vercel project",
    },
    SlowQueryList: {
      props: z.object({
        project: z.string().nullable(),
        items: z.array(slowQueryItem).min(1).max(10),
      }),
      description: "Slow Neon/Postgres queries (SQL truncated in UI)",
    },
    RepoPick: {
      props: pickCardProps,
      description:
        "Which GitHub repo to work in: named pick, reason, and 2–6 options",
    },
    ProjectPick: {
      props: pickCardProps,
      description:
        "Which Vercel project to use: named pick, reason, and 2–6 options",
    },
    NeonBranchPick: {
      props: pickCardProps,
      description:
        "Which Neon branch/database to use: named pick, reason, and 2–6 options",
    },
    PhotoEditSettings: {
      props: z.object({
        title: z.string().nullable(),
        image: z.string().nullable(),
        groups: z.array(settingsGroup).min(1).max(4),
      }),
      description:
        "Presentational photo grade/settings sheet (not an editor): optional preview image and labeled groups",
    },
    MusicProdSettings: {
      props: z.object({
        title: z.string().nullable(),
        project: z.string().nullable(),
        bpm: z.string().nullable(),
        key: z.string().nullable(),
        tracks: z.array(musicTrack).nullable(),
        groups: z.array(settingsGroup).nullable(),
      }),
      description:
        "Presentational music production / mix settings: project meta, tracks, optional bus/FX groups",
    },
    VideoStoryboard: {
      props: z.object({
        title: z.string().nullable(),
        aspect: z.enum(["16:9", "9:16", "1:1"]).nullable(),
        frames: z.array(storyboardFrame).min(2).max(12),
      }),
      description:
        "Video storyboard: horizontal sequence of frames with optional image, beat, and duration",
    },
    IndicatorCard: {
      props: z.object({
        title: z.string(),
        source: z.string().nullable(),
        unit: z.string().nullable(),
        value: z.string().nullable(),
        delta: z.string().nullable(),
        asOf: z.string().nullable(),
        points: z.array(z.number()).nullable(),
        regions: z.array(indicatorRegion).nullable(),
        rows: z.array(indicatorRow).nullable(),
      }),
      description:
        "OWID / census-style indicator: headline value with optional sparkline, region bars, and/or rows (include at least one of points, regions, rows)",
    },
    Slides: {
      props: z.object({
        title: z.string().nullable(),
        theme: z.string().nullable(),
        slides: z.array(slideItem).min(2).max(12),
        index: z.number().nullable(),
      }),
      description:
        "In-thread slide deck: current slide by index plus strip of others (title, bullets, optional image)",
    },
    PdfArtifact: {
      props: z.object({
        title: z.string(),
        src: z.string().nullable(),
        pages: z.string().nullable(),
        size: z.string().nullable(),
        updated: z.string().nullable(),
      }),
      description:
        "PDF artifact receipt with meta; embed or open when src is an https PDF URL",
    },
    ChessBoard: {
      props: z.object({
        fen: z.string(),
        title: z.string().nullable(),
        orientation: z.enum(["white", "black"]).nullable(),
        lastMove: z.string().nullable(),
        moves: z.array(z.string()).nullable(),
      }),
      description:
        "Chess position from FEN with optional last-move highlight (UCI) and move list",
    },
    TerminalBlock: {
      props: z.object({
        command: z.string(),
        lines: z.array(z.string()),
        stderr: z.array(z.string()).nullable(),
        cwd: z.string().nullable(),
        exitCode: z.number().nullable(),
        durationMs: z.number().nullable(),
        truncated: z.boolean().nullable(),
        visibleCount: z.number().nullable(),
        done: z.boolean().nullable(),
        maxCollapsedLines: z.number().nullable(),
        variant: z.enum(["paper", "ink"]).nullable(),
      }),
      description:
        "Command terminal block: header with cwd/command/exit/duration and stdout/stderr lines (assistant-ui TerminalBlock-shaped)",
    },
    AudioPlayback: {
      props: z.object({
        title: z.string().nullable(),
        src: z.string(),
        artist: z.string().nullable(),
        duration: z.string().nullable(),
        poster: z.string().nullable(),
      }),
      description:
        "Inline audio clip from an https URL with optional title, artist, duration, and poster",
    },
    Model3D: {
      props: z.object({
        src: z.string(),
        title: z.string().nullable(),
        caption: z.string().nullable(),
        poster: z.string().nullable(),
        autoRotate: z.boolean().nullable(),
      }),
      description:
        "Interactive 3D model from an https .glb/.gltf URL with optional poster and auto-rotate",
    },
    WebPreview: {
      props: z.object({
        url: z.string(),
        title: z.string().nullable(),
      }),
      description:
        "Sandboxed live web preview chrome (reload, origin bar, open) around an https URL",
    },
    Timeline: {
      props: z.object({
        events: z.array(timelineEvent).min(2).max(12),
        visibleCount: z.number().nullable(),
      }),
      description:
        "Event timeline on a vertical axis with past/now/future dots (not session tool chrome)",
    },
    ComparisonCard: {
      props: z.object({
        traitLabels: z.array(z.string()).min(1).max(8),
        options: z.array(comparisonOption).min(2).max(3),
        recommendedId: z.string(),
        reason: z.string(),
      }),
      description:
        "Side-by-side option comparison with trait checklist, named pick, and reason (not ComparisonBar %)",
    },
    MathBlock: {
      props: z.object({
        label: z.string().nullable(),
        steps: z.array(mathStep).min(1).max(12),
        visibleSteps: z.number().nullable(),
      }),
      description:
        "Worked math derivation: plain-text expression steps with optional notes",
    },
    ScoreBreakdown: {
      props: z.object({
        verdict: z.string(),
        total: z.number(),
        outOf: z.number(),
        criteria: z.array(scoreCriterion).min(1).max(12),
        visibleCount: z.number().nullable(),
      }),
      description:
        "Score verdict with total/outOf pill and weighted criteria bars",
    },
  },
  actions: {
    reply: {
      params: z.object({
        message: z.string(),
      }),
      description:
        "Send message as the user's next chat turn when a Button is pressed",
    },
  },
});

export type ChatCatalog = typeof chatCatalog;

export const JSON_RENDER_CUSTOM_RULES = [
  "Emit a UI spec for structured answers of these kinds: web/product search, location or place maps, news briefs, daily multi-story briefs, encyclopedia entries, pronunciation, foreign-language phrases, guitar chords, music theory, vote or regional charts, sparkline charts, spec sheets, Mermaid diagrams, tables, explainers, recipes, flight tracking, calendar events, table bookings, email drafts/batches, surf/snow reports and picks, video, Vercel/GitHub/Neon status, photo/music settings, storyboards, OWID/census indicators, slides, PDF artifacts, chess, terminal output, audio clips, 3D models, sandboxed web previews, event timelines, option comparisons, math derivations, and score breakdowns. Ordinary replies and exploratory thinking-together turns stay prose with no spec.",
  "At most one spec per reply. Prefer a ```spec fence. Always use Card as the root element; put the specialized component (SearchResults, PlaceMap, NewsBrief, DailyBrief, Encyclopedia, Pronounce, Phrase, GuitarChord, TheoryBoard, RegionChart, Chart, SpecSheet, MermaidDiagram, Table, Explainer, Recipe, ComparisonBar, FlightTracker, CalendarEvent, CreateEvent, Booking, EmailDraft, EmailBatch, SurfReport, SurfSpotPick, SnowReport, MountainPick, Video, VercelProject, DeploymentStatus, DeploymentList, PullRequest, PullRequestList, Issue, IssueList, NeonProject, NeonBranch, SchemaOverview, ShipStatus, EnvVarList, DomainList, SlowQueryList, RepoPick, ProjectPick, NeonBranchPick, PhotoEditSettings, MusicProdSettings, VideoStoryboard, IndicatorCard, Slides, PdfArtifact, ChessBoard, TerminalBlock, AudioPlayback, Model3D, WebPreview, Timeline, ComparisonCard, MathBlock, ScoreBreakdown) inside it.",
  "For two-way % races prefer ComparisonBar; for multi-region shares use RegionChart; for a single metric series use Chart; for OWID/census use IndicatorCard. Use ComparisonCard for two options with traits and a named pick (not %). Use Timeline for past/now/future event axes (not session tool chrome). Use MathBlock for worked expression steps; ScoreBreakdown for rubric verdicts. Use Model3D for https GLB/glTF; WebPreview for sandboxed https live previews. Use ChessBoard for FEN; TerminalBlock for command output; AudioPlayback for https audio. Keep 1–2 sentences of prose outside the fence.",
  "EmailDraft, EmailBatch, CreateEvent, and Booking include built-in confirm buttons that reply with tool-ready messages. When the user sends those confirmations, call create_gmail_draft / send_gmail_message / apply_mail_batch or the calendar create path immediately with the stated params (approvals still apply).",
  "EnvVarList must list variable NAMES only — never values, secrets, or connection strings. NeonBranch.endpointHost is a hostname only.",
  "Buttons that continue the conversation must bind press to the reply action with a concrete message string. Do not invent component names outside this catalog.",
  "Image, Video, PdfArtifact, AudioPlayback, Model3D, and WebPreview URLs must be https. Prefer the dedicated answer components over assembling the same layout from Stack/Text alone.",
] as const;

/** System prompt fragment for the eve chat channel (inline generative UI). */
export function chatJsonRenderPrompt(): string {
  return chatCatalog.prompt({
    mode: "inline",
    customRules: [...JSON_RENDER_CUSTOM_RULES],
  });
}
