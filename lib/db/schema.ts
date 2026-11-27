import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import type { ClientSessionState, SessionStreamEvent } from "eve/client";
import type {
  PearlAutomationTriggerConfig,
  PearlAutomationTriggerKind,
} from "@/lib/automations/types";
import type { SpokenTurn } from "@/lib/chat/spoken-turns";

export type {
  PearlAutomationTriggerConfig,
  PearlAutomationTriggerKind,
};

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Temporary guest from better-auth anonymous sign-in. Linked onto a real
  // account at sign-up / sign-in; then the guest row is deleted.
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  // Free pass: no Stripe subscription, no usage invoice, no spend cap.
  // Backfilled true for every row that existed when billing shipped; new
  // accounts default false and must subscribe.
  billingExempt: boolean("billing_exempt").notNull().default(false),
  // Computer Use sandbox knobs. Defaults match the previous hardcoded opens.
  sandboxBrowserTimeoutMinutes: integer("sandbox_browser_timeout_minutes")
    .notNull()
    .default(30),
  sandboxBrowserVcpus: integer("sandbox_browser_vcpus").notNull().default(2),
  sandboxCoderTimeoutMinutes: integer("sandbox_coder_timeout_minutes")
    .notNull()
    .default(45),
  sandboxCoderVcpus: integer("sandbox_coder_vcpus").notNull().default(4),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  // better-auth 1.7 scopes accounts by issuer; credential accounts use
  // "local:credential" and OAuth accounts use the provider's issuer URL.
  issuer: text("issuer").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chat = pgTable(
  "chat",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New chat"),
    eveSession: jsonb("eve_session").$type<ClientSessionState | null>(),
    pendingUserMessage: text("pending_user_message"),
    pendingUserMessageCreatedAt: timestamp("pending_user_message_created_at"),
    // Live collaborative browser (separate from the eve file sandbox).
    // Name is the Vercel Sandbox id; the secret authenticates the viewer URL
    // and agent control HTTP. Never return the secret in chat list payloads.
    browserSandboxName: text("browser_sandbox_name"),
    browserControlSecret: text("browser_control_secret"),
    // screen-relay desktop sandbox (port 8080). viewerUrl includes #token=
    // and must never appear in model-visible tool results or chat lists.
    desktopSandboxName: text("desktop_sandbox_name"),
    desktopViewerUrl: text("desktop_viewer_url"),
    // Optional project workspace. Deleting a project unlinks chats
    // (set null) so history remains in the sidebar. Late reference: the
    // project table is declared below.
    projectId: text("project_id").references((): AnyPgColumn => project.id, {
      onDelete: "set null",
    }),
    // Optional goal. Deleting a goal unlinks the chat (set null). Late
    // reference: project_goal is declared below.
    goalId: text("goal_id").references((): AnyPgColumn => projectGoal.id, {
      onDelete: "set null",
    }),
    // Live sandbox / Expo simulator preview URLs for the Computer tab.
    // Shape: WorkbenchPreview[] from lib/workbench/types.
    previews: jsonb("previews")
      .$type<
        Array<{
          kind: "dev-server" | "expo-simulator";
          url: string;
          label: string;
          repoFullName: string | null;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    // Last time the owner opened this chat (unread = settle after this).
    lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
    // Live voice lines waiting to join eve history on the next real send.
    spokenTurns: jsonb("spoken_turns")
      .$type<SpokenTurn[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    // Session-free quick-path lines waiting to join eve history on escalate.
    quickTurns: jsonb("quick_turns")
      .$type<
        Array<{
          id: string;
          role: "user" | "assistant";
          text: string;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    // Connected remote eve agent this thread is talking through (null = Pearl).
    // Late reference: connected_agent is declared below.
    remoteAgentId: text("remote_agent_id").references(
      (): AnyPgColumn => connectedAgent.id,
      { onDelete: "set null" },
    ),
    // User-defined custom agent this thread belongs to (null = normal chat).
    // Unique: each custom agent has exactly one durable thread. Late
    // reference: custom_agent is declared below.
    customAgentId: text("custom_agent_id").references(
      (): AnyPgColumn => customAgent.id,
      { onDelete: "cascade" },
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_chat_user_updated").on(table.userId, table.updatedAt),
    index("idx_chat_user_created").on(table.userId, table.createdAt),
    index("idx_chat_project").on(table.projectId),
    index("idx_chat_goal").on(table.goalId),
    index("idx_chat_remote_agent").on(table.remoteAgentId),
    uniqueIndex("idx_chat_custom_agent").on(table.customAgentId),
    // Lookup chats from eve hooks by durable session id (jsonb path).
    index("idx_chat_eve_session_id").using(
      "btree",
      sql`(${table.eveSession} ->> 'sessionId')`,
    ),
  ],
);

export const chatEvent = pgTable(
  "chat_event",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    eventIndex: integer("event_index").notNull(),
    event: jsonb("event").$type<SessionStreamEvent>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_chat_event_chat").on(table.chatId),
    uniqueIndex("idx_chat_event_chat_index").on(table.chatId, table.eventIndex),
  ],
);

export type Chat = typeof chat.$inferSelect;
export type ChatEvent = typeof chatEvent.$inferSelect;

// Durable copy of files the agent writes into its session sandbox. Keyed by
// chat + sandbox path so later turns, new sessions, and the web UI can read
// them after the ephemeral sandbox is gone.
export const agentFile = pgTable(
  "agent_file",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    // Reference to the durable Blob object holding the current content. Null
    // only for legacy rows written before blob-primary sync (their content
    // lives here) or writes that fell back when the Blob store was
    // unreachable.
    blobPathname: text("blob_pathname"),
    content: text("content"),
    byteLength: integer("byte_length").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_agent_file_chat").on(table.chatId),
    uniqueIndex("idx_agent_file_chat_path").on(table.chatId, table.path),
  ],
);

export type AgentFile = typeof agentFile.$inferSelect;

// Append-only history for agent files: every write_file/edit_file save
// records the new content as the next revision for its (chat, path). The
// agent_file row stays the "current" lookup; revisions are the audit trail
// that lets the UI show a real version number and, later, time-travel.
export const agentFileRevision = pgTable(
  "agent_file_revision",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    revision: integer("revision").notNull(),
    content: text("content").notNull(),
    byteLength: integer("byte_length").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_agent_file_revision_chat_path").on(table.chatId, table.path),
    uniqueIndex("idx_agent_file_revision_version").on(
      table.chatId,
      table.path,
      table.revision,
    ),
  ],
);

