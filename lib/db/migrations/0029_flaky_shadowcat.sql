CREATE TABLE "mail_account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"email_label" text,
	"nickname" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mail_account_id" text,
	"match_from" text,
	"match_list" text,
	"match_subject" text,
	"action" text NOT NULL,
	"label_id" text,
	"label_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mail_account" ADD CONSTRAINT "mail_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_rule" ADD CONSTRAINT "mail_rule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_rule" ADD CONSTRAINT "mail_rule_mail_account_id_mail_account_id_fk" FOREIGN KEY ("mail_account_id") REFERENCES "public"."mail_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mail_account_user" ON "mail_account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mail_account_user_subject" ON "mail_account" USING btree ("user_id","subject_id");--> statement-breakpoint
CREATE INDEX "idx_mail_rule_user" ON "mail_rule" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mail_rule_account" ON "mail_rule" USING btree ("mail_account_id");