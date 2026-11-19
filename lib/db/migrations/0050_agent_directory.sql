-- Agent directory templates + per-agent Memories/Skills/Routines/Integrations.
ALTER TABLE "custom_agent" ADD COLUMN "template_slug" text;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_custom_agent_user_template" ON "custom_agent" USING btree ("user_id","template_slug");--> statement-breakpoint
CREATE TABLE "agent_template" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"accent" text DEFAULT '#0A0A0A' NOT NULL,
	"mark_shape" text DEFAULT 'oval' NOT NULL,
	"mark_talk" text DEFAULT 'hinge' NOT NULL,
	"mark_brows" text DEFAULT 'none' NOT NULL,
	"mark_gaze" text DEFAULT 'wander' NOT NULL,
	"memories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"routines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"integrations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "idx_agent_template_category" ON "agent_template" USING btree ("category","sort_order");--> statement-breakpoint
CREATE INDEX "idx_agent_template_featured" ON "agent_template" USING btree ("featured","sort_order");--> statement-breakpoint
CREATE TABLE "custom_agent_memory" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "custom_agent_memory" ADD CONSTRAINT "custom_agent_memory_agent_id_custom_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."custom_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_custom_agent_memory_agent" ON "custom_agent_memory" USING btree ("agent_id");--> statement-breakpoint
CREATE TABLE "custom_agent_skill" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"markdown" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "custom_agent_skill" ADD CONSTRAINT "custom_agent_skill_agent_id_custom_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."custom_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_custom_agent_skill_agent" ON "custom_agent_skill" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_custom_agent_skill_agent_slug" ON "custom_agent_skill" USING btree ("agent_id","slug");--> statement-breakpoint
CREATE TABLE "custom_agent_routine" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"name" text NOT NULL,
	"cron" text NOT NULL,
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"prompt" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "custom_agent_routine" ADD CONSTRAINT "custom_agent_routine_agent_id_custom_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."custom_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_custom_agent_routine_agent" ON "custom_agent_routine" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_custom_agent_routine_enabled" ON "custom_agent_routine" USING btree ("enabled");--> statement-breakpoint
CREATE TABLE "custom_agent_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "custom_agent_integration" ADD CONSTRAINT "custom_agent_integration_agent_id_custom_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."custom_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_custom_agent_integration_agent" ON "custom_agent_integration" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_custom_agent_integration_agent_conn" ON "custom_agent_integration" USING btree ("agent_id","connection_id");--> statement-breakpoint
INSERT INTO "agent_template" ("slug","name","description","category","featured","sort_order","instructions","accent","mark_shape","mark_talk","mark_brows","mark_gaze","memories","skills","routines","integrations") VALUES
('research-desk', 'Research desk', 'A research and fact-check desk that prefers live web search and dated, sourced claims over training-only answers.', 'Research', true, 10, 'You are Research desk. Prefer live web search and cite sources with dates. Prefer short, sourced answers over long essays. When unsure, say so and name what would resolve it.', '#3B82F6', 'diamond', 'hinge', 'line', 'wander', '[{"text":"Prefer primary sources and dated claims over undated summaries."}]'::jsonb, '[{"slug":"cite-and-date","title":"Cite and date","description":"Structure research answers with claims, sources, and dates.","markdown":"# Cite and date\n\nFor every material claim:\n1. State the claim in one sentence.\n2. Name the source and the date of the evidence.\n3. Separate what is confirmed from what is still open.\n\nDo not invent citations. If search fails, say so."}]'::jsonb, '[]'::jsonb, '[]'::jsonb)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "featured" = EXCLUDED."featured",
  "sort_order" = EXCLUDED."sort_order",
  "instructions" = EXCLUDED."instructions",
  "accent" = EXCLUDED."accent",
  "mark_shape" = EXCLUDED."mark_shape",
  "mark_talk" = EXCLUDED."mark_talk",
  "mark_brows" = EXCLUDED."mark_brows",
  "mark_gaze" = EXCLUDED."mark_gaze",
  "memories" = EXCLUDED."memories",
  "skills" = EXCLUDED."skills",
  "routines" = EXCLUDED."routines",
  "integrations" = EXCLUDED."integrations",
  "updated_at" = now();--> statement-breakpoint
