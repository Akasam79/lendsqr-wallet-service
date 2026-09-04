import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { WalletsService } from './wallets.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Wallets')
@ApiBearerAuth()
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user wallet and balance' })
  async getMyWallet(@CurrentUser() user: User) {
    const wallet = await this.walletsService.findByUserId(user.id);

    return {
      id: wallet.id,
      currency: wallet.currency,
      balanceMinor: wallet.balanceMinor.toString(),
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }
}
