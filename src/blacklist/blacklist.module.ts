import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BLACKLIST_PROVIDER } from './blacklist-provider';
import { BlacklistService } from './blacklist.service';
import { TestBlacklistProvider } from './test-blacklist.provider';

@Module({
  providers: [
    TestBlacklistProvider,
    {
      provide: BLACKLIST_PROVIDER,
      inject: [ConfigService, TestBlacklistProvider],
      useFactory: (
        config: ConfigService,
        testProvider: TestBlacklistProvider,
      ) => {
        const provider = config.get<string>('BLACKLIST_PROVIDER', 'test');
        if (provider !== 'test') {
          throw new Error(
            `Blacklist provider "${provider}" is not enabled until its contract is confirmed`,
          );
        }
        return testProvider;
      },
    },
    BlacklistService,
  ],
  exports: [BlacklistService],
})
export class BlacklistModule {}
