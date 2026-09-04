import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTransfers1788562000000 implements MigrationInterface {
  name = 'CreateTransfers1788562000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "transfer_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "transfer_failure_code" AS ENUM ('INSUFFICIENT_FUNDS', 'ACCOUNT_BLOCKED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "transfers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "reference" varchar(40) NOT NULL,
        "sender_wallet_id" uuid NOT NULL,
        "recipient_wallet_id" uuid NOT NULL,
        "amount_minor" bigint NOT NULL,
        "currency" varchar(3) NOT NULL,
        "status" "transfer_status" NOT NULL,
        "failure_code" "transfer_failure_code",
        "idempotency_key" varchar(100) NOT NULL,
        "request_hash" varchar(64) NOT NULL,
        "description" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz,
        CONSTRAINT "PK_transfers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_transfers_reference" UNIQUE ("reference"),
        CONSTRAINT "UQ_transfers_sender_idempotency"
          UNIQUE ("sender_wallet_id", "idempotency_key"),
        CONSTRAINT "CHK_transfer_amount_positive" CHECK ("amount_minor" > 0),
        CONSTRAINT "CHK_transfer_different_wallets"
          CHECK ("sender_wallet_id" <> "recipient_wallet_id"),
        CONSTRAINT "FK_transfers_sender_wallet" FOREIGN KEY ("sender_wallet_id")
          REFERENCES "wallets"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_transfers_recipient_wallet" FOREIGN KEY ("recipient_wallet_id")
          REFERENCES "wallets"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_transfers_sender_created" ON "transfers" ("sender_wallet_id", "created_at" DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_transfers_sender_created"`);
    await queryRunner.query(`DROP TABLE "transfers"`);
    await queryRunner.query(`DROP TYPE "transfer_failure_code"`);
    await queryRunner.query(`DROP TYPE "transfer_status"`);
  }
}
