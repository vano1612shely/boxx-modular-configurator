import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

import { newOrderReference } from '../modules/shared/order-reference'

/**
 * Orders get an address of their own, and the admin gets a say in what happens
 * once one has been placed.
 *
 * Written by hand: the generator diffs against a database, and this repo's
 * development database is in push mode, where a column appears the moment the
 * schema changes and the diff therefore has nothing to say. It also stops to
 * ask about an unrelated table that is still pending here.
 *
 * `reference` is added nullable and filled row by row before the unique index
 * goes on it, because every quote taken before today has to end up with one —
 * a null there would leave an existing order with no link an admin could send.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "integration_settings"
      ADD COLUMN IF NOT EXISTS "success_redirect_url" varchar,
      ADD COLUMN IF NOT EXISTS "success_title" varchar DEFAULT 'Your quote request has been sent.',
      ADD COLUMN IF NOT EXISTS "success_body" varchar DEFAULT 'The team will get back to you shortly. Your order number is {reference}.',
      ADD COLUMN IF NOT EXISTS "success_show_order_link" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "success_view_order_label" varchar DEFAULT 'View your configuration';
  `)

  await db.execute(sql`ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "reference" varchar;`)

  const pending = await db.execute<{ id: number }>(
    sql`SELECT "id" FROM "quotes" WHERE "reference" IS NULL;`,
  )

  // Minted in here rather than in SQL so old orders carry exactly the same kind
  // of reference new ones do — one alphabet, one length, one source of chance.
  for (const row of pending.rows) {
    await db.execute(
      sql`UPDATE "quotes" SET "reference" = ${newOrderReference()} WHERE "id" = ${row.id};`,
    )
  }

  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS "quotes_reference_idx" ON "quotes" USING btree ("reference");`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "quotes_reference_idx";
    ALTER TABLE "quotes" DROP COLUMN IF EXISTS "reference";
    ALTER TABLE "integration_settings"
      DROP COLUMN IF EXISTS "success_redirect_url",
      DROP COLUMN IF EXISTS "success_title",
      DROP COLUMN IF EXISTS "success_body",
      DROP COLUMN IF EXISTS "success_show_order_link",
      DROP COLUMN IF EXISTS "success_view_order_label";
  `)
}
