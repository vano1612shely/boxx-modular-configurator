import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_building_lines_unit_label" AS ENUM('offices', 'classrooms');
  CREATE TYPE "public"."enum_building_models_rooms_floor_polygon_side" AS ENUM('w1', 'w2', 'w3', 'w4');
  CREATE TYPE "public"."enum_building_models_rooms_room_type" AS ENUM('office', 'classroom', 'conference', 'kitchen', 'restroom', 'lounge', 'hallway', 'other');
  CREATE TYPE "public"."enum_building_models_rooms_shell_sun_direction" AS ENUM('n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw');
  CREATE TYPE "public"."enum_building_models_rooms_opening_models_door_fit" AS ENUM('stretch', 'contain', 'none');
  CREATE TYPE "public"."enum_building_models_rooms_opening_models_window_fit" AS ENUM('stretch', 'contain', 'none');
  CREATE TYPE "public"."enum_furniture_packages_compatible_room_types" AS ENUM('office', 'classroom', 'conference', 'kitchen', 'restroom', 'lounge', 'hallway', 'other');
  CREATE TYPE "public"."enum_furniture_packages_family" AS ENUM('office', 'conference', 'kitchen', 'seating', 'other');
  CREATE TYPE "public"."enum_furniture_packages_tier" AS ENUM('core', 'plus');
  CREATE TYPE "public"."enum_quotes_status" AS ENUM('new', 'forwarded', 'webhook-failed');
  CREATE TABLE "regions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"code" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "building_lines" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"unit_label" "enum_building_lines_unit_label" DEFAULT 'offices' NOT NULL,
  	"description" varchar,
  	"rules_restrooms_required_at" numeric,
  	"rules_second_restroom_set_at" numeric,
  	"rules_max_units" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "building_lines_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"regions_id" integer
  );
  
  CREATE TABLE "building_models_scene_config_roof_blocks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"min_x" numeric DEFAULT 0 NOT NULL,
  	"min_y" numeric DEFAULT 0 NOT NULL,
  	"min_z" numeric DEFAULT 0 NOT NULL,
  	"max_x" numeric DEFAULT 0 NOT NULL,
  	"max_y" numeric DEFAULT 0 NOT NULL,
  	"max_z" numeric DEFAULT 0 NOT NULL
  );
  
  CREATE TABLE "building_models_rooms_floor_polygon" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"x" numeric NOT NULL,
  	"z" numeric NOT NULL,
  	"side" "enum_building_models_rooms_floor_polygon_side" DEFAULT 'w1'
  );
  
  CREATE TABLE "building_models_rooms" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"room_type" "enum_building_models_rooms_room_type" NOT NULL,
  	"shell_floor_y" numeric DEFAULT 0,
  	"shell_wall_height" numeric DEFAULT 2.5,
  	"shell_wall_thickness" numeric DEFAULT 0.03,
  	"shell_floor_thickness" numeric DEFAULT 0.03,
  	"shell_ceiling_thickness" numeric DEFAULT 0.03,
  	"shell_sun_direction" "enum_building_models_rooms_shell_sun_direction",
  	"shell_side_axes" jsonb,
  	"openings" jsonb,
  	"surfaces_wall_inner_texture_id" integer,
  	"surfaces_wall_inner_tile_width" numeric DEFAULT 1,
  	"surfaces_wall_inner_tile_height" numeric DEFAULT 1,
  	"surfaces_floor_texture_id" integer,
  	"surfaces_floor_tile_width" numeric DEFAULT 1,
  	"surfaces_floor_tile_height" numeric DEFAULT 1,
  	"surfaces_ceiling_texture_id" integer,
  	"surfaces_ceiling_tile_width" numeric DEFAULT 1,
  	"surfaces_ceiling_tile_height" numeric DEFAULT 1,
  	"opening_models_door_model_id" integer,
  	"opening_models_door_fit" "enum_building_models_rooms_opening_models_door_fit" DEFAULT 'stretch',
  	"opening_models_door_yaw_deg" numeric DEFAULT 0,
  	"opening_models_door_depth" numeric DEFAULT 0,
  	"opening_models_window_model_id" integer,
  	"opening_models_window_fit" "enum_building_models_rooms_opening_models_window_fit" DEFAULT 'stretch',
  	"opening_models_window_yaw_deg" numeric DEFAULT 0,
  	"opening_models_window_depth" numeric DEFAULT 0,
  	"camera_preset_position_x" numeric DEFAULT 0,
  	"camera_preset_position_y" numeric DEFAULT 0,
  	"camera_preset_position_z" numeric DEFAULT 0,
  	"camera_preset_target_x" numeric DEFAULT 0,
  	"camera_preset_target_y" numeric DEFAULT 0,
  	"camera_preset_target_z" numeric DEFAULT 0
  );
  
  CREATE TABLE "building_models" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"line_id" integer NOT NULL,
  	"unit_count" numeric NOT NULL,
  	"restroom_count" numeric DEFAULT 0,
  	"sqft" numeric,
  	"dimensions" varchar,
  	"model_id" integer NOT NULL,
  	"thumbnail_id" integer,
  	"scene_config_camera_position_x" numeric DEFAULT 0,
  	"scene_config_camera_position_y" numeric DEFAULT 0,
  	"scene_config_camera_position_z" numeric DEFAULT 0,
  	"scene_config_camera_target_x" numeric DEFAULT 0,
  	"scene_config_camera_target_y" numeric DEFAULT 0,
  	"scene_config_camera_target_z" numeric DEFAULT 0,
  	"scene_config_camera_fov" numeric DEFAULT 50,
  	"scene_config_camera_min_distance" numeric DEFAULT 2,
  	"scene_config_camera_max_distance" numeric DEFAULT 30,
  	"scene_config_camera_min_polar_deg" numeric DEFAULT 15,
  	"scene_config_camera_max_polar_deg" numeric DEFAULT 85,
  	"scene_config_hidden_node_paths" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "building_models_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"regions_id" integer
  );
  
  CREATE TABLE "furniture_packages_compatible_room_types" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_furniture_packages_compatible_room_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "furniture_packages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"family" "enum_furniture_packages_family" NOT NULL,
  	"tier" "enum_furniture_packages_tier" DEFAULT 'core' NOT NULL,
  	"model_id" integer NOT NULL,
  	"thumbnail_id" integer,
  	"price" numeric,
  	"description" varchar,
  	"footprint_width" numeric NOT NULL,
  	"footprint_depth" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "furniture_packages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"building_lines_id" integer,
  	"regions_id" integer
  );
  
  CREATE TABLE "quotes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"status" "enum_quotes_status" DEFAULT 'new',
  	"contact_name" varchar,
  	"contact_email" varchar,
  	"contact_phone" varchar,
  	"contact_company" varchar,
  	"building_model_id" integer,
  	"configuration" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "images" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar
  );
  
  CREATE TABLE "models" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"meta_size_before" numeric,
  	"meta_size_after" numeric,
  	"meta_triangles" numeric,
  	"meta_meshes" numeric,
  	"meta_materials" numeric,
  	"meta_textures" numeric,
  	"meta_bbox_min" jsonb,
  	"meta_bbox_max" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "textures" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"meta_width" numeric,
  	"meta_height" numeric,
  	"meta_size_before" numeric,
  	"meta_size_after" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"regions_id" integer,
  	"building_lines_id" integer,
  	"building_models_id" integer,
  	"furniture_packages_id" integer,
  	"quotes_id" integer,
  	"images_id" integer,
  	"models_id" integer,
  	"textures_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "integration_settings_webhook_headers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "integration_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"webhook_url" varchar,
  	"enable_post_message" boolean DEFAULT true,
  	"target_origin" varchar DEFAULT '*',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "building_lines_rels" ADD CONSTRAINT "building_lines_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."building_lines"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "building_lines_rels" ADD CONSTRAINT "building_lines_rels_regions_fk" FOREIGN KEY ("regions_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "building_models_scene_config_roof_blocks" ADD CONSTRAINT "building_models_scene_config_roof_blocks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."building_models"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "building_models_rooms_floor_polygon" ADD CONSTRAINT "building_models_rooms_floor_polygon_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."building_models_rooms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "building_models_rooms" ADD CONSTRAINT "building_models_rooms_surfaces_wall_inner_texture_id_textures_id_fk" FOREIGN KEY ("surfaces_wall_inner_texture_id") REFERENCES "public"."textures"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "building_models_rooms" ADD CONSTRAINT "building_models_rooms_surfaces_floor_texture_id_textures_id_fk" FOREIGN KEY ("surfaces_floor_texture_id") REFERENCES "public"."textures"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "building_models_rooms" ADD CONSTRAINT "building_models_rooms_surfaces_ceiling_texture_id_textures_id_fk" FOREIGN KEY ("surfaces_ceiling_texture_id") REFERENCES "public"."textures"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "building_models_rooms" ADD CONSTRAINT "building_models_rooms_opening_models_door_model_id_models_id_fk" FOREIGN KEY ("opening_models_door_model_id") REFERENCES "public"."models"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "building_models_rooms" ADD CONSTRAINT "building_models_rooms_opening_models_window_model_id_models_id_fk" FOREIGN KEY ("opening_models_window_model_id") REFERENCES "public"."models"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "building_models_rooms" ADD CONSTRAINT "building_models_rooms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."building_models"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "building_models" ADD CONSTRAINT "building_models_line_id_building_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."building_lines"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "building_models" ADD CONSTRAINT "building_models_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "building_models" ADD CONSTRAINT "building_models_thumbnail_id_images_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "building_models_rels" ADD CONSTRAINT "building_models_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."building_models"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "building_models_rels" ADD CONSTRAINT "building_models_rels_regions_fk" FOREIGN KEY ("regions_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "furniture_packages_compatible_room_types" ADD CONSTRAINT "furniture_packages_compatible_room_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."furniture_packages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "furniture_packages" ADD CONSTRAINT "furniture_packages_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "furniture_packages" ADD CONSTRAINT "furniture_packages_thumbnail_id_images_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "furniture_packages_rels" ADD CONSTRAINT "furniture_packages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."furniture_packages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "furniture_packages_rels" ADD CONSTRAINT "furniture_packages_rels_building_lines_fk" FOREIGN KEY ("building_lines_id") REFERENCES "public"."building_lines"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "furniture_packages_rels" ADD CONSTRAINT "furniture_packages_rels_regions_fk" FOREIGN KEY ("regions_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_building_model_id_building_models_id_fk" FOREIGN KEY ("building_model_id") REFERENCES "public"."building_models"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_regions_fk" FOREIGN KEY ("regions_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_building_lines_fk" FOREIGN KEY ("building_lines_id") REFERENCES "public"."building_lines"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_building_models_fk" FOREIGN KEY ("building_models_id") REFERENCES "public"."building_models"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_furniture_packages_fk" FOREIGN KEY ("furniture_packages_id") REFERENCES "public"."furniture_packages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quotes_fk" FOREIGN KEY ("quotes_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_images_fk" FOREIGN KEY ("images_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_models_fk" FOREIGN KEY ("models_id") REFERENCES "public"."models"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_textures_fk" FOREIGN KEY ("textures_id") REFERENCES "public"."textures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "integration_settings_webhook_headers" ADD CONSTRAINT "integration_settings_webhook_headers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."integration_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "regions_code_idx" ON "regions" USING btree ("code");
  CREATE INDEX "regions_updated_at_idx" ON "regions" USING btree ("updated_at");
  CREATE INDEX "regions_created_at_idx" ON "regions" USING btree ("created_at");
  CREATE UNIQUE INDEX "building_lines_slug_idx" ON "building_lines" USING btree ("slug");
  CREATE INDEX "building_lines_updated_at_idx" ON "building_lines" USING btree ("updated_at");
  CREATE INDEX "building_lines_created_at_idx" ON "building_lines" USING btree ("created_at");
  CREATE INDEX "building_lines_rels_order_idx" ON "building_lines_rels" USING btree ("order");
  CREATE INDEX "building_lines_rels_parent_idx" ON "building_lines_rels" USING btree ("parent_id");
  CREATE INDEX "building_lines_rels_path_idx" ON "building_lines_rels" USING btree ("path");
  CREATE INDEX "building_lines_rels_regions_id_idx" ON "building_lines_rels" USING btree ("regions_id");
  CREATE INDEX "building_models_scene_config_roof_blocks_order_idx" ON "building_models_scene_config_roof_blocks" USING btree ("_order");
  CREATE INDEX "building_models_scene_config_roof_blocks_parent_id_idx" ON "building_models_scene_config_roof_blocks" USING btree ("_parent_id");
  CREATE INDEX "building_models_rooms_floor_polygon_order_idx" ON "building_models_rooms_floor_polygon" USING btree ("_order");
  CREATE INDEX "building_models_rooms_floor_polygon_parent_id_idx" ON "building_models_rooms_floor_polygon" USING btree ("_parent_id");
  CREATE INDEX "building_models_rooms_order_idx" ON "building_models_rooms" USING btree ("_order");
  CREATE INDEX "building_models_rooms_parent_id_idx" ON "building_models_rooms" USING btree ("_parent_id");
  CREATE INDEX "building_models_rooms_surfaces_wall_inner_surfaces_wall__idx" ON "building_models_rooms" USING btree ("surfaces_wall_inner_texture_id");
  CREATE INDEX "building_models_rooms_surfaces_floor_surfaces_floor_text_idx" ON "building_models_rooms" USING btree ("surfaces_floor_texture_id");
  CREATE INDEX "building_models_rooms_surfaces_ceiling_surfaces_ceiling__idx" ON "building_models_rooms" USING btree ("surfaces_ceiling_texture_id");
  CREATE INDEX "building_models_rooms_opening_models_door_opening_models_idx" ON "building_models_rooms" USING btree ("opening_models_door_model_id");
  CREATE INDEX "building_models_rooms_opening_models_window_opening_mode_idx" ON "building_models_rooms" USING btree ("opening_models_window_model_id");
  CREATE INDEX "building_models_line_idx" ON "building_models" USING btree ("line_id");
  CREATE INDEX "building_models_model_idx" ON "building_models" USING btree ("model_id");
  CREATE INDEX "building_models_thumbnail_idx" ON "building_models" USING btree ("thumbnail_id");
  CREATE INDEX "building_models_updated_at_idx" ON "building_models" USING btree ("updated_at");
  CREATE INDEX "building_models_created_at_idx" ON "building_models" USING btree ("created_at");
  CREATE INDEX "building_models_rels_order_idx" ON "building_models_rels" USING btree ("order");
  CREATE INDEX "building_models_rels_parent_idx" ON "building_models_rels" USING btree ("parent_id");
  CREATE INDEX "building_models_rels_path_idx" ON "building_models_rels" USING btree ("path");
  CREATE INDEX "building_models_rels_regions_id_idx" ON "building_models_rels" USING btree ("regions_id");
  CREATE INDEX "furniture_packages_compatible_room_types_order_idx" ON "furniture_packages_compatible_room_types" USING btree ("order");
  CREATE INDEX "furniture_packages_compatible_room_types_parent_idx" ON "furniture_packages_compatible_room_types" USING btree ("parent_id");
  CREATE INDEX "furniture_packages_model_idx" ON "furniture_packages" USING btree ("model_id");
  CREATE INDEX "furniture_packages_thumbnail_idx" ON "furniture_packages" USING btree ("thumbnail_id");
  CREATE INDEX "furniture_packages_updated_at_idx" ON "furniture_packages" USING btree ("updated_at");
  CREATE INDEX "furniture_packages_created_at_idx" ON "furniture_packages" USING btree ("created_at");
  CREATE INDEX "furniture_packages_rels_order_idx" ON "furniture_packages_rels" USING btree ("order");
  CREATE INDEX "furniture_packages_rels_parent_idx" ON "furniture_packages_rels" USING btree ("parent_id");
  CREATE INDEX "furniture_packages_rels_path_idx" ON "furniture_packages_rels" USING btree ("path");
  CREATE INDEX "furniture_packages_rels_building_lines_id_idx" ON "furniture_packages_rels" USING btree ("building_lines_id");
  CREATE INDEX "furniture_packages_rels_regions_id_idx" ON "furniture_packages_rels" USING btree ("regions_id");
  CREATE INDEX "quotes_building_model_idx" ON "quotes" USING btree ("building_model_id");
  CREATE INDEX "quotes_updated_at_idx" ON "quotes" USING btree ("updated_at");
  CREATE INDEX "quotes_created_at_idx" ON "quotes" USING btree ("created_at");
  CREATE INDEX "images_updated_at_idx" ON "images" USING btree ("updated_at");
  CREATE INDEX "images_created_at_idx" ON "images" USING btree ("created_at");
  CREATE UNIQUE INDEX "images_filename_idx" ON "images" USING btree ("filename");
  CREATE INDEX "images_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "images" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "images_sizes_card_sizes_card_filename_idx" ON "images" USING btree ("sizes_card_filename");
  CREATE INDEX "models_updated_at_idx" ON "models" USING btree ("updated_at");
  CREATE INDEX "models_created_at_idx" ON "models" USING btree ("created_at");
  CREATE UNIQUE INDEX "models_filename_idx" ON "models" USING btree ("filename");
  CREATE INDEX "textures_updated_at_idx" ON "textures" USING btree ("updated_at");
  CREATE INDEX "textures_created_at_idx" ON "textures" USING btree ("created_at");
  CREATE UNIQUE INDEX "textures_filename_idx" ON "textures" USING btree ("filename");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_regions_id_idx" ON "payload_locked_documents_rels" USING btree ("regions_id");
  CREATE INDEX "payload_locked_documents_rels_building_lines_id_idx" ON "payload_locked_documents_rels" USING btree ("building_lines_id");
  CREATE INDEX "payload_locked_documents_rels_building_models_id_idx" ON "payload_locked_documents_rels" USING btree ("building_models_id");
  CREATE INDEX "payload_locked_documents_rels_furniture_packages_id_idx" ON "payload_locked_documents_rels" USING btree ("furniture_packages_id");
  CREATE INDEX "payload_locked_documents_rels_quotes_id_idx" ON "payload_locked_documents_rels" USING btree ("quotes_id");
  CREATE INDEX "payload_locked_documents_rels_images_id_idx" ON "payload_locked_documents_rels" USING btree ("images_id");
  CREATE INDEX "payload_locked_documents_rels_models_id_idx" ON "payload_locked_documents_rels" USING btree ("models_id");
  CREATE INDEX "payload_locked_documents_rels_textures_id_idx" ON "payload_locked_documents_rels" USING btree ("textures_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "integration_settings_webhook_headers_order_idx" ON "integration_settings_webhook_headers" USING btree ("_order");
  CREATE INDEX "integration_settings_webhook_headers_parent_id_idx" ON "integration_settings_webhook_headers" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "regions" CASCADE;
  DROP TABLE "building_lines" CASCADE;
  DROP TABLE "building_lines_rels" CASCADE;
  DROP TABLE "building_models_scene_config_roof_blocks" CASCADE;
  DROP TABLE "building_models_rooms_floor_polygon" CASCADE;
  DROP TABLE "building_models_rooms" CASCADE;
  DROP TABLE "building_models" CASCADE;
  DROP TABLE "building_models_rels" CASCADE;
  DROP TABLE "furniture_packages_compatible_room_types" CASCADE;
  DROP TABLE "furniture_packages" CASCADE;
  DROP TABLE "furniture_packages_rels" CASCADE;
  DROP TABLE "quotes" CASCADE;
  DROP TABLE "images" CASCADE;
  DROP TABLE "models" CASCADE;
  DROP TABLE "textures" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "integration_settings_webhook_headers" CASCADE;
  DROP TABLE "integration_settings" CASCADE;
  DROP TYPE "public"."enum_building_lines_unit_label";
  DROP TYPE "public"."enum_building_models_rooms_floor_polygon_side";
  DROP TYPE "public"."enum_building_models_rooms_room_type";
  DROP TYPE "public"."enum_building_models_rooms_shell_sun_direction";
  DROP TYPE "public"."enum_building_models_rooms_opening_models_door_fit";
  DROP TYPE "public"."enum_building_models_rooms_opening_models_window_fit";
  DROP TYPE "public"."enum_furniture_packages_compatible_room_types";
  DROP TYPE "public"."enum_furniture_packages_family";
  DROP TYPE "public"."enum_furniture_packages_tier";
  DROP TYPE "public"."enum_quotes_status";`)
}
