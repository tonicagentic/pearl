CREATE TABLE "agent_tool_execution" (
	"execution_key" text PRIMARY KEY NOT NULL,
	"tool_name" text NOT NULL,
	"status" text NOT NULL,
	"detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
