import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "building_models" ADD COLUMN "occupancy" numeric;
  ALTER TABLE "building_models" ADD COLUMN "estimated_price" numeric;
  ALTER TABLE "building_models" ADD COLUMN "lead_time" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "building_models" DROP COLUMN "occupancy";
  ALTER TABLE "building_models" DROP COLUMN "estimated_price";
  ALTER TABLE "building_models" DROP COLUMN "lead_time";`)
}
