import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const query = jest.fn();
  const service = new HealthService({ query } as unknown as DataSource);

  beforeEach(() => query.mockReset());

  it('reports ready when PostgreSQL is reachable', async () => {
    query.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.readiness()).resolves.toMatchObject({
      status: 'ready',
      database: 'reachable',
    });
  });

  it('reports unavailable without leaking the database error', async () => {
    query.mockRejectedValue(new Error('connection details'));

    await expect(service.readiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
