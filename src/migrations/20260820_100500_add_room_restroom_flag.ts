import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A room outline can be marked a restroom.
 *
 * Its own column rather than the room type it already carries: room types are
 * catalogue rows an admin can rename or delete, and they decide what furniture
 * fits — a building would lose its restrooms the day somebody tidied the
 * catalogue. A marked room keeps its outline, its marker and its camera, and
 * takes no furniture at all.
 *
 * Written by hand. Development runs the database in push mode, so the column
 * appears the moment the field is declared and the generator's diff has nothing
 * left to say — which is exactly how a missing migration has reached production
 * from this repo before.
 *
 * `DEFAULT false` rather than a bare nullable column, so every room drawn before
 * today comes out of this as an ordinary room stated rather than merely absent.
 * The default is a constant, so Postgres fills it in without rewriting the table.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "building_models_rooms"
      ADD COLUMN IF NOT EXISTS "is_restroom" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Forgets which rooms were restrooms. A handful of ticks to put back rather
  // than an incident, but it is not nothing.
  await db.execute(sql`
    ALTER TABLE "building_models_rooms" DROP COLUMN IF EXISTS "is_restroom";
  `)
}
