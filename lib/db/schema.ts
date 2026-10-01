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
import type { ClientSessionState, MessageStreamEvent } from "eve/client";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_chat_user_updated").on(table.userId, table.updatedAt),
    index("idx_chat_user_created").on(table.userId, table.createdAt),
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
    event: jsonb("event").$type<MessageStreamEvent>().notNull().default(sql`'{}'::jsonb`),
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
    status: text("status", { enum: ["open", "resolved"] })
      .notNull()
      .default("open"),
    // Calendar dates on purpose: "due soon" must not become a time-zone bug.
    // dueDate — when this needs to be resolved; reviewDate — when it should
    // return to attention (the system's contract to resurface it).
    dueDate: date("due_date"),
    reviewDate: date("review_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [index("idx_issue_user_status").on(table.userId, table.status)],
);

export type Issue = typeof issue.$inferSelect;
