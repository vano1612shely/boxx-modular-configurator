import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_furniture_packages_recommended_for" AS ENUM('office', 'classroom', 'conference', 'kitchen', 'restroom', 'lounge', 'hallway', 'other');
  CREATE TABLE "furniture_packages_recommended_for" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_furniture_packages_recommended_for",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "furniture_packages_recommended_for" ADD CONSTRAINT "furniture_packages_recommended_for_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."furniture_packages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "furniture_packages_recommended_for_order_idx" ON "furniture_packages_recommended_for" USING btree ("order");
  CREATE INDEX "furniture_packages_recommended_for_parent_idx" ON "furniture_packages_recommended_for" USING btree ("parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "furniture_packages_recommended_for" CASCADE;
  DROP TYPE "public"."enum_furniture_packages_recommended_for";`)
}
