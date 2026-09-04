import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Wallet } from '../wallets/wallet.entity';
import { UserRole, UserStatus } from './user.enums';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'first_name', length: 80 })
  firstName: string;

  @Column({ name: 'last_name', length: 80 })
  lastName: string;

  @Column({ length: 320, unique: true })
  email: string;

  @Column({ length: 20, unique: true })
  phone: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ name: 'blocked_at', type: 'timestamptz', nullable: true })
  blockedAt: Date | null;

  @Column({
    name: 'blocked_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  blockedReason: string | null;

  @Column({ name: 'blocked_by_id', type: 'uuid', nullable: true })
  blockedById: string | null;

  @Column({ name: 'blacklist_checked_at', type: 'timestamptz' })
  blacklistCheckedAt: Date;

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet?: Wallet;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
