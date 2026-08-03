import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "building_models_scene_config_floors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"box_min_x" numeric DEFAULT 0 NOT NULL,
  	"box_min_y" numeric DEFAULT 0 NOT NULL,
  	"box_min_z" numeric DEFAULT 0 NOT NULL,
  	"box_max_x" numeric DEFAULT 0 NOT NULL,
  	"box_max_y" numeric DEFAULT 0 NOT NULL,
  	"box_max_z" numeric DEFAULT 0 NOT NULL
  );
  
  ALTER TABLE "building_models_scene_config_floors" ADD CONSTRAINT "building_models_scene_config_floors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."building_models"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "building_models_scene_config_floors_order_idx" ON "building_models_scene_config_floors" USING btree ("_order");
  CREATE INDEX "building_models_scene_config_floors_parent_id_idx" ON "building_models_scene_config_floors" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "building_models_scene_config_floors" CASCADE;`)
}
