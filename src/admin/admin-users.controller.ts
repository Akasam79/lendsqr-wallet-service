import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user.enums';
import { AdminUsersService } from './admin-users.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get(':id')
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.present(await this.adminUsersService.findById(id));
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: User,
    @Body() input: UpdateUserStatusDto,
  ) {
    return this.present(
      await this.adminUsersService.updateStatus(id, actor, input),
    );
  }

  private present(user: User) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      blockedAt: user.blockedAt,
      blockedReason: user.blockedReason,
      blockedById: user.blockedById,
      createdAt: user.createdAt,
    };
  }
}
