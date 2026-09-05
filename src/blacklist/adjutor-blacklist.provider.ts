import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlacklistProvider, BlacklistResult } from './blacklist-provider';

type AdjutorKarmaResponse = {
  status?: string;
  data?: unknown;
};

@Injectable()
export class AdjutorBlacklistProvider implements BlacklistProvider {
  constructor(private readonly config: ConfigService) {}

  async check(identity: string): Promise<BlacklistResult> {
    const baseUrl = this.config
      .getOrThrow<string>('ADJUTOR_BASE_URL')
      .replace(/\/$/, '');
    const apiKey = this.config.getOrThrow<string>('ADJUTOR_API_KEY');
    const timeout = this.config.get<number>('ADJUTOR_TIMEOUT_MS', 5000);
    const url = `${baseUrl}/v2/verification/karma/${encodeURIComponent(identity)}`;

    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(timeout),
      });

      // Adjutor uses a successful response with Karma data for a blacklist hit.
      // A missing identity is not an integration failure and may proceed.
      if (response.status === 404) {
        return { blacklisted: false, provider: 'adjutor' };
      }
      if (!response.ok) {
        throw new Error(`Adjutor returned HTTP ${response.status}`);
      }

      const body = (await response.json()) as AdjutorKarmaResponse;
      return {
        blacklisted: body.status === 'success' && body.data != null,
        provider: 'adjutor',
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      // Screening fails closed: an unavailable risk provider must never cause
      // an unchecked user to be onboarded.
      throw new ServiceUnavailableException({
        code: 'BLACKLIST_SCREENING_UNAVAILABLE',
        message: 'Blacklist screening is temporarily unavailable',
      });
    }
  }
}
