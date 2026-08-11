import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "quiz_settings" ADD COLUMN "step1_list_label" varchar DEFAULT 'Building line';
  ALTER TABLE "quiz_settings" ADD COLUMN "step2_offices_label" varchar DEFAULT 'Offices';
  ALTER TABLE "quiz_settings" ADD COLUMN "step2_classrooms_label" varchar DEFAULT 'Classrooms';
  ALTER TABLE "quiz_settings" ADD COLUMN "step2_over_capacity_hint" varchar DEFAULT 'Beyond the largest standard size — we’ll quote it as a custom build.';
  ALTER TABLE "quiz_settings" ADD COLUMN "step2_restrooms_label" varchar DEFAULT 'Restrooms';
  ALTER TABLE "quiz_settings" ADD COLUMN "step2_restrooms_hint" varchar DEFAULT 'We’ll pick the closest model that covers it.';
  ALTER TABLE "quiz_settings" ADD COLUMN "step2_back" varchar DEFAULT 'Back';
  ALTER TABLE "quiz_settings" ADD COLUMN "step2_submit" varchar DEFAULT 'Show my building';
  ALTER TABLE "quiz_settings" ADD COLUMN "not_found_title" varchar DEFAULT 'Nothing to configure yet';
  ALTER TABLE "quiz_settings" ADD COLUMN "not_found_body" varchar DEFAULT 'No buildings are available for this selection right now. Please try again shortly.';
  ALTER TABLE "quiz_settings" ADD COLUMN "over_capacity_chip" varchar DEFAULT 'Custom build';
  ALTER TABLE "quiz_settings" ADD COLUMN "over_capacity_title" varchar DEFAULT 'That’s a big project — we like it.';
  ALTER TABLE "quiz_settings" ADD COLUMN "over_capacity_body" varchar DEFAULT '{units} units is beyond the largest standard {line} configuration. Our team will put together an individual proposal for you.';
  ALTER TABLE "quiz_settings" ADD COLUMN "over_capacity_action" varchar DEFAULT 'Adjust request';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "quiz_settings" DROP COLUMN "step1_list_label";
  ALTER TABLE "quiz_settings" DROP COLUMN "step2_offices_label";
  ALTER TABLE "quiz_settings" DROP COLUMN "step2_classrooms_label";
  ALTER TABLE "quiz_settings" DROP COLUMN "step2_over_capacity_hint";
  ALTER TABLE "quiz_settings" DROP COLUMN "step2_restrooms_label";
  ALTER TABLE "quiz_settings" DROP COLUMN "step2_restrooms_hint";
  ALTER TABLE "quiz_settings" DROP COLUMN "step2_back";
  ALTER TABLE "quiz_settings" DROP COLUMN "step2_submit";
  ALTER TABLE "quiz_settings" DROP COLUMN "not_found_title";
  ALTER TABLE "quiz_settings" DROP COLUMN "not_found_body";
  ALTER TABLE "quiz_settings" DROP COLUMN "over_capacity_chip";
  ALTER TABLE "quiz_settings" DROP COLUMN "over_capacity_title";
  ALTER TABLE "quiz_settings" DROP COLUMN "over_capacity_body";
  ALTER TABLE "quiz_settings" DROP COLUMN "over_capacity_action";`)
}