export type AgentFileRevision = typeof agentFileRevision.$inferSelect;

// Uploaded attachment archive: the original goes to Vercel Blob (private
// store); extracted PDF text is stored per page so the agent can read large
// documents through paged tool calls instead of one giant inline payload.
export const agentAttachment = pgTable(
  "agent_attachment",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mediaType: text("media_type").notNull(),
    byteLength: integer("byte_length").notNull(),
    blobUrl: text("blob_url"),
    pdfType: text("pdf_type"),
    pageCount: integer("page_count"),
    /** Per-page extracted markdown: [{ page, markdown }]. */
    pages: jsonb("pages").$type<Array<{ page: number; markdown: string }>>(),
    extractionNote: text("extraction_note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_agent_attachment_user").on(table.userId)],
);

export type AgentAttachment = typeof agentAttachment.$inferSelect;

// Idempotency ledger for destructive tools: the execution key is stable for
// (tool, logical operation) — either an explicit idempotency key or a hash of
// the operation's identity. A replayed call finds its key here and must not
// re-fire the side effect; `pending` rows are how a crash between "side
// effect sent" and "result recorded" is detected instead of hidden.
export const agentToolExecution = pgTable("agent_tool_execution", {
  executionKey: text("execution_key").primaryKey(),
  toolName: text("tool_name").notNull(),
  status: text("status").notNull(), // pending | succeeded | failed
  detail: text("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AgentToolExecution = typeof agentToolExecution.$inferSelect;
export type User = typeof user.$inferSelect;

// Areas are the enduring structure of the user's life (areas of stewardship,
// never "completed"): Health, Relationships → Family …, Career → Tonic,
// Finances, Home. Issues attach to them. See
// docs/issues-areas-plan.md for the conceptual model.
export const area = pgTable(
  "area",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    properties: jsonb("properties").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    // Self-reference: the tree is flat rows; depth is derived at read time.
    // Deleting a parent cascades to descendants (the server action refuses
    // the delete while open issues exist anywhere in the subtree).
    parentId: text("parent_id").references((): AnyPgColumn => area.id, {
      onDelete: "cascade",
    }),
    sortIndex: integer("sort_index").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_area_user").on(table.userId),
    // Sibling names are unique (NULL parent = top level). This is what makes
    // the default-tree seed race-safe: concurrent seeds conflict and no-op.
    uniqueIndex("idx_area_sibling_name").on(
      table.userId,
      sql`coalesce(${table.parentId}, '__root__')`,
      table.name,
    ),
  ],
);

export type Area = typeof area.$inferSelect;

// An Issue is an unresolved thing within an area that requires future
// before it can be considered settled — not a task, not a project. Lifecycle
// beyond open/resolved is derived from the two dates (see lib/issues.ts):
// Captured → Dormant → Active → Resolved.
export const issue = pgTable(
  "issue",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    areaId: text("area_id")
      .notNull()
      .references(() => area.id, { onDelete: "cascade" }),
    // Optional project workspace. Deleting a project unfiles the task back
    // to the inbox (set null). Late reference: project is declared below.
    projectId: text("project_id").references((): AnyPgColumn => project.id, {
      onDelete: "set null",
    }),
    // Optional goal. Deleting a goal unfiles the task (set null). Late
    // reference: project_goal is declared below.
    goalId: text("goal_id").references((): AnyPgColumn => projectGoal.id, {
      onDelete: "set null",
    }),
    status: text("status", { enum: ["open", "resolved"] })
      .notNull()
      .default("open"),
    // Calendar dates on purpose: "due soon" must not become a time-zone bug.
    // dueDate — when this needs to be resolved; reviewDate — when it should
    // return to attention (the system's contract to resurface it).
    dueDate: date("due_date"),
    reviewDate: date("review_date"),
    // Provenance when spawned from a reusable task list. Deleting the list
    // or item clears these (set null) so the issue itself remains.
    listId: text("list_id").references((): AnyPgColumn => taskList.id, {
      onDelete: "set null",
    }),
    listItemId: text("list_item_id").references(
      (): AnyPgColumn => taskListItem.id,
      { onDelete: "set null" },
    ),
    listOccurrence: date("list_occurrence"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    index("idx_issue_user_status").on(table.userId, table.status),
    index("idx_issue_user_project").on(table.userId, table.projectId),
    index("idx_issue_user_goal").on(table.userId, table.goalId),
    index("idx_issue_list_item_open").on(table.listItemId, table.status),
    uniqueIndex("idx_issue_list_item_occurrence")
      .on(table.listItemId, table.listOccurrence)
      .where(
        sql`${table.listItemId} is not null and ${table.listOccurrence} is not null`,
      ),
  ],
);

export type Issue = typeof issue.$inferSelect;

// Mini apps the builder subagent creates: one private GitHub repo, one fx
// session, one named Vercel Sandbox, and one production URL for the viewer.
export const miniApp = pgTable(
  "mini_app",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    // Null until publish_app creates the pearl-* GitHub repo. Drafts can
    // code in a Vercel Sandbox before GitHub is connected.
    githubOwner: text("github_owner"),
    githubRepo: text("github_repo"),
    fxSessionId: text("fx_session_id"),
    sandboxName: text("sandbox_name").notNull(),
    vercelProjectId: text("vercel_project_id"),
    productionUrl: text("production_url"),
    // Live sandbox draft preview (https://*.vercel.run) while building.
    previewUrl: text("preview_url"),
    previewPort: integer("preview_port").notNull().default(3000),
    status: text("status", {
      enum: ["draft", "building", "published", "failed"],
    })
      .notNull()
      .default("draft"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_mini_app_user").on(table.userId),
    uniqueIndex("idx_mini_app_user_slug").on(table.userId, table.slug),
    uniqueIndex("idx_mini_app_github").on(table.githubOwner, table.githubRepo),
  ],
);

export type MiniApp = typeof miniApp.$inferSelect;
export type MiniAppStatus = MiniApp["status"];

/** Sibling text files for a packaged user skill (rules/, references/, …). */
export type UserSkillFiles = Record<string, string>;

export type UserSkillSource = "custom" | "registry";

// Per-user skills loaded at turn start through eve's dynamic skill resolver.
// Filesystem skills under agent/skills/ stay the shared defaults; these rows
// are principal-scoped and never written into the project tree.
export const userSkill = pgTable(
  "user_skill",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    markdown: text("markdown").notNull(),
    files: jsonb("files").$type<UserSkillFiles>().notNull().default(sql`'{}'::jsonb`),
    enabled: boolean("enabled").notNull().default(true),
    source: text("source", { enum: ["custom", "registry"] })
      .notNull()
      .default("custom"),
    // skills.sh item name, e.g. vercel-labs/agent-skills/vercel-react-best-practices
    registryName: text("registry_name"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_user_skill_user").on(table.userId),
    uniqueIndex("idx_user_skill_user_slug").on(table.userId, table.slug),
    uniqueIndex("idx_user_skill_user_registry").on(
      table.userId,
      table.registryName,
    ),
  ],
);

export type UserSkill = typeof userSkill.$inferSelect;

// Structured identity profile for fit/health/home context. Loaded on demand
// via get_profile — not auto-injected into every turn like file memory.
export const userProfile = pgTable("user_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  birthdate: date("birthdate"),
  nationality: text("nationality"),
  height: text("height"),
  eyeColor: text("eye_color"),
  hairColor: text("hair_color"),
  skinTone: text("skin_tone"),
  weight: text("weight"),
  build: text("build"),
  gender: text("gender"),
  measurements: text("measurements"),
  healthNotes: text("health_notes"),
  primaryResidence: text("primary_residence"),
  additionalHomes: text("additional_homes"),
  planPreferences: text("plan_preferences"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserProfile = typeof userProfile.$inferSelect;

export type ProjectStatus =
  | "backlog"
  | "planned"
  | "in_progress"
  | "completed"
  | "canceled";

export type ProjectPriority =
  | "none"
  | "urgent"
  | "high"
  | "medium"
  | "low";

// Projects are workspaces for a body of work that outlives one chat:
// shared instructions, related chats, goals, notes, and files. Separate from
// Areas (the life tree Issues attach to).
export const project = pgTable(
  "project",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    instructions: text("instructions").notNull().default(""),
    status: text("status", {
      enum: ["backlog", "planned", "in_progress", "completed", "canceled"],
    })
      .notNull()
      .default("backlog")
      .$type<ProjectStatus>(),
    priority: text("priority", {
      enum: ["none", "urgent", "high", "medium", "low"],
    })
      .notNull()
      .default("none")
      .$type<ProjectPriority>(),
    startDate: date("start_date"),
    targetDate: date("target_date"),
    /** Vercel Drive name shared by every agent sandbox in this project. Lazy. */
    driveName: text("drive_name"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_project_user").on(table.userId),
    uniqueIndex("idx_project_user_name").on(table.userId, table.name),
  ],
);

export type Project = typeof project.$inferSelect;

export type CapabilityKind = "skill" | "product" | "service";
export type CapabilityStatus = "active" | "exploring" | "archived";

// Marketable skills, products, and services the user can sell. Separate from
// file memory (unstructured facts), user_profile (identity/fit/home), and
// user_skill (agent playbooks). Loaded as a short index each turn; full
// fields via list_capabilities / save_capability.
export const capability = pgTable(
  "capability",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind", {
      enum: ["skill", "product", "service"],
    })
      .notNull()
      .$type<CapabilityKind>(),
    summary: text("summary").notNull(),
    audience: text("audience"),
    proof: text("proof"),
    status: text("status", {
      enum: ["active", "exploring", "archived"],
    })
      .notNull()
      .default("active")
      .$type<CapabilityStatus>(),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_capability_user").on(table.userId),
    index("idx_capability_user_status").on(table.userId, table.status),
    // Case-insensitive name uniqueness so a second save updates the same row.
    uniqueIndex("idx_capability_user_name").on(
      table.userId,
      sql`lower(${table.name})`,
    ),
  ],
);

export type Capability = typeof capability.$inferSelect;

export type TaskListCadence = "daily" | "weekly" | "monthly";

// Reusable checklists (packing, apartment maintenance). Checking an item
// only marks the list copy; a schedule (or manual spawn) materializes each
// item as a normal issue in the inbox.
export const taskList = pgTable(
  "task_list",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Where spawned tasks file. Null = Inbox (no project).
    projectId: text("project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    // Null cadence = manual only (no cron spawn).
    cadence: text("cadence", { enum: ["daily", "weekly", "monthly"] }),
    // 0 = Sunday … 6 = Saturday; used when cadence is weekly.
    weekday: integer("weekday"),
    // 1–28; used when cadence is monthly (capped so short months stay even).
    monthDay: integer("month_day"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_task_list_user").on(table.userId),
    index("idx_task_list_scheduled").on(table.userId, table.cadence),
  ],
);

export type TaskList = typeof taskList.$inferSelect;

export const taskListItem = pgTable(
  "task_list_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    listId: text("list_id")
      .notNull()
      .references(() => taskList.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    sortIndex: integer("sort_index").notNull().default(0),
    // Null when unchecked; set when the user ticks the checklist copy.
    checkedAt: timestamp("checked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_task_list_item_list").on(table.listId, table.sortIndex)],
);

export type TaskListItem = typeof taskListItem.$inferSelect;

/** Expo push tokens registered by the mobile app for reply / HITL alerts. */
export const devicePushToken = pgTable(
  "device_push_token",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_device_push_token_user").on(table.userId),
    uniqueIndex("idx_device_push_token_token").on(table.token),
  ],
);

export type DevicePushToken = typeof devicePushToken.$inferSelect;

/**
 * Live client presence for push gating. Mobile uses the Expo push token as
 * clientKey; web uses a per-tab id. Heartbeats refresh updatedAt while the
 * surface is visible; background/unmount posts state=background immediately.
 */
export const clientAttention = pgTable(
  "client_attention",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    surface: text("surface").notNull(),
    clientKey: text("client_key").notNull(),
    state: text("state").notNull(),
    chatId: text("chat_id"),
    sessionId: text("session_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_client_attention_user").on(table.userId),
    uniqueIndex("idx_client_attention_user_surface_key").on(
      table.userId,
      table.surface,
      table.clientKey,
    ),
  ],
);

