import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserBlockMetadata1788561000000 implements MigrationInterface {
  name = 'AddUserBlockMetadata1788561000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "blocked_at" timestamptz,
        ADD COLUMN "blocked_reason" varchar(500),
        ADD COLUMN "blocked_by_id" uuid,
        ADD CONSTRAINT "FK_users_blocked_by"
          FOREIGN KEY ("blocked_by_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP CONSTRAINT "FK_users_blocked_by",
        DROP COLUMN "blocked_by_id",
        DROP COLUMN "blocked_reason",
        DROP COLUMN "blocked_at"
    `);
  }
}
