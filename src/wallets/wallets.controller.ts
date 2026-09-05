import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { WalletsService } from './wallets.service';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FundWalletDto } from './dto/fund-wallet.dto';

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

  @Post('me/fund')
  @ApiOperation({ summary: 'Fund the authenticated user wallet' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    example: 'wallet-funding-20260905-001',
  })
  fundMyWallet(
    @CurrentUser() user: User,
    @Body() input: FundWalletDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.walletsService.fund(user, input, idempotencyKey);
  }
}
