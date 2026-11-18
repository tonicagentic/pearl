// Local stub for FK typing only — finance_app role cannot read public.user
import { pgTable, text } from "drizzle-orm/pg-core";

export const user = pgTable("user", { id: text("id").primaryKey() });
