import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlacklistProvider, BlacklistResult } from './blacklist-provider';

@Injectable()
export class TestBlacklistProvider implements BlacklistProvider {
  private readonly blockedIdentities: Set<string>;

  constructor(config: ConfigService) {
    const configured = config.get<string>('BLACKLIST_TEST_IDENTITIES', '');
    this.blockedIdentities = new Set(
      configured
        .split(',')
        .map((identity) => identity.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  async check(identity: string): Promise<BlacklistResult> {
    return {
      blacklisted: this.blockedIdentities.has(identity.trim().toLowerCase()),
      provider: 'test',
    };
  }
}
