-- Plans are now ordinary project files (Blob + project_artifact under
-- docs/plans/<projectId>/). Run application backfill (backfillPlansToProjectFiles)
-- before applying in environments that still have plan rows.
DROP TABLE IF EXISTS "plan";
