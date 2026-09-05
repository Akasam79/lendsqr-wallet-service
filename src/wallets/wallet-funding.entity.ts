import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { bigintTransformer } from './bigint.transformer';

@Entity({ name: 'wallet_fundings' })
@Index(
  'UQ_wallet_fundings_wallet_idempotency',
  ['walletId', 'idempotencyKey'],
  {
    unique: true,
  },
)
@Check('CHK_wallet_funding_amount_positive', 'amount_minor > 0')
export class WalletFunding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 40, unique: true })
  reference: string;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @Column({
    name: 'amount_minor',
    type: 'bigint',
    transformer: bigintTransformer,
  })
  amountMinor: bigint;

  @Column({ length: 3 })
  currency: string;

  @Column({ name: 'idempotency_key', length: 100 })
  idempotencyKey: string;

  @Column({ name: 'request_hash', length: 64 })
  requestHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
