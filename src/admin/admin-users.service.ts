import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user.enums';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly dataSource: DataSource) {}

  async findById(id: string): Promise<User> {
    const user = await this.dataSource.getRepository(User).findOneBy({ id });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateStatus(
    targetUserId: string,
    actor: User,
    input: UpdateUserStatusDto,
  ): Promise<User> {
    if (actor.id === targetUserId && input.status === UserStatus.BLOCKED) {
      throw new BadRequestException('Administrators cannot block themselves');
    }

    const reason = input.reason?.trim();
    if (input.status === UserStatus.BLOCKED && !reason) {
      throw new BadRequestException('A reason is required to block an account');
    }

    return this.dataSource.transaction(async (manager) => {
      // The same user row is locked by transfers. A block and a transfer can
      // therefore never make decisions from two different account states.
      const user = await manager
        .getRepository(User)
        .createQueryBuilder('user')
        .setLock('pessimistic_write')
        .where('user.id = :targetUserId', { targetUserId })
        .getOne();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      user.status = input.status;
      user.blockedAt = input.status === UserStatus.BLOCKED ? new Date() : null;
      user.blockedReason =
        input.status === UserStatus.BLOCKED ? (reason ?? null) : null;
      user.blockedById = input.status === UserStatus.BLOCKED ? actor.id : null;

      return manager.save(user);
    });
  }
}
