import { Controller, Get, Headers, Param, Post, Body } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransfersService } from './transfers.service';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() input: CreateTransferDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transfersService.create(user, input, idempotencyKey);
  }

  @Get(':reference')
  findByReference(
    @CurrentUser() user: User,
    @Param('reference') reference: string,
  ) {
    return this.transfersService.findByReference(user, reference);
  }
}
