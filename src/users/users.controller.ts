import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from './user.entity';

@Controller('users')
export class UsersController {
  @Get('me')
  getCurrentUser(@CurrentUser() user: User) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      blacklistCheckedAt: user.blacklistCheckedAt,
      createdAt: user.createdAt,
    };
  }
}
