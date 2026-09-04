import { hash } from '@node-rs/argon2';
import { User } from '../users/user.entity';
import { UserRole, UserStatus } from '../users/user.enums';
import { Wallet } from '../wallets/wallet.entity';
import dataSource from './data-source';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to seed the administrator`);
  }
  return value;
}

export async function runAdminSeed(): Promise<void> {
  const email = requiredEnvironment('ADMIN_EMAIL').toLowerCase();
  const password = requiredEnvironment('ADMIN_PASSWORD');
  const phone = requiredEnvironment('ADMIN_PHONE');
  const firstName = process.env.ADMIN_FIRST_NAME?.trim() || 'System';
  const lastName = process.env.ADMIN_LAST_NAME?.trim() || 'Administrator';
  const openingBalanceMinor = BigInt(
    process.env.ADMIN_INITIAL_BALANCE_MINOR || '0',
  );
  if (openingBalanceMinor < 0n) {
    throw new Error('ADMIN_INITIAL_BALANCE_MINOR cannot be negative');
  }

  try {
    await dataSource.initialize();
    await dataSource.transaction(async (manager) => {
      const users = manager.getRepository(User);
      let admin = await users
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.email = :email', { email })
        .getOne();

      if (!admin) {
        admin = users.create({
          firstName,
          lastName,
          email,
          phone,
          passwordHash: await hash(password),
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          blacklistCheckedAt: new Date(),
        });
        await users.save(admin);
      } else {
        admin.role = UserRole.ADMIN;
        admin.status = UserStatus.ACTIVE;
        admin.blockedAt = null;
        admin.blockedReason = null;
        admin.blockedById = null;
        await users.save(admin);
      }

      const wallets = manager.getRepository(Wallet);
      const existingWallet = await wallets.findOneBy({ userId: admin.id });
      if (!existingWallet) {
        await wallets.save(
          wallets.create({
            userId: admin.id,
            currency: 'NGN',
            balanceMinor: openingBalanceMinor,
          }),
        );
      }
    });
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

if (require.main === module) {
  runAdminSeed().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
