import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTransferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  recipientWalletId: string;

  @ApiProperty({
    example: '1250.50',
    description: 'NGN amount expressed as a decimal string',
  })
  @Matches(/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/, {
    message:
      'amount must be a positive decimal with at most two decimal places',
  })
  amount: string;

  @ApiPropertyOptional({ example: 'Lunch reimbursement', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
