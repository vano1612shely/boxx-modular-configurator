import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Room types and furniture tiers become catalogues an admin can add to.
 *
 * They were fixed lists in the code, so a new kind of room meant a deploy. The
 * words themselves do not change — the rows are created with the same keys the
 * enums used, and everything that pointed at a word now points at the row with
 * that key. Nothing an admin authored is lost or reassigned.
 *
 * `family` on a furniture package goes at the same time. It was required, had
 * five values that shadowed the room types, and was read in exactly one place:
 * the caption on the package card. What decides where a package may go is
 * `compatibleRoomTypes`, and always was, so this was the same fact written
 * twice with only one copy doing anything.
 *
 * Written by hand. The generator asks whether each new table is a rename of one
 * of the two it is replacing — and it is not, it is a table of terms both of
 * them will come to point at — and answering that wrong quietly turns a list of
 * choices into the catalogue itself.
 */

/** The words the enums held, which become the first rows of each catalogue. */
const ROOM_TYPES: Array<[string, string]> = [
  ['Office', 'office'],
  ['Classroom', 'classroom'],
  ['Conference', 'conference'],
  ['Kitchen', 'kitchen'],
  ['Restroom', 'restroom'],
  ['Lounge', 'lounge'],
  ['Hallway', 'hallway'],
  ['Other', 'other'],
]

const TIERS: Array<[string, string]> = [
  ['Core', 'core'],
  ['Plus', 'plus'],
]

