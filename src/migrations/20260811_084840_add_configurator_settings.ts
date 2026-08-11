import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_configurator_settings_area_unit" AS ENUM('sqft', 'sqm');
  CREATE TABLE "configurator_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"meta_title" varchar DEFAULT '3D Building Configurator',
  	"meta_description" varchar DEFAULT 'Configure a modular building and furnish it with furniture packages.',
  	"meta_og_image_id" integer,
  	"meta_favicon_id" integer,
  	"logo_id" integer,
  	"step1_eyebrow" varchar DEFAULT 'Find your solution',
  	"step1_title" varchar DEFAULT 'What kind of building do you need?',
  	"step1_description" varchar,
  	"step1_list_label" varchar DEFAULT 'Building line',
  	"step2_title" varchar DEFAULT 'How much space do you need?',
  	"step2_description" varchar,
  	"step2_offices_label" varchar DEFAULT 'Offices',
  	"step2_classrooms_label" varchar DEFAULT 'Classrooms',
  	"step2_over_capacity_hint" varchar DEFAULT 'Beyond the largest standard size — we’ll quote it as a custom build.',
  	"step2_restrooms_label" varchar DEFAULT 'Restrooms',
  	"step2_restrooms_hint" varchar DEFAULT 'We’ll pick the closest model that covers it.',
  	"step2_back" varchar DEFAULT 'Back',
  	"step2_submit" varchar DEFAULT 'Show my building',
  	"not_found_title" varchar DEFAULT 'Nothing to configure yet',
  	"not_found_body" varchar DEFAULT 'No buildings are available for this selection right now. Please try again shortly.',
  	"over_capacity_chip" varchar DEFAULT 'Custom build',
  	"over_capacity_title" varchar DEFAULT 'That’s a big project — we like it.',
  	"over_capacity_body" varchar DEFAULT '{units} units is beyond the largest standard {line} configuration. Our team will put together an individual proposal for you.',
  	"over_capacity_action" varchar DEFAULT 'Adjust request',
  	"area_unit" "enum_configurator_settings_area_unit" DEFAULT 'sqft' NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "configurator_settings" ADD CONSTRAINT "configurator_settings_meta_og_image_id_images_id_fk" FOREIGN KEY ("meta_og_image_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "configurator_settings" ADD CONSTRAINT "configurator_settings_meta_favicon_id_images_id_fk" FOREIGN KEY ("meta_favicon_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "configurator_settings" ADD CONSTRAINT "configurator_settings_logo_id_images_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "configurator_settings_meta_meta_og_image_idx" ON "configurator_settings" USING btree ("meta_og_image_id");
  CREATE INDEX "configurator_settings_meta_meta_favicon_idx" ON "configurator_settings" USING btree ("meta_favicon_id");
  CREATE INDEX "configurator_settings_logo_idx" ON "configurator_settings" USING btree ("logo_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "configurator_settings" CASCADE;
  DROP TYPE "public"."enum_configurator_settings_area_unit";`)
}
