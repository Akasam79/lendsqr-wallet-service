import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import migrationDataSource from '../src/database/data-source';
import { TransferStatus } from '../src/transfers/transfer.enums';

type RegisteredAccount = {
  user: { id: string };
  wallet: { id: string };
};

describe('Wallet service (e2e)', () => {
  let app: INestApplication<App>;
  let database: DataSource;

  beforeAll(async () => {
    await migrationDataSource.initialize();
    await migrationDataSource.runMigrations();
    await migrationDataSource.destroy();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    database = app.get(DataSource);
  });

  beforeEach(async () => {
    // DELETE takes row-level locks. TRUNCATE needs an exclusive table lock and
    // can deadlock with requests that are finishing on slower CI runners.
    await database.transaction(async (manager) => {
      await manager.query('DELETE FROM wallet_fundings');
      await manager.query('DELETE FROM transfers');
      await manager.query('DELETE FROM wallets');
      await manager.query('DELETE FROM users');
    });
  });

  it('reports that the application process is alive', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ status: 'ok' }));
  });

  it('creates one user and wallet only after blacklist screening', async () => {
    const account = await registerAccount(
      'clear@example.com',
      '+2348010000001',
    );
    expect(account.wallet.id).toBeDefined();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Blocked',
        lastName: 'User',
        email: 'blocked@example.com',
        phone: '+2348010000002',
        password: 'StrongPass123',
      })
      .expect(403);

    const [{ count }] = (await database.query(
      'SELECT count(*)::int AS count FROM users',
    )) as [{ count: number }];
    expect(count).toBe(1);
  });

  it('applies simultaneous funding retries only once', async () => {
    const account = await registerAccount(
      'funding@example.com',
      '+2348010000012',
    );
    const token = await login('funding@example.com');

    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/wallets/me/fund')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', 'same-funding-key-001')
          .send({ amount: '1.00', description: 'Test funding' }),
      ),
    );

    expect(responses.every(({ status }) => status === 201)).toBe(true);
    expect(new Set(responses.map(({ body }) => body.reference)).size).toBe(1);
    await expectWalletBalance(account.wallet.id, 100n);

    const [{ count }] = (await database.query(
      'SELECT count(*)::int AS count FROM wallet_fundings',
    )) as [{ count: number }];
    expect(count).toBe(1);

    const changedRequest = await request(app.getHttpServer())
      .post('/api/v1/wallets/me/fund')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'same-funding-key-001')
      .send({ amount: '2.00', description: 'Test funding' })
      .expect(409);
    expect(changedRequest.body).toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
    await expectWalletBalance(account.wallet.id, 100n);
  });

  it('keeps all concurrent funding credits accurate', async () => {
    const account = await registerAccount(
      'parallel-funding@example.com',
      '+2348010000013',
    );
    const token = await login('parallel-funding@example.com');

    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        request(app.getHttpServer())
          .post('/api/v1/wallets/me/fund')
          .set('Authorization', `Bearer ${token}`)
          .set(
            'Idempotency-Key',
            `funding-key-${index.toString().padStart(3, '0')}`,
          )
          .send({ amount: '1.00' }),
      ),
    );

    expect(responses.every(({ status }) => status === 201)).toBe(true);
    await expectWalletBalance(account.wallet.id, 2_000n);
  });

  it('never lets parallel transfers overdraw the sender', async () => {
    const sender = await registerAccount(
      'sender@example.com',
      '+2348010000003',
    );
    const recipient = await registerAccount(
      'recipient@example.com',
      '+2348010000004',
    );
    await setBalance(sender.wallet.id, 10_000n);
    const token = await login('sender@example.com');

    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        request(app.getHttpServer())
          .post('/api/v1/transfers')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', `parallel-transfer-${index}`)
          .send({ recipientWalletId: recipient.wallet.id, amount: '10.00' }),
      ),
    );

    expect(responses.filter(({ status }) => status === 201)).toHaveLength(10);
    expect(responses.filter(({ status }) => status === 422)).toHaveLength(10);
    await expectBalances(sender.wallet.id, recipient.wallet.id, 0n, 10_000n);

    const rows = (await database.query(
      'SELECT status, count(*)::int AS count FROM transfers GROUP BY status',
    )) as { status: TransferStatus; count: number }[];
    expect(rows).toEqual(
      expect.arrayContaining([
        { status: TransferStatus.SUCCEEDED, count: 10 },
        { status: TransferStatus.FAILED, count: 10 },
      ]),
    );
  });

  it('applies simultaneous retries with one idempotency key only once', async () => {
    const sender = await registerAccount(
      'retry-sender@example.com',
      '+2348010000005',
    );
    const recipient = await registerAccount(
      'retry-recipient@example.com',
      '+2348010000006',
    );
    await setBalance(sender.wallet.id, 10_000n);
    const token = await login('retry-sender@example.com');

    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/transfers')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', 'same-retry-key-001')
          .send({ recipientWalletId: recipient.wallet.id, amount: '1.00' }),
      ),
    );

    expect(responses.every(({ status }) => status === 201)).toBe(true);
    expect(new Set(responses.map(({ body }) => body.reference)).size).toBe(1);
    await expectBalances(sender.wallet.id, recipient.wallet.id, 9_900n, 100n);

    const [{ count }] = (await database.query(
      'SELECT count(*)::int AS count FROM transfers',
    )) as [{ count: number }];
    expect(count).toBe(1);
  });

  it('rejects an idempotency key reused for different transfer details', async () => {
    const sender = await registerAccount(
      'key-sender@example.com',
      '+2348010000007',
    );
    const recipient = await registerAccount(
      'key-recipient@example.com',
      '+2348010000008',
    );
    await setBalance(sender.wallet.id, 10_000n);
    const token = await login('key-sender@example.com');
    const idempotencyKey = 'reused-key-001';

    await request(app.getHttpServer())
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ recipientWalletId: recipient.wallet.id, amount: '1.00' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ recipientWalletId: recipient.wallet.id, amount: '2.00' })
      .expect(409);

    expect(response.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    await expectBalances(sender.wallet.id, recipient.wallet.id, 9_900n, 100n);
  });

  it('prevents transfers to a blocked recipient without moving money', async () => {
    const admin = await registerAccount('admin@example.com', '+2348010000009');
    const sender = await registerAccount(
      'active-sender@example.com',
      '+2348010000010',
    );
    const recipient = await registerAccount(
      'blocked-recipient@example.com',
      '+2348010000011',
    );
    await database.query("UPDATE users SET role = 'ADMIN' WHERE id = $1", [
      admin.user.id,
    ]);
    await setBalance(sender.wallet.id, 10_000n);

    const adminToken = await login('admin@example.com');
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${recipient.user.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'BLOCKED', reason: 'Risk review' })
      .expect(200);

    const senderToken = await login('active-sender@example.com');
    const response = await request(app.getHttpServer())
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${senderToken}`)
      .set('Idempotency-Key', 'blocked-recipient-001')
      .send({ recipientWalletId: recipient.wallet.id, amount: '1.00' })
      .expect(422);

    expect(response.body).toMatchObject({ code: 'ACCOUNT_BLOCKED' });
    await expectBalances(sender.wallet.id, recipient.wallet.id, 10_000n, 0n);
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerAccount(
    email: string,
    phone: string,
  ): Promise<RegisteredAccount> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Test',
        lastName: 'User',
        email,
        phone,
        password: 'StrongPass123',
      })
      .expect(201);
    return response.body as RegisteredAccount;
  }

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'StrongPass123' })
      .expect(200);
    return response.body.accessToken as string;
  }

  async function setBalance(walletId: string, balanceMinor: bigint) {
    await database.query(
      'UPDATE wallets SET balance_minor = $1 WHERE id = $2',
      [balanceMinor.toString(), walletId],
    );
  }

  async function expectBalances(
    senderWalletId: string,
    recipientWalletId: string,
    expectedSender: bigint,
    expectedRecipient: bigint,
  ) {
    const rows = (await database.query(
      'SELECT id, balance_minor FROM wallets WHERE id IN ($1, $2)',
      [senderWalletId, recipientWalletId],
    )) as { id: string; balance_minor: string }[];
    const balances = new Map(
      rows.map((row) => [row.id, BigInt(row.balance_minor)]),
    );
    expect(balances.get(senderWalletId)).toBe(expectedSender);
    expect(balances.get(recipientWalletId)).toBe(expectedRecipient);
  }

  async function expectWalletBalance(
    walletId: string,
    expectedBalance: bigint,
  ) {
    const [row] = (await database.query(
      'SELECT balance_minor FROM wallets WHERE id = $1',
      [walletId],
    )) as [{ balance_minor: string }];
    expect(BigInt(row.balance_minor)).toBe(expectedBalance);
  }
});
