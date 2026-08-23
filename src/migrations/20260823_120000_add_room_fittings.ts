import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Fittings that belong to a room, and packages that are arranged rather than carried in.
 *
 * Two rooms of the same building can have entirely different kitchens, and the
 * building's own model already contains some of them — so where a fitting
 * stands is a fact about one room of one building, not about a catalogue row
 * every building shares. Hence both lists hang off the room.
 *
 * `jsonb` rather than nested arrays, following `zones` above it: these are
 * arranged in the Scene Editor, which edits the room as one draft object, and a
 * child table would buy relational integrity nobody reads at the price of two
 * more tables and a join on every scene load.
 *
 * `furniture_packages.model_id` loses NOT NULL because a fitted package has no
 * one model — its parts are placed on the room. The row is still what names it,
 * prices it and puts it in the catalogue.
 *
 * Written by hand. Development runs the database in push mode, so all three
 * columns appear the moment the fields are declared and the generator's diff
 * has nothing left to say — which is exactly how a missing migration has
 * reached production from this repo before.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "building_models_rooms"
      ADD COLUMN IF NOT EXISTS "built_ins" jsonb,
      ADD COLUMN IF NOT EXISTS "fitted_sets" jsonb;
  `)

  await db.execute(sql`
    ALTER TABLE "furniture_packages"
      ADD COLUMN IF NOT EXISTS "fitted" boolean DEFAULT false;
  `)

  await db.execute(sql`
    ALTER TABLE "furniture_packages"
      ALTER COLUMN "model_id" DROP NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Forgets every arrangement an admin made. Nothing a customer has ordered is
  // touched — a quote stores what it cost, not what it was made of.
  await db.execute(sql`
    ALTER TABLE "building_models_rooms"
      DROP COLUMN IF EXISTS "built_ins",
      DROP COLUMN IF EXISTS "fitted_sets";
  `)

  await db.execute(sql`
    ALTER TABLE "furniture_packages"
      DROP COLUMN IF EXISTS "fitted";
  `)

  // Deliberately last, and deliberately able to fail: there is no going back to
  // a world where every package has a model while a fitted one still has none.
  // The error names the rows to fix, which is the only honest thing to do here.
  await db.execute(sql`
    ALTER TABLE "furniture_packages"
      ALTER COLUMN "model_id" SET NOT NULL;
  `)
}
