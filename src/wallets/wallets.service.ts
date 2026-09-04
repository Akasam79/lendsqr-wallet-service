import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './wallet.entity';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly wallets: Repository<Wallet>,
  ) {}

  async findByUserId(userId: string): Promise<Wallet> {
    const wallet = await this.wallets.findOneBy({ userId });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }
}