export type ClientAttention = typeof clientAttention.$inferSelect;

/**
 * At-most-once gate for mobile push: hooks are at-least-once, so a retried
 * step must not send a second banner for the same turn boundary.
 */
export const pushDelivery = pgTable(
  "push_delivery",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sessionId: text("session_id").notNull(),
    turnId: text("turn_id").notNull(),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_push_delivery_session_turn_kind").on(
      table.sessionId,
      table.turnId,
      table.kind,
    ),
  ],
);

export type PushDelivery = typeof pushDelivery.$inferSelect;

/**
 * Paying-user billing state. Free-pass users have no row here. Access to the
 * agent for a non-exempt user requires status "active" (or "trialing").
 */
export const billingAccount = pgTable(
  "billing_account",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null for Apple-only subscribers until they enable web usage billing. */
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    status: text("status").notNull().default("incomplete"),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    usageCapCents: integer("usage_cap_cents").notNull().default(10_000),
    metronomeCustomerId: text("metronome_customer_id"),
    /** `stripe` | `apple` — which store owns the base subscription. */
    paymentProvider: text("payment_provider").notNull().default("stripe"),
    appleOriginalTransactionId: text("apple_original_transaction_id"),
    appleProductId: text("apple_product_id"),
    appleEnvironment: text("apple_environment"),
    /** Prepaid usage credits from Apple consumable packs (does not reset monthly). */
    prepaidCreditCents: integer("prepaid_credit_cents").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_billing_account_stripe_customer").on(
      table.stripeCustomerId,
    ),
    uniqueIndex("idx_billing_account_stripe_subscription").on(
      table.stripeSubscriptionId,
    ),
    uniqueIndex("idx_billing_account_apple_original").on(
      table.appleOriginalTransactionId,
    ),
  ],
);

