import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "quiz_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"logo_id" integer,
  	"step1_eyebrow" varchar DEFAULT 'Find your solution',
  	"step1_title" varchar DEFAULT 'What kind of building do you need?',
  	"step1_description" varchar,
  	"step2_title" varchar DEFAULT 'How much space do you need?',
  	"step2_description" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "building_models_rooms" ADD COLUMN "zones" jsonb;
  ALTER TABLE "quiz_settings" ADD CONSTRAINT "quiz_settings_logo_id_images_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "quiz_settings_logo_idx" ON "quiz_settings" USING btree ("logo_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "quiz_settings" CASCADE;
  ALTER TABLE "building_models_rooms" DROP COLUMN "zones";`)
}
