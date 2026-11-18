import { connection } from "next/server";

/** Opt this request into dynamic rendering (live DB reads). */
export async function live() {
  await connection();
}
