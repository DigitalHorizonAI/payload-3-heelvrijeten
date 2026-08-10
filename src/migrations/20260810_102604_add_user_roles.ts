import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds `users.role`, and leaves everyone who already has an account an admin.
 *
 * Three deliberate departures from what `migrate:create` generated:
 *
 *  1. **The backfill.** The generated statement was `ADD COLUMN ... DEFAULT
 *     'editor' NOT NULL`, which is right for new rows and catastrophic for
 *     existing ones: it would have demoted every current account, including the
 *     only ones able to promote anybody back. Deploying this must change nothing
 *     for anyone who can sign in today — who becomes an editor is a decision
 *     someone makes afterwards, in the admin panel, not a side effect of a
 *     deploy.
 *
 *  2. **The IF NOT EXISTS guards.** A target database that has run extra
 *     template migrations fails a strict CREATE/ALTER, which is exactly how the
 *     first 2ahealthylife deploy died on `payload_kv already exists`. Fresh-DB
 *     green is not enough on its own.
 *
 *  3. **The dropped `byline` statements.** The generator also emitted
 *     `posts.byline` and `_posts_v.version_byline`, which already exist —
 *     `20260804_140000_add_byline` was hand-written and shipped without a
 *     `.json` snapshot, so the generator diffed against the state before it.
 *     Running them would fail on a database that has had that migration, which
 *     is every database this will ever touch. The snapshot beside this file
 *     records `byline`, so the next generated migration starts from the truth.
 *
 * Points 1 and 2 pull against each other, and the column check below is what
 * stops them fighting. Guarding the ALTER made this migration re-runnable; an
 * unconditional backfill would then promote every editor back to admin the
 * second time it ran. Adding the column and backfilling it are therefore one
 * atomic decision — the backfill can only happen in the same breath as the
 * column being created, never on its own.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
     CREATE TYPE "public"."enum_users_role" AS ENUM('editor', 'admin');
   EXCEPTION WHEN duplicate_object THEN null;
   END $$;

   DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
     ) THEN
       ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'editor' NOT NULL;
       UPDATE "users" SET "role" = 'admin';
     END IF;
   END $$;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
   DROP TYPE IF EXISTS "public"."enum_users_role";`)
}
