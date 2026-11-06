CREATE TABLE "user_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"birthdate" date,
	"nationality" text,
	"height" text,
	"eye_color" text,
	"hair_color" text,
	"skin_tone" text,
	"weight" text,
	"build" text,
	"gender" text,
	"measurements" text,
	"wears_contacts" boolean,
	"has_adhd" boolean,
	"has_anxiety" boolean,
	"health_notes" text,
	"primary_residence" text,
	"additional_homes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;