export type BillingAccount = typeof billingAccount.$inferSelect;

/**
 * Redeemed Apple IAP transaction ids (subscription renewals + consumables).
 * Idempotency for verify + App Store Server Notifications.
 */
export const appleIapTransaction = pgTable(
  "apple_iap_transaction",
  {
    transactionId: text("transaction_id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    /** `subscription` | `consumable` */
    kind: text("kind").notNull(),
    creditCents: integer("credit_cents").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_apple_iap_transaction_user").on(table.userId),
  ],
);

export type AppleIapTransaction = typeof appleIapTransaction.$inferSelect;

export type UsageEventSource =
  | "model"
  | "exa_agent"
  | "web_search"
  | "sandbox"
  | "image";

/**
 * Append-only usage ledger. Cap enforcement and the Usage page read this
 * table. Metronome ingest uses the same idempotency key as transaction_id.
 * Free-pass rows stay local (billable=false) and are never ingested.
 */
export const usageEvent = pgTable(
  "usage_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    idempotencyKey: text("idempotency_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start").notNull(),
    source: text("source").notNull(),
    /**
     * Exact spend in microdollars (1 USD = 1_000_000). Source of truth for
     * totals; `costCents` is a rounded mirror for Metronome / legacy caps.
     */
    costMicros: integer("cost_micros").notNull().default(0),
    costCents: integer("cost_cents").notNull(),
    billable: boolean("billable").notNull().default(true),
    ingestedAt: timestamp("ingested_at"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_usage_event_idempotency").on(table.idempotencyKey),
    index("idx_usage_event_user_period").on(
      table.userId,
      table.periodStart,
      table.createdAt,
    ),
    index("idx_usage_event_pending_ingest").on(
      table.billable,
      table.ingestedAt,
    ),
  ],
);

export type UsageEvent = typeof usageEvent.$inferSelect;

/**
 * In-flight spend reservations so two concurrent turns cannot both clear a
 * near-cap check. Released (deleted or zeroed) when the real cost lands.
 */
export const usageReservation = pgTable(
  "usage_reservation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start").notNull(),
    cents: integer("cents").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    index("idx_usage_reservation_user_period").on(
      table.userId,
      table.periodStart,
    ),
  ],
);

