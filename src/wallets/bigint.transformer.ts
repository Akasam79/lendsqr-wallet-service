import { ValueTransformer } from 'typeorm';

// PostgreSQL returns BIGINT values as strings. Keeping the conversion here makes
// it impossible for wallet calculations to accidentally use floating-point math.
export const bigintTransformer: ValueTransformer = {
  to: (value: bigint) => value.toString(),
  from: (value: string) => BigInt(value),
};
