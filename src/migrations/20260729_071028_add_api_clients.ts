import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the apiClients collection, and re-baselines the schema snapshot.
 *
 * The generated output needed editing, so here is what was removed and why.
 *
 * Payload picks the lexicographically last *.json in this directory as the
 * baseline to diff against. The two migrations before this one were written by
 * hand and passed with --file, and that path skips writing a snapshot — so the
 * newest snapshot was still 20241214_124128.json, from before users_sessions
 * existed and before comments was dropped. Generating against it asked an
 * interactive question ("is users_sessions renamed from comments?") and would
 * have emitted statements that re-create comments and drop users_sessions.
 *
 * This migration was therefore generated against the older initial snapshot,
 * then trimmed to the statements the live database actually still needs,
 * verified column by column against it:
 *
 *   removed - CREATE TABLE users_sessions + its FK and two indexes
 *             (created by 20260222_003500_payload_3_77_compat)
 *   removed - ALTER TABLE forms_blocks_select ADD COLUMN placeholder
 *             (added by the same migration)
 *
 * Everything else is kept, deliberately. The .json alongside this file is a
 * faithful snapshot of the current config, so the database has to match it or
 * the drift simply returns on the next generated migration. That is why this
 * migration carries three changes beyond apiClients:
 *
 *   payload_kv         - internal table Payload 3.85 expects; absent here
 *   redirects_from_idx - becomes UNIQUE. Safe: the redirects collection holds
 *                        zero rows in production (measured), so there is
 *                        nothing for the constraint to reject.
 *   forms_emails       - a corrected default. No rows in production either.
 *
 * 2ahealthylife note: the three drift-sync statements (payload_kv, the
 * redirects index, its recreate) are IF (NOT) EXISTS because this DB already
 * has them — the vanilla add_logo_cloud_grid_block migration, applied before
 * this codebase arrived, synced the same drift. Running them strictly failed
 * the first deploy (relation "payload_kv" already exists).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE "api_clients" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"owner" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar
  );

  CREATE TABLE IF NOT EXISTS "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );

  DROP INDEX IF EXISTS "redirects_from_idx";
  ALTER TABLE "forms_emails" ALTER COLUMN "subject" SET DEFAULT 'You''ve received a new message.';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "api_clients_id" integer;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "api_clients_id" integer;
  CREATE INDEX "api_clients_updated_at_idx" ON "api_clients" USING btree ("updated_at");
  CREATE INDEX "api_clients_created_at_idx" ON "api_clients" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_api_clients_fk" FOREIGN KEY ("api_clients_id") REFERENCES "public"."api_clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_api_clients_fk" FOREIGN KEY ("api_clients_id") REFERENCES "public"."api_clients"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_api_clients_id_idx" ON "payload_locked_documents_rels" USING btree ("api_clients_id");
  CREATE INDEX "payload_preferences_rels_api_clients_id_idx" ON "payload_preferences_rels" USING btree ("api_clients_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "redirects_from_idx" ON "redirects" USING btree ("from");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "api_clients" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_kv" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "api_clients" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_api_clients_fk";

  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_api_clients_fk";

  DROP INDEX "payload_locked_documents_rels_api_clients_id_idx";
  DROP INDEX "payload_preferences_rels_api_clients_id_idx";
  DROP INDEX "redirects_from_idx";
  ALTER TABLE "forms_emails" ALTER COLUMN "subject" SET DEFAULT 'You''''ve received a new message.';
  CREATE INDEX "redirects_from_idx" ON "redirects" USING btree ("from");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "api_clients_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "api_clients_id";`)
}
