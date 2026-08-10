import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_display_settings_area_unit" AS ENUM('sqft', 'sqm');
  CREATE TABLE "display_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"area_unit" "enum_display_settings_area_unit" DEFAULT 'sqft' NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "building_models_rooms" ADD COLUMN "area_sq_m" numeric;
  ALTER TABLE "building_models" ADD COLUMN "sqm" numeric;
  ALTER TABLE "building_models" ADD COLUMN "dimensions_metric" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "display_settings" CASCADE;
  ALTER TABLE "building_models_rooms" DROP COLUMN "area_sq_m";
  ALTER TABLE "building_models" DROP COLUMN "sqm";
  ALTER TABLE "building_models" DROP COLUMN "dimensions_metric";
  DROP TYPE "public"."enum_display_settings_area_unit";`)
}