export type UsageReservation = typeof usageReservation.$inferSelect;

/**
 * Active billable sandboxes. Survives process restarts / multi-instance so
 * `noteSandboxStopped` can still charge duration when the opener was another
 * isolate.
 */
export const sandboxOpen = pgTable(
  "sandbox_open",
  {
    sandboxId: text("sandbox_id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    openedAt: timestamp("opened_at").notNull(),
    vcpus: integer("vcpus").notNull().default(2),
    label: text("label").notNull().default("sandbox"),
  },
  (table) => [index("idx_sandbox_open_user").on(table.userId)],
);

export type SandboxOpen = typeof sandboxOpen.$inferSelect;

/** Nearby term and how this concept differs from it. */
export type ConceptSchemaDistinction = {
  readonly term: string;
  readonly difference: string;
};

export type ConceptSchemaStatus = "active" | "retired";

/**
 * Account-scoped concept definition. One current row per user + slug.
 * Bodies are loaded on demand via schema tools — never injected every turn.
 */
export const conceptSchema = pgTable(
  "concept_schema",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    statement: text("statement").notNull(),
    includes: jsonb("includes")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    excludes: jsonb("excludes")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    distinctions: jsonb("distinctions")
      .$type<ConceptSchemaDistinction[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    examples: jsonb("examples")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    nonExamples: jsonb("non_examples")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: text("status", { enum: ["active", "retired"] })
      .notNull()
      .default("active"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_concept_schema_user").on(table.userId),
    uniqueIndex("idx_concept_schema_user_slug").on(table.userId, table.slug),
    index("idx_concept_schema_user_status").on(table.userId, table.status),
  ],
);

export type ConceptSchema = typeof conceptSchema.$inferSelect;

/**
 * Snapshot of a concept schema after an approved create or update.
 * Retire records a revision with the last active body at that version.
 */
export const conceptSchemaRevision = pgTable(
  "concept_schema_revision",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    schemaId: text("schema_id")
      .notNull()
      .references(() => conceptSchema.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    statement: text("statement").notNull(),
    includes: jsonb("includes")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    excludes: jsonb("excludes")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    distinctions: jsonb("distinctions")
      .$type<ConceptSchemaDistinction[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    examples: jsonb("examples")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    nonExamples: jsonb("non_examples")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: text("status", { enum: ["active", "retired"] }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_concept_schema_revision_schema").on(table.schemaId),
    uniqueIndex("idx_concept_schema_revision_schema_version").on(
      table.schemaId,
      table.version,
    ),
  ],
);

export type ConceptSchemaRevision = typeof conceptSchemaRevision.$inferSelect;

/**
 * GitHub repos the signed-in user pinned for the phone workbench.
 * Linked onto projects via `project_pin` so a project can be a multi-repo workspace.
 */
export const workbenchPin = pgTable(
  "workbench_pin",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    vercelProjectId: text("vercel_project_id"),
    vercelTeamId: text("vercel_team_id"),
    expoProjectId: text("expo_project_id"),
    expoUpdateChannel: text("expo_update_channel"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_workbench_pin_user").on(table.userId),
    uniqueIndex("idx_workbench_pin_user_owner_name").on(
      table.userId,
      table.owner,
      table.name,
    ),
  ],
);

export type WorkbenchPinRow = typeof workbenchPin.$inferSelect;

/**
 * Links workbench pins onto a project. A pin may belong to multiple projects;
 * a project may have many pins.
 */
export const projectPin = pgTable(
  "project_pin",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    pinId: text("pin_id")
      .notNull()
      .references(() => workbenchPin.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_project_pin_project").on(table.projectId),
    index("idx_project_pin_pin").on(table.pinId),
    uniqueIndex("idx_project_pin_project_pin").on(table.projectId, table.pinId),
  ],
);

export type ProjectPin = typeof projectPin.$inferSelect;

/**
 * Links principal-scoped Library artifacts (Blob pathnames) onto a project.
 * Artifacts themselves live in Vercel Blob; this is the join only.
 */
export const projectArtifact = pgTable(
  "project_artifact",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    pathname: text("pathname").notNull(),
    title: text("title").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_project_artifact_project").on(table.projectId),
    index("idx_project_artifact_user").on(table.userId),
    uniqueIndex("idx_project_artifact_project_pathname").on(
      table.projectId,
      table.pathname,
    ),
  ],
);

export type ProjectArtifact = typeof projectArtifact.$inferSelect;

/** External URL resources filed on a project (docs, dashboards, etc.). */
export const projectLink = pgTable(
  "project_link",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_project_link_project").on(table.projectId),
    index("idx_project_link_user").on(table.userId),
  ],
);

export type ProjectLink = typeof projectLink.$inferSelect;

export type ProjectGoalStatus = "active" | "done";

/** Trackable outcomes for a project workspace (distinct from Tasks/Issues). */
export const projectGoal = pgTable(
  "project_goal",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Null = standalone (inbox). Deleting a project unfiles the goal.
    projectId: text("project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    status: text("status", { enum: ["active", "done"] })
      .notNull()
      .default("active")
      .$type<ProjectGoalStatus>(),
    targetDate: date("target_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_project_goal_project").on(table.projectId),
    index("idx_project_goal_user").on(table.userId),
    index("idx_project_goal_project_status").on(table.projectId, table.status),
  ],
);

export type ProjectGoal = typeof projectGoal.$inferSelect;

/** Freeform markdown notes — standalone or filed on a project. */
export const projectNote = pgTable(
  "project_note",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Null = standalone. Deleting a project unfiles the note.
    projectId: text("project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    // Optional goal. Deleting a goal unfiles the note (set null).
    goalId: text("goal_id").references(() => projectGoal.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    markdown: text("markdown").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_project_note_project").on(table.projectId),
    index("idx_project_note_goal").on(table.goalId),
    index("idx_project_note_user").on(table.userId),
  ],
);

export type ProjectNote = typeof projectNote.$inferSelect;

/** Fixed palette for project labels (persisted as these tokens). */
export type ProjectLabelColor =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink";

/** Per-user label catalog for projects. */
export const projectLabel = pgTable(
  "project_label",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color", {
      enum: [
        "gray",
        "red",
        "orange",
        "yellow",
        "green",
        "blue",
        "purple",
        "pink",
      ],
    })
      .notNull()
      .default("gray")
      .$type<ProjectLabelColor>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_project_label_user").on(table.userId),
    uniqueIndex("idx_project_label_user_name").on(
      table.userId,
      sql`lower(${table.name})`,
    ),
  ],
);

