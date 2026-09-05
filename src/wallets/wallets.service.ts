import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { parseMajorAmount, formatMinorAmount } from '../transfers/money';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user.enums';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { Wallet } from './wallet.entity';
import { WalletFunding } from './wallet-funding.entity';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly wallets: Repository<Wallet>,
    private readonly dataSource: DataSource,
  ) {}

  async findByUserId(userId: string): Promise<Wallet> {
    const wallet = await this.wallets.findOneBy({ userId });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async fund(user: User, input: FundWalletDto, idempotencyKey?: string) {
    this.validateIdempotencyKey(idempotencyKey);

    const wallet = await this.findByUserId(user.id);
    const amountMinor = parseMajorAmount(input.amount);
    const description = input.description?.trim() || null;
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          amountMinor: amountMinor.toString(),
          currency: wallet.currency,
          description,
        }),
      )
      .digest('hex');

    const funding = await this.dataSource.transaction(async (manager) => {
      // Funding and transfer operations lock users before wallets, ensuring an
      // account block cannot race with a balance change.
      const lockedUser = await manager
        .getRepository(User)
        .createQueryBuilder('user')
        .where('user.id = :userId', { userId: user.id })
        .setLock('pessimistic_write')
        .getOneOrFail();
      if (lockedUser.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException('Account is blocked');
      }

      const lockedWallet = await manager
        .getRepository(Wallet)
        .createQueryBuilder('wallet')
        .where('wallet.id = :walletId', { walletId: wallet.id })
        .setLock('pessimistic_write')
        .getOneOrFail();
      const fundings = manager.getRepository(WalletFunding);
      const insertion = await manager
        .createQueryBuilder()
        .insert()
        .into(WalletFunding)
        .values({
          reference: `FND_${randomBytes(12).toString('hex').toUpperCase()}`,
          walletId: lockedWallet.id,
          amountMinor,
          currency: lockedWallet.currency,
          idempotencyKey,
          requestHash,
          description,
        })
        .orIgnore()
        .returning(['id'])
        .execute();

      const current = await fundings.findOneByOrFail({
        walletId: lockedWallet.id,
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

      lockedWallet.balanceMinor += amountMinor;
      await manager.save(lockedWallet);
      return current;
    });

    return {
      reference: funding.reference,
      walletId: funding.walletId,
      amount: formatMinorAmount(funding.amountMinor),
      amountMinor: funding.amountMinor.toString(),
      currency: funding.currency,
      description: funding.description,
      createdAt: funding.createdAt,
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
}
