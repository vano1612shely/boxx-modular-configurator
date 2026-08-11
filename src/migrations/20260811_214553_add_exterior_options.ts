import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "building_models_scene_config_exterior_slots_variants_parts" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"model_id" integer NOT NULL,
  	"position_x" numeric DEFAULT 0,
  	"position_y" numeric DEFAULT 0,
  	"position_z" numeric DEFAULT 0,
  	"yaw_deg" numeric DEFAULT 0,
  	"scale" numeric DEFAULT 1
  );
  
  CREATE TABLE "building_models_scene_config_exterior_slots_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"option_id" integer NOT NULL,
  	"nodes" jsonb
  );
  
  CREATE TABLE "building_models_scene_config_exterior_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"position_x" numeric DEFAULT 0,
  	"position_y" numeric DEFAULT 0,
  	"position_z" numeric DEFAULT 0,
  	"yaw_deg" numeric DEFAULT 0,
  	"default_variant_key" varchar
  );
  
  CREATE TABLE "exterior_options_parts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"model_id" integer NOT NULL,
  	"position_x" numeric DEFAULT 0,
  	"position_y" numeric DEFAULT 0,
  	"position_z" numeric DEFAULT 0,
  	"yaw_deg" numeric DEFAULT 0,
  	"scale" numeric DEFAULT 1
  );
  
  CREATE TABLE "exterior_options" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"price" numeric,
  	"thumbnail_id" integer,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "exterior_options_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"building_lines_id" integer,
  	"regions_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "exterior_options_id" integer;
  ALTER TABLE "building_models_scene_config_exterior_slots_variants_parts" ADD CONSTRAINT "building_models_scene_config_exterior_slots_variants_parts_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "building_models_scene_config_exterior_slots_variants_parts" ADD CONSTRAINT "building_models_scene_config_exterior_slots_variants_parts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."building_models_scene_config_exterior_slots_variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "building_models_scene_config_exterior_slots_variants" ADD CONSTRAINT "building_models_scene_config_exterior_slots_variants_option_id_exterior_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."exterior_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "building_models_scene_config_exterior_slots_variants" ADD CONSTRAINT "building_models_scene_config_exterior_slots_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."building_models_scene_config_exterior_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "building_models_scene_config_exterior_slots" ADD CONSTRAINT "building_models_scene_config_exterior_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."building_models"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "exterior_options_parts" ADD CONSTRAINT "exterior_options_parts_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "exterior_options_parts" ADD CONSTRAINT "exterior_options_parts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."exterior_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "exterior_options" ADD CONSTRAINT "exterior_options_thumbnail_id_images_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "exterior_options_rels" ADD CONSTRAINT "exterior_options_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."exterior_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "exterior_options_rels" ADD CONSTRAINT "exterior_options_rels_building_lines_fk" FOREIGN KEY ("building_lines_id") REFERENCES "public"."building_lines"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "exterior_options_rels" ADD CONSTRAINT "exterior_options_rels_regions_fk" FOREIGN KEY ("regions_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "building_models_scene_config_exterior_slots_variants_parts_order_idx" ON "building_models_scene_config_exterior_slots_variants_parts" USING btree ("_order");
  CREATE INDEX "building_models_scene_config_exterior_slots_variants_parts_parent_id_idx" ON "building_models_scene_config_exterior_slots_variants_parts" USING btree ("_parent_id");
  CREATE INDEX "building_models_scene_config_exterior_slots_variants_par_idx" ON "building_models_scene_config_exterior_slots_variants_parts" USING btree ("model_id");
  CREATE INDEX "building_models_scene_config_exterior_slots_variants_order_idx" ON "building_models_scene_config_exterior_slots_variants" USING btree ("_order");
  CREATE INDEX "building_models_scene_config_exterior_slots_variants_parent_id_idx" ON "building_models_scene_config_exterior_slots_variants" USING btree ("_parent_id");
  CREATE INDEX "building_models_scene_config_exterior_slots_variants_opt_idx" ON "building_models_scene_config_exterior_slots_variants" USING btree ("option_id");
  CREATE INDEX "building_models_scene_config_exterior_slots_order_idx" ON "building_models_scene_config_exterior_slots" USING btree ("_order");
  CREATE INDEX "building_models_scene_config_exterior_slots_parent_id_idx" ON "building_models_scene_config_exterior_slots" USING btree ("_parent_id");
  CREATE INDEX "exterior_options_parts_order_idx" ON "exterior_options_parts" USING btree ("_order");
  CREATE INDEX "exterior_options_parts_parent_id_idx" ON "exterior_options_parts" USING btree ("_parent_id");
  CREATE INDEX "exterior_options_parts_model_idx" ON "exterior_options_parts" USING btree ("model_id");
  CREATE INDEX "exterior_options_thumbnail_idx" ON "exterior_options" USING btree ("thumbnail_id");
  CREATE INDEX "exterior_options_updated_at_idx" ON "exterior_options" USING btree ("updated_at");
  CREATE INDEX "exterior_options_created_at_idx" ON "exterior_options" USING btree ("created_at");
  CREATE INDEX "exterior_options_rels_order_idx" ON "exterior_options_rels" USING btree ("order");
  CREATE INDEX "exterior_options_rels_parent_idx" ON "exterior_options_rels" USING btree ("parent_id");
  CREATE INDEX "exterior_options_rels_path_idx" ON "exterior_options_rels" USING btree ("path");
  CREATE INDEX "exterior_options_rels_building_lines_id_idx" ON "exterior_options_rels" USING btree ("building_lines_id");
  CREATE INDEX "exterior_options_rels_regions_id_idx" ON "exterior_options_rels" USING btree ("regions_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_exterior_options_fk" FOREIGN KEY ("exterior_options_id") REFERENCES "public"."exterior_options"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_exterior_options_id_idx" ON "payload_locked_documents_rels" USING btree ("exterior_options_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "building_models_scene_config_exterior_slots_variants_parts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "building_models_scene_config_exterior_slots_variants" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "building_models_scene_config_exterior_slots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "exterior_options_parts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "exterior_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "exterior_options_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "building_models_scene_config_exterior_slots_variants_parts" CASCADE;
  DROP TABLE "building_models_scene_config_exterior_slots_variants" CASCADE;
  DROP TABLE "building_models_scene_config_exterior_slots" CASCADE;
  DROP TABLE "exterior_options_parts" CASCADE;
  DROP TABLE "exterior_options" CASCADE;
  DROP TABLE "exterior_options_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_exterior_options_fk";
  
  DROP INDEX "payload_locked_documents_rels_exterior_options_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "exterior_options_id";`)
}
