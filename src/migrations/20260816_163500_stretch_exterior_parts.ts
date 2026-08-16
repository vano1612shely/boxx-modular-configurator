import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A part's scale becomes one number per axis, so a deck can be stretched along
 * a wall without growing taller with it.
 *
 * Written by hand rather than generated: the generator cannot tell a new
 * `scale_x` from a renamed `scale` and stops to ask, and the answer is neither
 * — the old value has to be copied onto all three axes before it goes, or every
 * model already placed would snap back to its authored size.
 */
const TABLES = [
  'building_models_scene_config_exterior_slots_variants_parts',
  'exterior_options_parts',
] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const table of TABLES) {
    await db.execute(sql.raw(`
      ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "scale_x" numeric DEFAULT 1;
      ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "scale_y" numeric DEFAULT 1;
      ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "scale_z" numeric DEFAULT 1;
      UPDATE "${table}" SET
        "scale_x" = COALESCE("scale", 1),
        "scale_y" = COALESCE("scale", 1),
        "scale_z" = COALESCE("scale", 1);
      ALTER TABLE "${table}" DROP COLUMN IF EXISTS "scale";
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const table of TABLES) {
    // Back to one number, taking the x axis — a uniform scale is what it was
    // before, and any stretch put on it since has nowhere to go.
    await db.execute(sql.raw(`
      ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "scale" numeric DEFAULT 1;
      UPDATE "${table}" SET "scale" = COALESCE("scale_x", 1);
      ALTER TABLE "${table}" DROP COLUMN IF EXISTS "scale_x";
      ALTER TABLE "${table}" DROP COLUMN IF EXISTS "scale_y";
      ALTER TABLE "${table}" DROP COLUMN IF EXISTS "scale_z";
    `))
  }
}
