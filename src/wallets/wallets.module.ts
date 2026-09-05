import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './wallet.entity';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { WalletFunding } from './wallet-funding.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, WalletFunding])],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
