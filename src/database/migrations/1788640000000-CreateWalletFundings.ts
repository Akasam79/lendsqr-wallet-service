import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWalletFundings1788640000000 implements MigrationInterface {
  name = 'CreateWalletFundings1788640000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "wallet_fundings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "reference" varchar(40) NOT NULL,
        "wallet_id" uuid NOT NULL,
        "amount_minor" bigint NOT NULL,
        "currency" varchar(3) NOT NULL,
        "idempotency_key" varchar(100) NOT NULL,
        "request_hash" varchar(64) NOT NULL,
        "description" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wallet_fundings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_wallet_fundings_reference" UNIQUE ("reference"),
        CONSTRAINT "UQ_wallet_fundings_wallet_idempotency"
          UNIQUE ("wallet_id", "idempotency_key"),
        CONSTRAINT "CHK_wallet_funding_amount_positive" CHECK ("amount_minor" > 0),
        CONSTRAINT "FK_wallet_fundings_wallet" FOREIGN KEY ("wallet_id")
          REFERENCES "wallets"("id") ON DELETE RESTRICT
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "wallet_fundings"`);
  }
}