export type ProjectLabel = typeof projectLabel.$inferSelect;

/** Many-to-many: projects ↔ labels. */
export const projectLabelAssignment = pgTable(
  "project_label_assignment",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    labelId: text("label_id")
      .notNull()
      .references(() => projectLabel.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_project_label_assignment_project").on(table.projectId),
    index("idx_project_label_assignment_label").on(table.labelId),
    index("idx_project_label_assignment_user").on(table.userId),
    uniqueIndex("idx_project_label_assignment_unique").on(
      table.projectId,
      table.labelId,
    ),
  ],
);

export type ProjectLabelAssignment = typeof projectLabelAssignment.$inferSelect;

/**
 * User-saved excerpts from chat replies. Shown in the Library Quotes
 * section. chatId stays nullable so the quote survives chat deletion.
 */
export const libraryQuote = pgTable(
  "library_quote",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    chatId: text("chat_id").references(() => chat.id, {
      onDelete: "set null",
    }),
    // Eve / assistant-ui message id — messages are not a Postgres table.
    messageId: text("message_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_library_quote_user").on(table.userId),
    index("idx_library_quote_user_created").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export type LibraryQuote = typeof libraryQuote.$inferSelect;

/**
 * Gmail mailboxes linked to a Pearl user. Tokens stay in Vercel Connect;
 * this table stores the Connect subject id and a safe display label.
 * The first / legacy mailbox uses subjectId === userId so an existing
 * grant keeps working without reconnecting.
 */
export const mailAccount = pgTable(
  "mail_account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Connect user subject id (userId for legacy, `{userId}:gmail:{id}` otherwise). */
    subjectId: text("subject_id").notNull(),
    emailLabel: text("email_label"),
    nickname: text("nickname"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_mail_account_user").on(table.userId),
    uniqueIndex("idx_mail_account_user_subject").on(
      table.userId,
      table.subjectId,
    ),
  ],
);

export type MailAccountRow = typeof mailAccount.$inferSelect;

export const MAIL_RULE_ACTIONS = [
  "archive",
  "mark_read",
  "label",
] as const;

export type MailRuleAction = (typeof MAIL_RULE_ACTIONS)[number];

/**
 * User-confirmed auto-triage rules. Matching threads are applied without
 * a fresh approval prompt; unmatched threads are only proposed.
 */
export const mailRule = pgTable(
  "mail_rule",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null = apply across every mailbox for this user. */
    mailAccountId: text("mail_account_id").references(() => mailAccount.id, {
      onDelete: "cascade",
    }),
    matchFrom: text("match_from"),
    matchList: text("match_list"),
    matchSubject: text("match_subject"),
    action: text("action", { enum: MAIL_RULE_ACTIONS }).notNull(),
    /** Required when action is `label`. */
    labelId: text("label_id"),
    labelName: text("label_name"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_mail_rule_user").on(table.userId),
    index("idx_mail_rule_account").on(table.mailAccountId),
  ],
);

export type MailRuleRow = typeof mailRule.$inferSelect;

/**
 * iCloud Calendar accounts linked via CalDAV (Apple ID + app-specific
 * password). The password is stored only as AES-GCM ciphertext; never
 * returned to clients.
 */
export const icloudCalendarAccount = pgTable(
  "icloud_calendar_account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Apple ID email used for CalDAV Basic auth. */
    appleId: text("apple_id").notNull(),
    nickname: text("nickname"),
    /** base64(iv || authTag || ciphertext) of the app-specific password. */
    credentialCiphertext: text("credential_ciphertext").notNull(),
    credentialKeyId: text("credential_key_id").notNull().default("v1"),
    /** Cached calendar-home-set URL after successful discovery. */
    calendarHomeUrl: text("calendar_home_url"),
    lastVerifiedAt: timestamp("last_verified_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_icloud_calendar_account_user").on(table.userId),
    uniqueIndex("idx_icloud_calendar_account_user_apple").on(
      table.userId,
      table.appleId,
    ),
  ],
);