const rows = (terms: Array<[string, string]>) =>
  terms.map(([name, slug]) => `('${name}', '${slug}', now(), now())`).join(', ')

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "room_types" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "furniture_tiers" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "room_types_slug_idx" ON "room_types" USING btree ("slug");
    CREATE INDEX IF NOT EXISTS "room_types_updated_at_idx" ON "room_types" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "room_types_created_at_idx" ON "room_types" USING btree ("created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "furniture_tiers_slug_idx" ON "furniture_tiers" USING btree ("slug");
    CREATE INDEX IF NOT EXISTS "furniture_tiers_updated_at_idx" ON "furniture_tiers" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "furniture_tiers_created_at_idx" ON "furniture_tiers" USING btree ("created_at");

    INSERT INTO "room_types" ("name", "slug", "updated_at", "created_at")
    VALUES ${rows(ROOM_TYPES)} ON CONFLICT ("slug") DO NOTHING;

    INSERT INTO "furniture_tiers" ("name", "slug", "updated_at", "created_at")
    VALUES ${rows(TIERS)} ON CONFLICT ("slug") DO NOTHING;

    -- A room points at the row whose key is the word it was typed with.
    ALTER TABLE "building_models_rooms" ADD COLUMN IF NOT EXISTS "room_type_id" integer;

    UPDATE "building_models_rooms" AS r SET "room_type_id" = t."id"
    FROM "room_types" AS t WHERE t."slug" = r."room_type"::text;

    -- Nothing should be left, since every enum value has a row. A room that
    -- somehow has none keeps the first type rather than blocking the NOT NULL.
    UPDATE "building_models_rooms" SET "room_type_id" = (
      SELECT "id" FROM "room_types" ORDER BY "id" LIMIT 1
    ) WHERE "room_type_id" IS NULL;

    ALTER TABLE "building_models_rooms" ALTER COLUMN "room_type_id" SET NOT NULL;
    ALTER TABLE "building_models_rooms" DROP COLUMN IF EXISTS "room_type";

    ALTER TABLE "building_models_rooms"
      ADD CONSTRAINT "building_models_rooms_room_type_id_room_types_id_fk"
      FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id")
      ON DELETE set null ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "building_models_rooms_room_type_idx"
      ON "building_models_rooms" USING btree ("room_type_id");

    -- The grade, likewise. Nullable: a package without one simply shows no chip.
    ALTER TABLE "furniture_packages" ADD COLUMN IF NOT EXISTS "tier_id" integer;

    UPDATE "furniture_packages" AS p SET "tier_id" = t."id"
    FROM "furniture_tiers" AS t WHERE t."slug" = p."tier"::text;

    ALTER TABLE "furniture_packages" DROP COLUMN IF EXISTS "tier";
    ALTER TABLE "furniture_packages" DROP COLUMN IF EXISTS "family";

    ALTER TABLE "furniture_packages"
      ADD CONSTRAINT "furniture_packages_tier_id_furniture_tiers_id_fk"
      FOREIGN KEY ("tier_id") REFERENCES "public"."furniture_tiers"("id")
      ON DELETE set null ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "furniture_packages_tier_idx"
      ON "furniture_packages" USING btree ("tier_id");

    -- Where a package may go, and where it is offered first. Both were lists of
    -- words in tables of their own; as relationships they join the rows the
    -- package already keeps for its lines and regions.
    ALTER TABLE "furniture_packages_rels" ADD COLUMN IF NOT EXISTS "room_types_id" integer;

    INSERT INTO "furniture_packages_rels" ("order", "parent_id", "path", "room_types_id")
    SELECT c."order", c."parent_id", 'compatibleRoomTypes', t."id"
    FROM "furniture_packages_compatible_room_types" AS c
    JOIN "room_types" AS t ON t."slug" = c."value"::text;

    INSERT INTO "furniture_packages_rels" ("order", "parent_id", "path", "room_types_id")
    SELECT r."order", r."parent_id", 'recommendedFor', t."id"
    FROM "furniture_packages_recommended_for" AS r
    JOIN "room_types" AS t ON t."slug" = r."value"::text;

    ALTER TABLE "furniture_packages_rels"
      ADD CONSTRAINT "furniture_packages_rels_room_types_fk"
      FOREIGN KEY ("room_types_id") REFERENCES "public"."room_types"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "furniture_packages_rels_room_types_id_idx"
      ON "furniture_packages_rels" USING btree ("room_types_id");

    DROP TABLE IF EXISTS "furniture_packages_compatible_room_types" CASCADE;
    DROP TABLE IF EXISTS "furniture_packages_recommended_for" CASCADE;

    -- Both catalogues are editable documents, so they can be locked like any other.
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "room_types_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "furniture_tiers_id" integer;

    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_room_types_fk"
      FOREIGN KEY ("room_types_id") REFERENCES "public"."room_types"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_furniture_tiers_fk"
      FOREIGN KEY ("furniture_tiers_id") REFERENCES "public"."furniture_tiers"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_room_types_id_idx"
      ON "payload_locked_documents_rels" USING btree ("room_types_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_furniture_tiers_id_idx"
      ON "payload_locked_documents_rels" USING btree ("furniture_tiers_id");

    DROP TYPE IF EXISTS "public"."enum_building_models_rooms_room_type";
    DROP TYPE IF EXISTS "public"."enum_furniture_packages_tier";
    DROP TYPE IF EXISTS "public"."enum_furniture_packages_family";
    DROP TYPE IF EXISTS "public"."enum_furniture_packages_compatible_room_types";
    DROP TYPE IF EXISTS "public"."enum_furniture_packages_recommended_for";
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const values = ROOM_TYPES.map(([, slug]) => `'${slug}'`).join(', ')

  await db.execute(sql.raw(`
    CREATE TYPE "public"."enum_building_models_rooms_room_type" AS ENUM(${values});
    CREATE TYPE "public"."enum_furniture_packages_compatible_room_types" AS ENUM(${values});
    CREATE TYPE "public"."enum_furniture_packages_recommended_for" AS ENUM(${values});
    CREATE TYPE "public"."enum_furniture_packages_tier" AS ENUM('core', 'plus');
    CREATE TYPE "public"."enum_furniture_packages_family" AS ENUM('office', 'conference', 'kitchen', 'seating', 'other');

    -- Types an admin added since have no word in the enum to go back to, so
    -- their rooms land on "other" — the value that meant "none of these".
    ALTER TABLE "building_models_rooms"
      ADD COLUMN IF NOT EXISTS "room_type" "enum_building_models_rooms_room_type";

    UPDATE "building_models_rooms" AS r SET "room_type" =
      (CASE WHEN t."slug" IN (${values}) THEN t."slug" ELSE 'other' END)
      ::"enum_building_models_rooms_room_type"
    FROM "room_types" AS t WHERE t."id" = r."room_type_id";

    UPDATE "building_models_rooms" SET "room_type" = 'other' WHERE "room_type" IS NULL;
    ALTER TABLE "building_models_rooms" ALTER COLUMN "room_type" SET NOT NULL;

    ALTER TABLE "furniture_packages"
      ADD COLUMN IF NOT EXISTS "tier" "enum_furniture_packages_tier",
      ADD COLUMN IF NOT EXISTS "family" "enum_furniture_packages_family";

    UPDATE "furniture_packages" AS p SET "tier" =
      (CASE WHEN t."slug" IN ('core', 'plus') THEN t."slug" ELSE 'core' END)
      ::"enum_furniture_packages_tier"
    FROM "furniture_tiers" AS t WHERE t."id" = p."tier_id";

    -- Nothing to restore it from: it was dropped because nothing produced it.
    UPDATE "furniture_packages" SET "tier" = 'core' WHERE "tier" IS NULL;
    UPDATE "furniture_packages" SET "family" = 'other' WHERE "family" IS NULL;
    ALTER TABLE "furniture_packages" ALTER COLUMN "tier" SET NOT NULL;
    ALTER TABLE "furniture_packages" ALTER COLUMN "family" SET NOT NULL;

    CREATE TABLE IF NOT EXISTS "furniture_packages_compatible_room_types" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_furniture_packages_compatible_room_types",
      "id" serial PRIMARY KEY NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "furniture_packages_recommended_for" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_furniture_packages_recommended_for",
      "id" serial PRIMARY KEY NOT NULL
    );

    INSERT INTO "furniture_packages_compatible_room_types" ("order", "parent_id", "value")
    SELECT rel."order", rel."parent_id",
           t."slug"::"enum_furniture_packages_compatible_room_types"
    FROM "furniture_packages_rels" AS rel
    JOIN "room_types" AS t ON t."id" = rel."room_types_id"
    WHERE rel."path" = 'compatibleRoomTypes' AND t."slug" IN (${values});

    INSERT INTO "furniture_packages_recommended_for" ("order", "parent_id", "value")
    SELECT rel."order", rel."parent_id",
           t."slug"::"enum_furniture_packages_recommended_for"
    FROM "furniture_packages_rels" AS rel
    JOIN "room_types" AS t ON t."id" = rel."room_types_id"
    WHERE rel."path" = 'recommendedFor' AND t."slug" IN (${values});

    ALTER TABLE "furniture_packages_compatible_room_types"
      ADD CONSTRAINT "furniture_packages_compatible_room_types_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."furniture_packages"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "furniture_packages_recommended_for"
      ADD CONSTRAINT "furniture_packages_recommended_for_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."furniture_packages"("id")
      ON DELETE cascade ON UPDATE no action;

    DELETE FROM "furniture_packages_rels" WHERE "room_types_id" IS NOT NULL;

    ALTER TABLE "building_models_rooms" DROP COLUMN IF EXISTS "room_type_id";
    ALTER TABLE "furniture_packages" DROP COLUMN IF EXISTS "tier_id";
    ALTER TABLE "furniture_packages_rels" DROP COLUMN IF EXISTS "room_types_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "room_types_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "furniture_tiers_id";

    DROP TABLE IF EXISTS "room_types" CASCADE;
    DROP TABLE IF EXISTS "furniture_tiers" CASCADE;
  `))
}
