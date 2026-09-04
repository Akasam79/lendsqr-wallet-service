import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { bigintTransformer } from './bigint.transformer';

@Entity({ name: 'wallets' })
@Check('CHK_wallet_balance_non_negative', 'balance_minor >= 0')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User, (user) => user.wallet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 3, default: 'NGN' })
  currency: string;

  @Column({
    name: 'balance_minor',
    type: 'bigint',
    default: 0,
    transformer: bigintTransformer,
  })
  balanceMinor: bigint;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