export type IcloudCalendarAccountRow =
  typeof icloudCalendarAccount.$inferSelect;

/** Seeded catalog entry for the agent directory (not user-owned). */
export type AgentTemplateMemorySeed = {
  readonly text: string;
};

export type AgentTemplateSkillSeed = {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly markdown: string;
};

export type AgentTemplateRoutineSeed = {
  readonly name: string;
  readonly cron: string;
  readonly timezone: string;
  readonly prompt: string;
};

export type AgentTemplateIntegrationSeed = {
  readonly connectionId: string;
};

export type CustomAgentRole = "manager" | "member";

/**
 * User-defined Pearl personas scoped to a project: name + standing
 * instructions, each with exactly one durable chat (chat.customAgentId).
 * Same Pearl eve agent and tools; project agents share one Vercel Drive.
 * Each project has exactly one manager; other agents are members.
 */
export const customAgent = pgTable(
  "custom_agent",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["manager", "member"] })
      .notNull()
      .default("member")
      .$type<CustomAgentRole>(),
    name: text("name").notNull(),
    instructions: text("instructions").notNull().default(""),
    /** Hex accent for the identity mark (cosmos near-black default). */
    accent: text("accent").notNull().default("#0A0A0A"),
    /** Canadian-style head silhouette: oval | diamond | square | trap. */
    markShape: text("mark_shape").notNull().default("oval"),
    /** Talk kinematics: hinge | lift | chatter. */
    markTalk: text("mark_talk").notNull().default("hinge"),
    /** Eyebrows: none | line. */
    markBrows: text("mark_brows").notNull().default("none"),
    /** Idle gaze: still | wander. */
    markGaze: text("mark_gaze").notNull().default("wander"),
    /** Directory template this agent was added from, when applicable. */
    templateSlug: text("template_slug"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_custom_agent_user").on(table.userId),
    index("idx_custom_agent_project").on(table.projectId),
    uniqueIndex("idx_custom_agent_project_name").on(
      table.projectId,
      table.name,
    ),
    uniqueIndex("idx_custom_agent_project_template").on(
      table.projectId,
      table.templateSlug,
    ),
    uniqueIndex("idx_custom_agent_project_manager")
      .on(table.projectId)
      .where(sql`${table.role} = 'manager'`),
  ],
);

export type CustomAgent = typeof customAgent.$inferSelect;

/**
 * Global directory of agent templates. Seeded in migrations; the app reads
 * these rows — there is no templates folder in the repo.
 */
