CREATE TABLE "concept_schema" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"statement" text NOT NULL,
	"includes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excludes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"distinctions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"non_examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept_schema_revision" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_id" text NOT NULL,
	"user_id" text NOT NULL,
	"version" integer NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"statement" text NOT NULL,
	"includes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excludes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"distinctions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"non_examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "concept_schema" ADD CONSTRAINT "concept_schema_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_schema_revision" ADD CONSTRAINT "concept_schema_revision_schema_id_concept_schema_id_fk" FOREIGN KEY ("schema_id") REFERENCES "public"."concept_schema"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_schema_revision" ADD CONSTRAINT "concept_schema_revision_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_concept_schema_user" ON "concept_schema" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_concept_schema_user_slug" ON "concept_schema" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "idx_concept_schema_user_status" ON "concept_schema" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_concept_schema_revision_schema" ON "concept_schema_revision" USING btree ("schema_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_concept_schema_revision_schema_version" ON "concept_schema_revision" USING btree ("schema_id","version");