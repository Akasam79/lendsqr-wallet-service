import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { BLACKLIST_PROVIDER, BlacklistProvider } from './blacklist-provider';

@Injectable()
export class BlacklistService {
  constructor(
    @Inject(BLACKLIST_PROVIDER)
    private readonly provider: BlacklistProvider,
  ) {}

  async assertEligible(identities: string[]): Promise<void> {
    for (const identity of identities) {
      const result = await this.provider.check(identity);
      if (result.blacklisted) {
        throw new ForbiddenException({
          code: 'BLACKLISTED_IDENTITY',
          message: 'Registration is not permitted for this identity',
        });
      }
    }
  }
}
