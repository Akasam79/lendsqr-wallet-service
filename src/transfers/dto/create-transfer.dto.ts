import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateTransferDto {
  @IsUUID()
  recipientWalletId: string;

  @Matches(/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/, {
    message:
      'amount must be a positive decimal with at most two decimal places',
  })
  amount: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
