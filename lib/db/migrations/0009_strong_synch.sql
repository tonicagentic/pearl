-- The default-tree seed raced on concurrent first renders and could insert
-- the same node twice. Deduplicate existing rows (keep the earliest of each
-- sibling name) before the unique index that makes the seed conflict-safe.
--> statement-breakpoint
DELETE FROM "responsibility" a
USING "responsibility" b
WHERE a.user_id = b.user_id
  AND coalesce(a.parent_id, '__root__') = coalesce(b.parent_id, '__root__')
  AND a.name = b.name
  AND (a.created_at, a.id) > (b.created_at, b.id);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_responsibility_sibling_name" ON "responsibility" USING btree ("user_id",coalesce("parent_id", '__root__'),"name");
