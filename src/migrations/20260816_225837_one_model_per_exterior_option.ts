import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * One model to an exterior option, placed once per building.
 *
 * An option used to carry a list of parts with default offsets, and a choice on
 * a building carried its own list overriding them. Two lists saying the same
 * thing, and the second one won every time — so the option keeps the model and
 * the choice keeps only where it stands.
 *
 * Written by hand. The generator would have created these tables from scratch:
 * the newest snapshot on the chain predates the exterior feature entirely, so
 * it cannot see the columns this has to carry across. What it does emit
 * correctly is the schema snapshot beside this file, which is kept — it heals
 * the chain for whatever is generated next.
 *
 * Nothing authored is thrown away that has anywhere to go: an option takes the
 * model of its first part, and a choice takes that part's offset as its
 * placement. An option with no parts at all could never draw anything, and goes.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "building_models_scene_config_exterior_slots_variants"
      ADD COLUMN IF NOT EXISTS "placement_position_x" numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "placement_position_y" numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "placement_position_z" numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "placement_scale_x" numeric DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "placement_scale_y" numeric DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "placement_scale_z" numeric DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "placement_yaw_deg" numeric DEFAULT 0;

    -- The first part is the one the admin was looking at: parts were drawn in
    -- order and anything past the first was a second object on the same spot.
    UPDATE "building_models_scene_config_exterior_slots_variants" AS v SET
      "placement_position_x" = p."position_x",
      "placement_position_y" = p."position_y",
      "placement_position_z" = p."position_z",
      "placement_scale_x" = p."scale_x",
      "placement_scale_y" = p."scale_y",
      "placement_scale_z" = p."scale_z",
      "placement_yaw_deg" = p."yaw_deg"
    FROM (
      SELECT DISTINCT ON ("_parent_id")
        "_parent_id", "position_x", "position_y", "position_z",
        "scale_x", "scale_y", "scale_z", "yaw_deg"
      FROM "building_models_scene_config_exterior_slots_variants_parts"
      ORDER BY "_parent_id", "_order"
    ) AS p
    WHERE v."id" = p."_parent_id";

    ALTER TABLE "exterior_options" ADD COLUMN IF NOT EXISTS "model_id" integer;

    UPDATE "exterior_options" AS o SET "model_id" = p."model_id"
    FROM (
      SELECT DISTINCT ON ("_parent_id") "_parent_id", "model_id"
      FROM "exterior_options_parts"
      ORDER BY "_parent_id", "_order"
    ) AS p
    WHERE o."id" = p."_parent_id";

    -- The choices go before the options they point at: the foreign key is
    -- ON DELETE SET NULL over a NOT NULL column, so deleting underneath one
    -- would raise rather than cascade.
    DELETE FROM "building_models_scene_config_exterior_slots_variants"
    WHERE "option_id" IN (SELECT "id" FROM "exterior_options" WHERE "model_id" IS NULL);

    DELETE FROM "exterior_options" WHERE "model_id" IS NULL;

    ALTER TABLE "exterior_options" ALTER COLUMN "model_id" SET NOT NULL;

    ALTER TABLE "exterior_options"
      ADD CONSTRAINT "exterior_options_model_id_models_id_fk"
      FOREIGN KEY ("model_id") REFERENCES "public"."models"("id")
      ON DELETE set null ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "exterior_options_model_idx"
      ON "exterior_options" USING btree ("model_id");

    DROP TABLE IF EXISTS "building_models_scene_config_exterior_slots_variants_parts" CASCADE;
    DROP TABLE IF EXISTS "exterior_options_parts" CASCADE;

    -- Availability by line and region went with the parts: an option is a
    -- catalogue entry now, and where it is offered is the spot that lists it.
    DROP TABLE IF EXISTS "exterior_options_rels" CASCADE;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "exterior_options_parts" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "model_id" integer NOT NULL,
      "position_x" numeric DEFAULT 0,
      "position_y" numeric DEFAULT 0,
      "position_z" numeric DEFAULT 0,
      "yaw_deg" numeric DEFAULT 0,
      "scale_x" numeric DEFAULT 1,
      "scale_y" numeric DEFAULT 1,
      "scale_z" numeric DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS "building_models_scene_config_exterior_slots_variants_parts" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "model_id" integer NOT NULL,
      "position_x" numeric DEFAULT 0,
      "position_y" numeric DEFAULT 0,
      "position_z" numeric DEFAULT 0,
      "yaw_deg" numeric DEFAULT 0,
      "scale_x" numeric DEFAULT 1,
      "scale_y" numeric DEFAULT 1,
      "scale_z" numeric DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS "exterior_options_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "building_lines_id" integer,
      "regions_id" integer
    );

    -- One part per option, holding the model the option itself was carrying.
    INSERT INTO "exterior_options_parts"
      ("_order", "_parent_id", "id", "model_id")
    SELECT 1, o."id", gen_random_uuid()::varchar, o."model_id" FROM "exterior_options" AS o;

    -- One part per choice, standing where the choice's placement put it.
    INSERT INTO "building_models_scene_config_exterior_slots_variants_parts"
      ("_order", "_parent_id", "id", "model_id",
       "position_x", "position_y", "position_z", "yaw_deg",
       "scale_x", "scale_y", "scale_z")
    SELECT
      1, v."id", gen_random_uuid()::varchar, o."model_id",
      v."placement_position_x", v."placement_position_y", v."placement_position_z",
      v."placement_yaw_deg",
      v."placement_scale_x", v."placement_scale_y", v."placement_scale_z"
    FROM "building_models_scene_config_exterior_slots_variants" AS v
    JOIN "exterior_options" AS o ON o."id" = v."option_id";

    ALTER TABLE "exterior_options_parts"
      ADD CONSTRAINT "exterior_options_parts_model_id_models_id_fk"
      FOREIGN KEY ("model_id") REFERENCES "public"."models"("id")
      ON DELETE set null ON UPDATE no action;
    ALTER TABLE "exterior_options_parts"
      ADD CONSTRAINT "exterior_options_parts_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."exterior_options"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "building_models_scene_config_exterior_slots_variants_parts"
      ADD CONSTRAINT "building_models_scene_config_exterior_slots_variants_parts_model_id_models_id_fk"
      FOREIGN KEY ("model_id") REFERENCES "public"."models"("id")
      ON DELETE set null ON UPDATE no action;
    ALTER TABLE "building_models_scene_config_exterior_slots_variants_parts"
      ADD CONSTRAINT "building_models_scene_config_exterior_slots_variants_parts_parent_id_fk"
      FOREIGN KEY ("_parent_id")
      REFERENCES "public"."building_models_scene_config_exterior_slots_variants"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "exterior_options_rels"
      ADD CONSTRAINT "exterior_options_rels_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."exterior_options"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "exterior_options_rels"
      ADD CONSTRAINT "exterior_options_rels_building_lines_fk"
      FOREIGN KEY ("building_lines_id") REFERENCES "public"."building_lines"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "exterior_options_rels"
      ADD CONSTRAINT "exterior_options_rels_regions_fk"
      FOREIGN KEY ("regions_id") REFERENCES "public"."regions"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "exterior_options_parts_order_idx"
      ON "exterior_options_parts" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "exterior_options_parts_parent_id_idx"
      ON "exterior_options_parts" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "exterior_options_parts_model_idx"
      ON "exterior_options_parts" USING btree ("model_id");
    CREATE INDEX IF NOT EXISTS "building_models_scene_config_exterior_slots_variants_parts_order_idx"
      ON "building_models_scene_config_exterior_slots_variants_parts" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "building_models_scene_config_exterior_slots_variants_parts_parent_id_idx"
      ON "building_models_scene_config_exterior_slots_variants_parts" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "building_models_scene_config_exterior_slots_variants_par_idx"
      ON "building_models_scene_config_exterior_slots_variants_parts" USING btree ("model_id");
    CREATE INDEX IF NOT EXISTS "exterior_options_rels_order_idx"
      ON "exterior_options_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "exterior_options_rels_parent_idx"
      ON "exterior_options_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "exterior_options_rels_path_idx"
      ON "exterior_options_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "exterior_options_rels_building_lines_id_idx"
      ON "exterior_options_rels" USING btree ("building_lines_id");
    CREATE INDEX IF NOT EXISTS "exterior_options_rels_regions_id_idx"
      ON "exterior_options_rels" USING btree ("regions_id");

    DROP INDEX IF EXISTS "exterior_options_model_idx";
    ALTER TABLE "exterior_options" DROP COLUMN IF EXISTS "model_id";

    ALTER TABLE "building_models_scene_config_exterior_slots_variants"
      DROP COLUMN IF EXISTS "placement_position_x",
      DROP COLUMN IF EXISTS "placement_position_y",
      DROP COLUMN IF EXISTS "placement_position_z",
      DROP COLUMN IF EXISTS "placement_scale_x",
      DROP COLUMN IF EXISTS "placement_scale_y",
      DROP COLUMN IF EXISTS "placement_scale_z",
      DROP COLUMN IF EXISTS "placement_yaw_deg";
  `)
}
