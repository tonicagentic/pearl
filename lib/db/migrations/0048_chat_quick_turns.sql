ALTER TABLE "chat" ADD COLUMN "quick_turns" jsonb DEFAULT '[]'::jsonb NOT NULL;
