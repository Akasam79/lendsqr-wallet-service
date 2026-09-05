import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BLACKLIST_PROVIDER } from './blacklist-provider';
import { BlacklistService } from './blacklist.service';
import { TestBlacklistProvider } from './test-blacklist.provider';
import { AdjutorBlacklistProvider } from './adjutor-blacklist.provider';

@Module({
  providers: [
    TestBlacklistProvider,
    AdjutorBlacklistProvider,
    {
      provide: BLACKLIST_PROVIDER,
      inject: [ConfigService, TestBlacklistProvider, AdjutorBlacklistProvider],
      useFactory: (
        config: ConfigService,
        testProvider: TestBlacklistProvider,
        adjutorProvider: AdjutorBlacklistProvider,
      ) => {
        const provider = config.get<string>('BLACKLIST_PROVIDER', 'test');
        return provider === 'adjutor' ? adjutorProvider : testProvider;
      },
    },
    BlacklistService,
  ],
  exports: [BlacklistService],
})
export class BlacklistModule {}
