ALTER TABLE "project" ADD COLUMN "drive_name" text;--> statement-breakpoint
ALTER TABLE "custom_agent" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "custom_agent" ADD COLUMN "role" text DEFAULT 'member' NOT NULL;--> statement-breakpoint
-- Existing agents → one Personal project per user (Personal agents if taken).
DO $$
DECLARE
  agent_user text;
  personal_id text;
  personal_name text;
  mgr_id text;
  mgr_chat_id text;
BEGIN
  FOR agent_user IN
    SELECT DISTINCT user_id FROM custom_agent WHERE project_id IS NULL
  LOOP
    personal_name := 'Personal';
    IF EXISTS (
      SELECT 1 FROM project
      WHERE user_id = agent_user AND lower(name) = 'personal'
    ) THEN
      personal_name := 'Personal agents';
    END IF;

    personal_id := gen_random_uuid()::text;
    INSERT INTO project (id, user_id, name, instructions, status, priority)
    VALUES (
      personal_id,
      agent_user,
      personal_name,
      '',
      'backlog',
      'none'
    );

    UPDATE custom_agent
    SET project_id = personal_id, role = 'member'
    WHERE user_id = agent_user AND project_id IS NULL;

    UPDATE chat
    SET project_id = personal_id
    WHERE custom_agent_id IN (
      SELECT id FROM custom_agent WHERE project_id = personal_id
    );

    mgr_id := gen_random_uuid()::text;
    mgr_chat_id := gen_random_uuid()::text;
    INSERT INTO custom_agent (
      id, user_id, project_id, role, name, instructions, accent
    ) VALUES (
      mgr_id,
      agent_user,
      personal_id,
      'manager',
      'Project Manager',
      'You are the project manager for this project. Build lasting context about the work, keep skills and routines current, and run scheduled check-ins. Prefer project goals, notes, and files when deciding what matters.',
      '#0A0A0A'
    );
    INSERT INTO chat (id, user_id, title, project_id, custom_agent_id)
    VALUES (
      mgr_chat_id,
      agent_user,
      'Project Manager',
      personal_id,
      mgr_id
    );
  END LOOP;
END $$;--> statement-breakpoint
-- Existing projects without a manager get one.
DO $$
DECLARE
  proj RECORD;
  mgr_id text;
  mgr_chat_id text;
BEGIN
  FOR proj IN
    SELECT p.id, p.user_id
    FROM project p
    WHERE NOT EXISTS (
      SELECT 1 FROM custom_agent ca
      WHERE ca.project_id = p.id AND ca.role = 'manager'
    )
  LOOP
    mgr_id := gen_random_uuid()::text;
    mgr_chat_id := gen_random_uuid()::text;
    INSERT INTO custom_agent (
      id, user_id, project_id, role, name, instructions, accent
    ) VALUES (
      mgr_id,
      proj.user_id,
      proj.id,
      'manager',
      'Project Manager',
      'You are the project manager for this project. Build lasting context about the work, keep skills and routines current, and run scheduled check-ins. Prefer project goals, notes, and files when deciding what matters.',
      '#0A0A0A'
    );
    INSERT INTO chat (id, user_id, title, project_id, custom_agent_id)
    VALUES (
      mgr_chat_id,
      proj.user_id,
      'Project Manager',
      proj.id,
      mgr_id
    );
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "custom_agent" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_agent" ADD CONSTRAINT "custom_agent_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX IF EXISTS "idx_custom_agent_user_name";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_custom_agent_user_template";--> statement-breakpoint
CREATE INDEX "idx_custom_agent_project" ON "custom_agent" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_custom_agent_project_name" ON "custom_agent" USING btree ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_custom_agent_project_template" ON "custom_agent" USING btree ("project_id","template_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_custom_agent_project_manager" ON "custom_agent" USING btree ("project_id") WHERE "role" = 'manager';
