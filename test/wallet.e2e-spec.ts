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
    await database.query(
      'TRUNCATE TABLE transfers, wallets, users RESTART IDENTITY CASCADE',
    );
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
});
