import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletsModule } from '../wallets/wallets.module';
import { Transfer } from './transfer.entity';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Transfer]), WalletsModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