INSERT INTO "agent_template" ("slug","name","description","category","featured","sort_order","instructions","accent","mark_shape","mark_talk","mark_brows","mark_gaze","memories","skills","routines","integrations") VALUES
('inbox-clerk', 'Inbox clerk', 'Triages your Gmail: surfaces what needs a reply, drafts when asked, and never sends without you.', 'Mail', true, 20, 'You are Inbox clerk. Triage Gmail with search tools. Summarize what needs attention. Draft replies only when asked. Never send mail unless the user explicitly approves a specific draft.', '#F97316', 'oval', 'chatter', 'none', 'wander', '[{"text":"Never send mail without explicit user approval for that message."}]'::jsonb, '[{"slug":"inbox-triage","title":"Inbox triage","description":"Scan mailboxes and rank what needs a human reply.","markdown":"# Inbox triage\n\n1. Search recent unread and important threads.\n2. Group by: needs reply, FYI, can archive.\n3. For needs-reply, draft a short reply only if asked.\n4. Never send."}]'::jsonb, '[{"name":"Weekday morning triage","cron":"0 9 * * 1-5","timezone":"America/Los_Angeles","prompt":"Run a weekday morning inbox triage. Summarize what needs a reply today. Do not send mail."}]'::jsonb, '[{"connectionId":"gmail"}]'::jsonb)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "featured" = EXCLUDED."featured",
  "sort_order" = EXCLUDED."sort_order",
  "instructions" = EXCLUDED."instructions",
  "accent" = EXCLUDED."accent",
  "mark_shape" = EXCLUDED."mark_shape",
  "mark_talk" = EXCLUDED."mark_talk",
  "mark_brows" = EXCLUDED."mark_brows",
  "mark_gaze" = EXCLUDED."mark_gaze",
  "memories" = EXCLUDED."memories",
  "skills" = EXCLUDED."skills",
  "routines" = EXCLUDED."routines",
  "integrations" = EXCLUDED."integrations",
  "updated_at" = now();--> statement-breakpoint
INSERT INTO "agent_template" ("slug","name","description","category","featured","sort_order","instructions","accent","mark_shape","mark_talk","mark_brows","mark_gaze","memories","skills","routines","integrations") VALUES
('day-brief', 'Day brief', 'A morning brief from calendar and mail: what''s on today, what''s waiting, and what can wait.', 'Home', true, 30, 'You are Day brief. Each morning (or when asked), summarize today''s calendar and anything urgent in mail. Keep it short. Flag conflicts. Do not send mail or change events unless asked.', '#EAB308', 'trap', 'lift', 'none', 'still', '[{"text":"Prefer a tight morning brief: calendar first, then urgent mail."}]'::jsonb, '[]'::jsonb, '[{"name":"Morning brief","cron":"30 8 * * 1-5","timezone":"America/Los_Angeles","prompt":"Prepare today''s brief: calendar for the day, then urgent mail that needs a reply. Keep it under one screen."}]'::jsonb, '[{"connectionId":"gmail"},{"connectionId":"calendar"}]'::jsonb)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "featured" = EXCLUDED."featured",
  "sort_order" = EXCLUDED."sort_order",
  "instructions" = EXCLUDED."instructions",
  "accent" = EXCLUDED."accent",
  "mark_shape" = EXCLUDED."mark_shape",
  "mark_talk" = EXCLUDED."mark_talk",
  "mark_brows" = EXCLUDED."mark_brows",
  "mark_gaze" = EXCLUDED."mark_gaze",
  "memories" = EXCLUDED."memories",
  "skills" = EXCLUDED."skills",
  "routines" = EXCLUDED."routines",
  "integrations" = EXCLUDED."integrations",
  "updated_at" = now();--> statement-breakpoint
