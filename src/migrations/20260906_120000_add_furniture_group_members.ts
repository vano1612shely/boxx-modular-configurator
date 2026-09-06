import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Furniture packages made of several models rather than one.
 *
 * A table with a chairs around it is one thing to buy and one thing to be rid
 * of, but four things to stand in a room — the visitor moves each piece where
 * they want it. So the pieces are rows of their own, each with the pose an admin
 * arranged it at, and the package row above them keeps what a group is sold as:
 * one title, one price, one grade, one set of rooms it is offered in.
 *
 * A real table rather than `jsonb`, unlike the room fittings beside it. Those
 * are edited as one draft object in the Scene Editor and never queried; these
 * name rows of the models collection, and a foreign key is what stops a group
 * pointing at a file that is no longer there.
 *
 * `model_id` is nullable on purpose, and not `required` on the field either. A
 * required relationship would be `NOT NULL` with `ON DELETE SET NULL` behind it
 * — a pair that cannot both hold, so deleting a model any group named would
 * fail on a constraint with nothing to tell the admin which group to fix. This
 * way the piece simply loses its model, the arranger says which piece, and
 * nothing is drawn for it.
 *
 * Written by hand. Development runs the database in push mode, so the table
 * appears the moment the field is declared and the generator's diff has nothing
 * left to say — which is exactly how a missing migration has reached production
 * from this repo before.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "furniture_packages_members" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "model_id" integer,
      "name" varchar,
      "x" numeric DEFAULT 0,
      "z" numeric DEFAULT 0,
      "rotation_y_deg" numeric DEFAULT 0
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "furniture_packages_members"
        ADD CONSTRAINT "furniture_packages_members_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."furniture_packages"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "furniture_packages_members"
        ADD CONSTRAINT "furniture_packages_members_model_id_models_id_fk"
        FOREIGN KEY ("model_id") REFERENCES "public"."models"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "furniture_packages_members_order_idx"
      ON "furniture_packages_members" USING btree ("_order");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "furniture_packages_members_parent_id_idx"
      ON "furniture_packages_members" USING btree ("_parent_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "furniture_packages_members_model_idx"
      ON "furniture_packages_members" USING btree ("model_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Forgets every group an admin put together. Nothing a customer has ordered
  // is touched: a quote stores the arrangement it was sold, piece by piece,
  // rather than a pointer to the catalogue row it came from.
  await db.execute(sql`DROP TABLE IF EXISTS "furniture_packages_members";`)
}
