import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "furniture_packages" ALTER COLUMN "footprint_width" DROP NOT NULL;
  ALTER TABLE "furniture_packages" ALTER COLUMN "footprint_depth" DROP NOT NULL;
  ALTER TABLE "building_models" ADD COLUMN "scene_config_roof_model_model_id" integer;
  ALTER TABLE "building_models" ADD COLUMN "scene_config_roof_model_position_x" numeric DEFAULT 0;
  ALTER TABLE "building_models" ADD COLUMN "scene_config_roof_model_position_y" numeric DEFAULT 0;
  ALTER TABLE "building_models" ADD COLUMN "scene_config_roof_model_position_z" numeric DEFAULT 0;
  ALTER TABLE "building_models" ADD COLUMN "scene_config_roof_model_yaw_deg" numeric DEFAULT 0;
  ALTER TABLE "building_models" ADD COLUMN "scene_config_roof_model_scale" numeric DEFAULT 1;
  ALTER TABLE "building_models" ADD CONSTRAINT "building_models_scene_config_roof_model_model_id_models_id_fk" FOREIGN KEY ("scene_config_roof_model_model_id") REFERENCES "public"."models"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "building_models_scene_config_roof_model_scene_config_roo_idx" ON "building_models" USING btree ("scene_config_roof_model_model_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "building_models" DROP CONSTRAINT "building_models_scene_config_roof_model_model_id_models_id_fk";
  
  DROP INDEX "building_models_scene_config_roof_model_scene_config_roo_idx";
  ALTER TABLE "furniture_packages" ALTER COLUMN "footprint_width" SET NOT NULL;
  ALTER TABLE "furniture_packages" ALTER COLUMN "footprint_depth" SET NOT NULL;
  ALTER TABLE "building_models" DROP COLUMN "scene_config_roof_model_model_id";
  ALTER TABLE "building_models" DROP COLUMN "scene_config_roof_model_position_x";
  ALTER TABLE "building_models" DROP COLUMN "scene_config_roof_model_position_y";
  ALTER TABLE "building_models" DROP COLUMN "scene_config_roof_model_position_z";
  ALTER TABLE "building_models" DROP COLUMN "scene_config_roof_model_yaw_deg";
  ALTER TABLE "building_models" DROP COLUMN "scene_config_roof_model_scale";`)
}
