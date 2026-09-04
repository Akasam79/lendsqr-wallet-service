import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { DataSource, QueryFailedError } from 'typeorm';
import { BlacklistService } from '../blacklist/blacklist.service';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user.enums';
import { UsersService } from '../users/users.service';
import { Wallet } from '../wallets/wallet.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './jwt-payload';

type PostgresError = Error & { code?: string; constraint?: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly blacklistService: BlacklistService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterDto) {
    const email = input.email.trim().toLowerCase();
    const phone = input.phone.trim();

    await this.blacklistService.assertEligible([email, phone]);
    const passwordHash = await hash(input.password);

    try {
      const account = await this.dataSource.transaction(async (manager) => {
        const user = manager.create(User, {
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email,
          phone,
          passwordHash,
          blacklistCheckedAt: new Date(),
        });
        await manager.save(user);

        const wallet = manager.create(Wallet, {
          userId: user.id,
          currency: 'NGN',
          balanceMinor: 0n,
        });
        await manager.save(wallet);

        return { user, wallet };
      });

      return this.presentAccount(account.user, account.wallet);
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException(
          'An account already exists for this identity',
        );
      }
      throw error;
    }
  }

  async login(input: LoginDto) {
    const user = await this.usersService.findByEmailForAuthentication(
      input.email.trim().toLowerCase(),
    );

    const passwordMatches = user
      ? await verify(user.passwordHash, input.password)
      : false;
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    if (user.status === UserStatus.BLOCKED) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    const payload: JwtPayload = { sub: user.id, role: user.role };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      user: this.presentUser(user),
    };
  }

  private presentAccount(user: User, wallet: Wallet) {
    return {
      user: this.presentUser(user),
      wallet: {
        id: wallet.id,
        currency: wallet.currency,
        balanceMinor: wallet.balanceMinor.toString(),
      },
    };
  }

  private presentUser(user: User) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
    };
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as PostgresError).code === '23505'
    );
  }
}
