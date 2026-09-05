import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class FundWalletDto {
  @ApiProperty({
    example: '5000.00',
    description: 'NGN amount expressed as a decimal string',
  })
  @Matches(/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/, {
    message:
      'amount must be a positive decimal with at most two decimal places',
  })
  amount: string;

  @ApiPropertyOptional({ example: 'Demo account funding', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
