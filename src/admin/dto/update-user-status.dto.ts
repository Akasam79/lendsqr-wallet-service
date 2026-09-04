import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserStatus } from '../../users/user.enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus, example: UserStatus.BLOCKED })
  @IsEnum(UserStatus)
  status: UserStatus;

  @ApiPropertyOptional({
    example: 'Manual risk review',
    description: 'Required when blocking an account',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