export const agentTemplate = pgTable(
  "agent_template",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    featured: boolean("featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    instructions: text("instructions").notNull().default(""),
    accent: text("accent").notNull().default("#0A0A0A"),
    markShape: text("mark_shape").notNull().default("oval"),
    markTalk: text("mark_talk").notNull().default("hinge"),
    markBrows: text("mark_brows").notNull().default("none"),
    markGaze: text("mark_gaze").notNull().default("wander"),
    memories: jsonb("memories")
      .$type<AgentTemplateMemorySeed[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    skills: jsonb("skills")
      .$type<AgentTemplateSkillSeed[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    routines: jsonb("routines")
      .$type<AgentTemplateRoutineSeed[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    integrations: jsonb("integrations")
      .$type<AgentTemplateIntegrationSeed[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_agent_template_category").on(table.category, table.sortOrder),
    index("idx_agent_template_featured").on(table.featured, table.sortOrder),
  ],
);

export type AgentTemplate = typeof agentTemplate.$inferSelect;

/** Facts this custom agent already knows (separate from global eve memory). */
export const customAgentMemory = pgTable(
  "custom_agent_memory",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    agentId: text("agent_id")
      .notNull()
      .references(() => customAgent.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("idx_custom_agent_memory_agent").on(table.agentId)],
);

export type CustomAgentMemory = typeof customAgentMemory.$inferSelect;

/** Playbooks this custom agent can load (replaces user skills while active). */
export const customAgentSkill = pgTable(
  "custom_agent_skill",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    agentId: text("agent_id")
      .notNull()
      .references(() => customAgent.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    markdown: text("markdown").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_custom_agent_skill_agent").on(table.agentId),
    uniqueIndex("idx_custom_agent_skill_agent_slug").on(
      table.agentId,
      table.slug,
    ),
  ],
);

export type CustomAgentSkill = typeof customAgentSkill.$inferSelect;

/** Jobs that run on a cron into this agent's durable chat. */
export const customAgentRoutine = pgTable(
  "custom_agent_routine",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    agentId: text("agent_id")
      .notNull()
      .references(() => customAgent.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    cron: text("cron").notNull(),
    timezone: text("timezone").notNull().default("America/Los_Angeles"),
    prompt: text("prompt").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_custom_agent_routine_agent").on(table.agentId),
    index("idx_custom_agent_routine_enabled").on(table.enabled),
  ],
);

export type CustomAgentRoutine = typeof customAgentRoutine.$inferSelect;

/** Apps this custom agent may use (allowlist of connection ids). */
export const customAgentIntegration = pgTable(
  "custom_agent_integration",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    agentId: text("agent_id")
      .notNull()
      .references(() => customAgent.id, { onDelete: "cascade" }),
    connectionId: text("connection_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_custom_agent_integration_agent").on(table.agentId),
    uniqueIndex("idx_custom_agent_integration_agent_conn").on(
      table.agentId,
      table.connectionId,
    ),
  ],
);

export type CustomAgentIntegration = typeof customAgentIntegration.$inferSelect;

/**
 * Private eve deployments the signed-in user linked from Settings.
 * The bearer is stored only as AES-GCM ciphertext and never returned
 * to clients. Pearl calls these as remote agents via defineRemoteAgent.
 */
export const connectedAgent = pgTable(
  "connected_agent",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Display name in the composer switcher. */
    label: text("label").notNull(),
    /** Normalized https base URL of the remote eve deployment (no trailing slash). */
    url: text("url").notNull(),
    /** base64(iv || authTag || ciphertext) of the bearer token. */
    tokenCiphertext: text("token_ciphertext").notNull(),
    tokenKeyId: text("token_key_id").notNull().default("v1"),
    lastVerifiedAt: timestamp("last_verified_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_connected_agent_user").on(table.userId),
    uniqueIndex("idx_connected_agent_user_url").on(table.userId, table.url),
  ],
);

export type ConnectedAgentRow = typeof connectedAgent.$inferSelect;

/** Status for self-serve / curated directory partners Pearl can suggest. */
export type DirectoryListingStatus = "pending" | "approved" | "rejected";

/** How the listing entered the directory. */
export type DirectoryListingSource = "self_serve";

/**
 * Local businesses and creatives that Pearl may suggest.
 * Self-serve joins start as `pending`; operators approve via SQL for v1.
 */
export const directoryListing = pgTable(
  "directory_listing",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    category: text("category").notNull(),
    city: text("city").notNull(),
    region: text("region"),
    country: text("country").notNull().default("US"),
    description: text("description").notNull(),
    website: text("website"),
    instagram: text("instagram"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    status: text("status")
      .$type<DirectoryListingStatus>()
      .notNull()
      .default("pending"),
    source: text("source")
      .$type<DirectoryListingSource>()
      .notNull()
      .default("self_serve"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_directory_listing_slug").on(table.slug),
    index("idx_directory_listing_status").on(table.status, table.createdAt),
    index("idx_directory_listing_category").on(table.category, table.status),
  ],
);

export type DirectoryListing = typeof directoryListing.$inferSelect;

/**
 * UI mirror for eve dynamic schedules (pearl-automations collection).
 * Timing lives in Vercel Schedules; this row holds payload fields list/get hide.
 */
export const pearlAutomation = pgTable(
  "pearl_automation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    instructions: text("instructions").notNull(),
    triggerKind: text("trigger_kind")
      .$type<PearlAutomationTriggerKind>()
      .notNull(),
    triggerConfig: jsonb("trigger_config")
      .$type<PearlAutomationTriggerConfig>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    timezone: text("timezone").notNull().default("America/Los_Angeles"),
    notifyPush: boolean("notify_push").notNull().default(true),
    notifyEmail: boolean("notify_email").notNull().default(true),
    enabled: boolean("enabled").notNull().default(true),
    /** Unique management name from the eve create receipt. */
    eveScheduleName: text("eve_schedule_name").notNull(),
    /** Most recent chat started by a run. */
    lastChatId: text("last_chat_id").references(() => chat.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_pearl_automation_user").on(table.userId),
    uniqueIndex("idx_pearl_automation_eve_name").on(table.eveScheduleName),
    index("idx_pearl_automation_user_enabled").on(table.userId, table.enabled),
  ],
);

export type PearlAutomation = typeof pearlAutomation.$inferSelect;

/**
 * Maps a Plaid item_id to the Pearl user who owns it. Lives in the main app
 * database (not finance RLS) so webhooks and the daily books cron can resolve
 * the user without already knowing app.user_id.
 */
export const plaidItemIndex = pgTable(
  "plaid_item_index",
  {
    itemId: text("item_id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_plaid_item_index_user").on(table.userId)],
);

export type PlaidItemIndex = typeof plaidItemIndex.$inferSelect;