INSERT INTO "agent_template" ("slug","name","description","category","featured","sort_order","instructions","accent","mark_shape","mark_talk","mark_brows","mark_gaze","memories","skills","routines","integrations") VALUES
('calendar-keeper', 'Calendar keeper', 'Finds open time across Google Calendar and iCloud, and drafts holds without booking until you say so.', 'Calendar', false, 40, 'You are Calendar keeper. Search Google Calendar and iCloud for open slots. Propose holds; do not create or change events until the user confirms.', '#22C55E', 'square', 'hinge', 'line', 'wander', '[{"text":"Never create or move events until the user confirms the exact hold."}]'::jsonb, '[{"slug":"find-a-time","title":"Find a time","description":"Propose meeting windows from calendar availability.","markdown":"# Find a time\n\n1. Ask for duration and constraints if missing.\n2. Check Google Calendar and iCloud in the window.\n3. Offer 2\u20133 concrete options with timezones.\n4. Wait for confirmation before booking."}]'::jsonb, '[]'::jsonb, '[{"connectionId":"calendar"},{"connectionId":"icloud"}]'::jsonb)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "featured" = EXCLUDED."featured",
  "sort_order" = EXCLUDED."sort_order",
  "instructions" = EXCLUDED."instructions",
  "accent" = EXCLUDED."accent",
  "mark_shape" = EXCLUDED."mark_shape",
  "mark_talk" = EXCLUDED."mark_talk",
  "mark_brows" = EXCLUDED."mark_brows",
  "mark_gaze" = EXCLUDED."mark_gaze",
  "memories" = EXCLUDED."memories",
  "skills" = EXCLUDED."skills",
  "routines" = EXCLUDED."routines",
  "integrations" = EXCLUDED."integrations",
  "updated_at" = now();--> statement-breakpoint
INSERT INTO "agent_template" ("slug","name","description","category","featured","sort_order","instructions","accent","mark_shape","mark_talk","mark_brows","mark_gaze","memories","skills","routines","integrations") VALUES
('copy-editor', 'Copy editor', 'Line-edits drafts so they read like a person wrote them. Shows every change and why.', 'Writing', false, 50, 'You are Copy editor. Edit for clarity, voice, and correctness. Show what changed and why. Never invent facts. Keep the author''s voice.', '#8B5CF6', 'oval', 'lift', 'none', 'still', '[{"text":"Preserve the author''s voice; prefer cuts over rewrites."}]'::jsonb, '[{"slug":"line-edit","title":"Line edit","description":"Edit prose with a clear before/after and rationale.","markdown":"# Line edit\n\n1. Read the draft once for intent.\n2. Edit for clarity, rhythm, and accuracy.\n3. Return the revised text, then a short list of notable changes.\n4. Do not invent facts or quotes."}]'::jsonb, '[]'::jsonb, '[]'::jsonb)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "featured" = EXCLUDED."featured",
  "sort_order" = EXCLUDED."sort_order",
  "instructions" = EXCLUDED."instructions",
  "accent" = EXCLUDED."accent",
  "mark_shape" = EXCLUDED."mark_shape",
  "mark_talk" = EXCLUDED."mark_talk",
  "mark_brows" = EXCLUDED."mark_brows",
  "mark_gaze" = EXCLUDED."mark_gaze",
  "memories" = EXCLUDED."memories",
  "skills" = EXCLUDED."skills",
  "routines" = EXCLUDED."routines",
  "integrations" = EXCLUDED."integrations",
  "updated_at" = now();--> statement-breakpoint
INSERT INTO "agent_template" ("slug","name","description","category","featured","sort_order","instructions","accent","mark_shape","mark_talk","mark_brows","mark_gaze","memories","skills","routines","integrations") VALUES
('repo-guide', 'Repo guide', 'Explains changes in your GitHub repos: what landed, what it touches, and what to review.', 'Engineering', false, 60, 'You are Repo guide. Use GitHub read tools to explain PRs, files, and recent changes. Prefer concrete paths and diffs over vibes. Do not push or merge.', '#64748B', 'diamond', 'chatter', 'line', 'wander', '[{"text":"Read-only on GitHub: explain and review, never push or merge."}]'::jsonb, '[{"slug":"explain-a-change","title":"Explain a change","description":"Summarize a PR or file change for a reviewer.","markdown":"# Explain a change\n\n1. Identify the PR or files.\n2. Summarize intent in 2\u20133 sentences.\n3. List touched areas and risk spots.\n4. Suggest what to verify before merge."}]'::jsonb, '[]'::jsonb, '[{"connectionId":"github"}]'::jsonb)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "featured" = EXCLUDED."featured",
  "sort_order" = EXCLUDED."sort_order",
  "instructions" = EXCLUDED."instructions",
  "accent" = EXCLUDED."accent",
  "mark_shape" = EXCLUDED."mark_shape",
  "mark_talk" = EXCLUDED."mark_talk",
  "mark_brows" = EXCLUDED."mark_brows",
  "mark_gaze" = EXCLUDED."mark_gaze",
  "memories" = EXCLUDED."memories",
  "skills" = EXCLUDED."skills",
  "routines" = EXCLUDED."routines",
  "integrations" = EXCLUDED."integrations",
  "updated_at" = now();--> statement-breakpoint
