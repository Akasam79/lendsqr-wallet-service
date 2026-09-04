import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { bigintTransformer } from '../wallets/bigint.transformer';
import { TransferFailureCode, TransferStatus } from './transfer.enums';

@Entity({ name: 'transfers' })
@Index(
  'UQ_transfers_sender_idempotency',
  ['senderWalletId', 'idempotencyKey'],
  {
    unique: true,
  },
)
@Check('CHK_transfer_amount_positive', 'amount_minor > 0')
@Check(
  'CHK_transfer_different_wallets',
  'sender_wallet_id <> recipient_wallet_id',
)
export class Transfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 40, unique: true })
  reference: string;

  @Column({ name: 'sender_wallet_id', type: 'uuid' })
  senderWalletId: string;

  @Column({ name: 'recipient_wallet_id', type: 'uuid' })
  recipientWalletId: string;

  @Column({
    name: 'amount_minor',
    type: 'bigint',
    transformer: bigintTransformer,
  })
  amountMinor: bigint;

  @Column({ length: 3 })
  currency: string;

  @Column({ type: 'enum', enum: TransferStatus })
  status: TransferStatus;

  @Column({
    name: 'failure_code',
    type: 'enum',
    enum: TransferFailureCode,
    nullable: true,
  })
  failureCode: TransferFailureCode | null;

  @Column({ name: 'idempotency_key', length: 100 })
  idempotencyKey: string;

  @Column({ name: 'request_hash', length: 64 })
  requestHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
