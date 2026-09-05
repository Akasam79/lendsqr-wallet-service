import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { AdjutorBlacklistProvider } from './adjutor-blacklist.provider';

describe('AdjutorBlacklistProvider', () => {
  const config = new ConfigService({
    ADJUTOR_BASE_URL: 'https://adjutor.example',
    ADJUTOR_API_KEY: 'test-api-key',
    ADJUTOR_TIMEOUT_MS: 1000,
  });
  const provider = new AdjutorBlacklistProvider(config);

  afterEach(() => jest.restoreAllMocks());

  it('reports a successful Karma match as blacklisted', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: 'success', data: { karma_identity: 'x' } }),
          { status: 200 },
        ),
      );

    await expect(provider.check('person@example.com')).resolves.toEqual({
      blacklisted: true,
      provider: 'adjutor',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://adjutor.example/v2/verification/karma/person%40example.com',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer test-api-key',
        }),
      }),
    );
  });

  it('treats a missing Karma identity as eligible', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 404 }));

    await expect(provider.check('clear@example.com')).resolves.toEqual({
      blacklisted: false,
      provider: 'adjutor',
    });
  });

  it('fails closed when Adjutor cannot complete screening', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 500 }));

    await expect(provider.check('person@example.com')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
