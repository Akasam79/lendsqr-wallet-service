import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersAndWallets1788560000000 implements MigrationInterface {
  name = 'CreateUsersAndWallets1788560000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "user_role" AS ENUM ('CUSTOMER', 'ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'BLOCKED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "first_name" varchar(80) NOT NULL,
        "last_name" varchar(80) NOT NULL,
        "email" varchar(320) NOT NULL,
        "phone" varchar(20) NOT NULL,
        "password_hash" varchar NOT NULL,
        "role" "user_role" NOT NULL DEFAULT 'CUSTOMER',
        "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
        "blacklist_checked_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_phone" UNIQUE ("phone")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'NGN',
        "balance_minor" bigint NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wallets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_wallets_user_id" UNIQUE ("user_id"),
        CONSTRAINT "CHK_wallet_balance_non_negative" CHECK ("balance_minor" >= 0),
        CONSTRAINT "FK_wallets_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "wallets"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_status"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}
