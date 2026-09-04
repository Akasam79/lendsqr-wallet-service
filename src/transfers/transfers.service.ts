import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, In, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user.enums';
import { Wallet } from '../wallets/wallet.entity';
import { WalletsService } from '../wallets/wallets.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { formatMinorAmount, parseMajorAmount } from './money';
import { Transfer } from './transfer.entity';
import { TransferFailureCode, TransferStatus } from './transfer.enums';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;

@Injectable()
export class TransfersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly walletsService: WalletsService,
  ) {}

  async create(
    sender: User,
    input: CreateTransferDto,
    idempotencyKey?: string,
  ) {
    this.validateIdempotencyKey(idempotencyKey);

    const senderWallet = await this.walletsService.findByUserId(sender.id);
    if (senderWallet.id === input.recipientWalletId) {
      throw new UnprocessableEntityException(
        'A wallet cannot transfer to itself',
      );
    }

    const amountMinor = parseMajorAmount(input.amount);
    const description = input.description?.trim() || null;
    const requestHash = this.hashRequest({
      recipientWalletId: input.recipientWalletId,
      amountMinor,
      currency: senderWallet.currency,
      description,
    });

    const transfer = await this.dataSource.transaction(async (manager) => {
      const transferRepository = manager.getRepository(Transfer);
      const walletRepository = manager.getRepository(Wallet);
      const walletsBeforeLock = await walletRepository.findBy({
        id: In([senderWallet.id, input.recipientWalletId]),
      });
      if (walletsBeforeLock.length !== 2) {
        throw new NotFoundException('Recipient wallet not found');
      }

      const userIds = walletsBeforeLock
        .map((wallet) => wallet.userId)
        .sort((left, right) => left.localeCompare(right));
      const walletIds = walletsBeforeLock
        .map((wallet) => wallet.id)
        .sort((left, right) => left.localeCompare(right));

      // Every transfer locks users first, then wallets, in sorted order. This
      // keeps opposite-direction transfers from deadlocking each other.
      const lockedUsers = await manager
        .getRepository(User)
        .createQueryBuilder('user')
        .where('user.id IN (:...userIds)', { userIds })
        .orderBy('user.id', 'ASC')
        .setLock('pessimistic_write')
        .getMany();
      const lockedWallets = await walletRepository
        .createQueryBuilder('wallet')
        .where('wallet.id IN (:...walletIds)', { walletIds })
        .orderBy('wallet.id', 'ASC')
        .setLock('pessimistic_write')
        .getMany();

      const usersById = new Map(lockedUsers.map((user) => [user.id, user]));
      const senderLocked = lockedWallets.find(
        (wallet) => wallet.id === senderWallet.id,
      );
      const recipientLocked = lockedWallets.find(
        (wallet) => wallet.id === input.recipientWalletId,
      );
      if (!senderLocked || !recipientLocked) {
        throw new NotFoundException('Recipient wallet not found');
      }

      // Insert after acquiring wallet locks. An earlier insert would take
      // foreign-key key-share locks and concurrent requests could deadlock
      // while upgrading those locks for the balance update.
      const insertion = await manager
        .createQueryBuilder()
        .insert()
        .into(Transfer)
        .values({
          reference: this.generateReference(),
          senderWalletId: senderWallet.id,
          recipientWalletId: input.recipientWalletId,
          amountMinor,
          currency: senderWallet.currency,
          status: TransferStatus.PENDING,
          failureCode: null,
          idempotencyKey,
          requestHash,
          description,
          completedAt: null,
        })
        .orIgnore()
        .returning(['id'])
        .execute();

      const current = await transferRepository.findOneByOrFail({
        senderWalletId: senderWallet.id,
        idempotencyKey,
      });

      if (!insertion.raw[0]?.id) {
        if (current.requestHash !== requestHash) {
          throw new ConflictException({
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'This idempotency key was used for a different request',
          });
        }
        return current;
      }

      const senderUser = usersById.get(senderLocked.userId);
      const recipientUser = usersById.get(recipientLocked.userId);
      if (
        senderUser?.status !== UserStatus.ACTIVE ||
        recipientUser?.status !== UserStatus.ACTIVE
      ) {
        return this.failTransfer(
          transferRepository,
          current,
          TransferFailureCode.ACCOUNT_BLOCKED,
        );
      }

      if (senderLocked.balanceMinor < amountMinor) {
        return this.failTransfer(
          transferRepository,
          current,
          TransferFailureCode.INSUFFICIENT_FUNDS,
        );
      }

      senderLocked.balanceMinor -= amountMinor;
      recipientLocked.balanceMinor += amountMinor;
      await walletRepository.save([senderLocked, recipientLocked]);

      current.status = TransferStatus.SUCCEEDED;
      current.completedAt = new Date();
      return transferRepository.save(current);
    });

    return this.presentOutcome(transfer);
  }

  async findByReference(sender: User, reference: string) {
    const senderWallet = await this.walletsService.findByUserId(sender.id);
    const transfer = await this.dataSource.getRepository(Transfer).findOneBy({
      reference,
      senderWalletId: senderWallet.id,
    });
    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }
    return this.present(transfer);
  }

  private async failTransfer(
    repository: Repository<Transfer>,
    transfer: Transfer,
    failureCode: TransferFailureCode,
  ): Promise<Transfer> {
    transfer.status = TransferStatus.FAILED;
    transfer.failureCode = failureCode;
    transfer.completedAt = new Date();
    return repository.save(transfer);
  }

  private presentOutcome(transfer: Transfer) {
    if (transfer.status === TransferStatus.FAILED) {
      const message =
        transfer.failureCode === TransferFailureCode.INSUFFICIENT_FUNDS
          ? 'Insufficient wallet balance'
          : 'The sender or recipient account is blocked';
      throw new UnprocessableEntityException({
        code: transfer.failureCode,
        message,
        reference: transfer.reference,
      });
    }
    if (transfer.status === TransferStatus.PENDING) {
      throw new ConflictException('Transfer is still being processed');
    }
    return this.present(transfer);
  }

  private present(transfer: Transfer) {
    return {
      reference: transfer.reference,
      senderWalletId: transfer.senderWalletId,
      recipientWalletId: transfer.recipientWalletId,
      amount: formatMinorAmount(transfer.amountMinor),
      amountMinor: transfer.amountMinor.toString(),
      currency: transfer.currency,
      status: transfer.status,
      description: transfer.description,
      createdAt: transfer.createdAt,
      completedAt: transfer.completedAt,
    };
  }

  private validateIdempotencyKey(
    idempotencyKey: string | undefined,
  ): asserts idempotencyKey is string {
    if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException(
        'Idempotency-Key must be 8-100 letters, numbers, dots, colons, underscores or hyphens',
      );
    }
  }

  private hashRequest(input: {
    recipientWalletId: string;
    amountMinor: bigint;
    currency: string;
    description: string | null;
  }): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          recipientWalletId: input.recipientWalletId,
          amountMinor: input.amountMinor.toString(),
          currency: input.currency,
          description: input.description,
        }),
      )
      .digest('hex');
  }

  private generateReference(): string {
    return `TRF_${randomBytes(12).toString('hex').toUpperCase()}`;
  }
}
