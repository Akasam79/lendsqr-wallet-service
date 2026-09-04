import { BadRequestException } from '@nestjs/common';

const MONEY_PATTERN = /^(0|[1-9]\d{0,12})(?:\.(\d{1,2}))?$/;

export function parseMajorAmount(amount: string): bigint {
  const match = MONEY_PATTERN.exec(amount);
  if (!match) {
    throw new BadRequestException(
      'Amount must have at most two decimal places and no leading zeroes',
    );
  }

  const [major] = amount.split('.');
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const minor = BigInt(major) * 100n + BigInt(fraction || '0');
  if (minor <= 0n) {
    throw new BadRequestException('Amount must be greater than zero');
  }
  return minor;
}

export function formatMinorAmount(amountMinor: bigint): string {
  const major = amountMinor / 100n;
  const fraction = (amountMinor % 100n).toString().padStart(2, '0');
  return `${major}.${fraction}`;
}
