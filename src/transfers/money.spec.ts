import { BadRequestException } from '@nestjs/common';
import { formatMinorAmount, parseMajorAmount } from './money';

describe('money helpers', () => {
  it.each([
    ['1', 100n],
    ['1.5', 150n],
    ['1250.50', 125050n],
    ['0.01', 1n],
  ])('parses %s without floating-point arithmetic', (amount, expected) => {
    expect(parseMajorAmount(amount)).toBe(expected);
  });

  it.each(['0', '0.00', '-1', '01.00', '1.001', 'hello'])(
    'rejects invalid amount %s',
    (amount) => {
      expect(() => parseMajorAmount(amount)).toThrow(BadRequestException);
    },
  );

  it('formats minor units as a two-decimal string', () => {
    expect(formatMinorAmount(125050n)).toBe('1250.50');
  });
});
