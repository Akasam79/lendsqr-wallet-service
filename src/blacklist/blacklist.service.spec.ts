import { ForbiddenException } from '@nestjs/common';
import { BlacklistProvider } from './blacklist-provider';
import { BlacklistService } from './blacklist.service';

describe('BlacklistService', () => {
  it('allows registration when every identity is clear', async () => {
    const provider: BlacklistProvider = {
      check: jest.fn().mockResolvedValue({
        blacklisted: false,
        provider: 'test',
      }),
    };
    const service = new BlacklistService(provider);

    await expect(
      service.assertEligible(['samuel@example.com', '+2348012345678']),
    ).resolves.toBeUndefined();
    expect(provider.check).toHaveBeenCalledTimes(2);
  });

  it('stops registration when an identity is blacklisted', async () => {
    const provider: BlacklistProvider = {
      check: jest.fn().mockResolvedValue({
        blacklisted: true,
        provider: 'test',
      }),
    };
    const service = new BlacklistService(provider);

    await expect(
      service.assertEligible(['blocked@example.com']),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