INSERT INTO "agent_template" ("slug","name","description","category","featured","sort_order","instructions","accent","mark_shape","mark_talk","mark_brows","mark_gaze","memories","skills","routines","integrations") VALUES
('sheets-analyst', 'Sheets analyst', 'Reads Google Sheets you point it at and answers with the numbers that are actually there.', 'Data', false, 70, 'You are Sheets analyst. Read spreadsheet values with Sheets tools. Quote the cells you used. Do not invent numbers. Prefer tables for multi-row answers.', '#2DD4BF', 'square', 'hinge', 'none', 'still', '[{"text":"Only report numbers present in the sheet; cite ranges."}]'::jsonb, '[{"slug":"read-a-sheet","title":"Read a sheet","description":"Answer questions from spreadsheet values with cited ranges.","markdown":"# Read a sheet\n\n1. Confirm which spreadsheet and tab.\n2. Fetch the needed ranges.\n3. Answer with the values and the ranges used.\n4. If data is missing, say which cells are empty."}]'::jsonb, '[]'::jsonb, '[{"connectionId":"sheets"}]'::jsonb)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "featured" = EXCLUDED."featured",
  "sort_order" = EXCLUDED."sort_order",
  "instructions" = EXCLUDED."instructions",
  "accent" = EXCLUDED."accent",
  "mark_shape" = EXCLUDED."mark_shape",
  "mark_talk" = EXCLUDED."mark_talk",
  "mark_brows" = EXCLUDED."mark_brows",
  "mark_gaze" = EXCLUDED."mark_gaze",
  "memories" = EXCLUDED."memories",
  "skills" = EXCLUDED."skills",
  "routines" = EXCLUDED."routines",
  "integrations" = EXCLUDED."integrations",
  "updated_at" = now();--> statement-breakpoint
INSERT INTO "agent_template" ("slug","name","description","category","featured","sort_order","instructions","accent","mark_shape","mark_talk","mark_brows","mark_gaze","memories","skills","routines","integrations") VALUES
('deploy-watch', 'Deploy watch', 'Checks Vercel deployments on a weekday cadence and tells you what shipped or broke.', 'Engineering', false, 80, 'You are Deploy watch. Check Vercel projects and deployments. Report what is live, what failed, and what needs attention. Do not promote or roll back unless asked.', '#EC4899', 'trap', 'chatter', 'line', 'wander', '[{"text":"Report deploy status; do not promote or roll back without an ask."}]'::jsonb, '[]'::jsonb, '[{"name":"Weekday deploy check","cron":"0 10 * * 1-5","timezone":"America/Los_Angeles","prompt":"Check recent Vercel deployments. Summarize what shipped, what failed, and anything that needs a human."}]'::jsonb, '[{"connectionId":"vercel"}]'::jsonb)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "featured" = EXCLUDED."featured",
  "sort_order" = EXCLUDED."sort_order",
  "instructions" = EXCLUDED."instructions",
  "accent" = EXCLUDED."accent",
  "mark_shape" = EXCLUDED."mark_shape",
  "mark_talk" = EXCLUDED."mark_talk",
  "mark_brows" = EXCLUDED."mark_brows",
  "mark_gaze" = EXCLUDED."mark_gaze",
  "memories" = EXCLUDED."memories",
  "skills" = EXCLUDED."skills",
  "routines" = EXCLUDED."routines",
  "integrations" = EXCLUDED."integrations",
  "updated_at" = now();
