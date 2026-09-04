# Lendsqr Wallet Service

A focused wallet API for the Lendsqr engineering exercise. It creates a wallet when a user registers, screens identities before onboarding, lets administrators block or unblock accounts, and transfers NGN between wallets without losing balance accuracy under concurrent requests.

Repository: [github.com/Akasam79/lendsqr-wallet-service](https://github.com/Akasam79/lendsqr-wallet-service)

Live API: _add the Render URL after the first deployment_

Interactive API documentation is available at `/docs` when the service is running.

## What is included

- Atomic user and wallet creation after blacklist screening
- JWT authentication with Argon2 password hashing
- Role-protected account inspection, blocking and unblocking
- Atomic wallet-to-wallet transfers with PostgreSQL row locks
- Mandatory idempotency keys and request fingerprinting
- Integer minor-unit money storage (`10050` means `NGN 100.50`)
- Database constraints, versioned migrations and an idempotent admin seed
- Request validation, security headers, CORS configuration and rate limiting
- Liveness/readiness endpoints, Swagger documentation and CI
- Unit tests and PostgreSQL-backed concurrency tests

## Deliberate scope

This submission keeps the product surface small so that the important financial behavior is easy to inspect. Each user owns one NGN wallet. There is no public funding endpoint, withdrawal flow, transaction pagination, refresh-token system or multi-currency conversion.

The seeded administrator receives a configurable demonstration balance only when its wallet is first created. This makes the transfer flow testable without presenting an unauthenticated money-creation API.

## Design decisions

### Concurrency and balance integrity

A transfer runs in one database transaction. It loads both account records and both wallets, then acquires PostgreSQL pessimistic write locks in deterministic UUID order. The active/blocked decision and both balance updates therefore use the same committed state. Parallel requests cannot overdraw a wallet, and opposite-direction transfers use the same lock order to avoid deadlocks.

The database also enforces non-negative wallet balances, positive transfer amounts, different sender and recipient wallets, unique transfer references, and one idempotency key per sender wallet.

### Idempotency and replay protection

Every `POST /transfers` request requires an `Idempotency-Key` header. The first request persists the key and a SHA-256 fingerprint of the transfer details in the same transaction as the balance change.

- Retrying the same request returns the original transfer and never debits twice.
- Reusing the key with different transfer details returns `409 Conflict`.
- Simultaneous retries are serialized by the database uniqueness constraint.

### Money representation

Amounts enter the API as decimal strings to avoid JavaScript floating-point errors. They are parsed into integer kobo and stored in PostgreSQL `BIGINT` columns. Responses include both the formatted major amount and/or the unambiguous minor-unit value where applicable.

### Blacklist integration boundary

Registration depends on a `BlacklistProvider` interface rather than an Adjutor-specific implementation. The included deterministic provider reads `BLACKLIST_TEST_IDENTITIES`, making local development and automated tests reliable.

The exact Adjutor/Karma request and response contract was not confirmed for this exercise. Selecting `BLACKLIST_PROVIDER=adjutor` intentionally fails at startup instead of silently allowing registrations. A production adapter can be added behind the existing interface once the contract and credentials are supplied, without changing registration logic.

### Account controls

Only administrators can block or unblock a user. Blocking requires a reason and records who performed it and when. A blocked user cannot log in, use an existing token, send funds or receive funds. Account status changes lock the same user row used by the transfer path, so blocking and transferring cannot make decisions from inconsistent states.

## Project structure

```text
src/
├── admin/          # role-protected user status management
├── auth/           # registration, login, JWT guards and decorators
├── blacklist/      # provider boundary and deterministic test provider
├── config/         # validated environment and database configuration
├── database/       # TypeORM data source and versioned migrations
├── health/         # liveness and database readiness checks
├── transfers/      # money parsing and concurrency-safe transfer workflow
├── users/          # user entity and current-user endpoint
├── wallets/        # wallet entity and balance endpoint
├── app.module.ts
└── main.ts
scripts/            # idempotent administrator seed
test/               # PostgreSQL-backed end-to-end and concurrency tests
```

## Technology

- Node.js 22+
- TypeScript 5
- NestJS 11
- PostgreSQL
- TypeORM migrations
- Jest and Supertest
- pnpm

## Local setup

### 1. Prerequisites

Install Node.js 22 or 24, pnpm, and PostgreSQL. The supplied local defaults match:

```text
host: localhost
port: 5432
username: postgres
password: postgres
database: lendsqr_wallet
```

### 2. Configure and install

```bash
git clone https://github.com/Akasam79/lendsqr-wallet-service.git
cd lendsqr-wallet-service
corepack enable
pnpm install
cp .env.example .env
```

Change `JWT_SECRET`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before using the service outside local development.

### 3. Create databases

Using pgAdmin, create databases named `lendsqr_wallet` and `lendsqr_wallet_test`, owned by `postgres`. The equivalent command-line setup is:

```bash
createdb -U postgres lendsqr_wallet
createdb -U postgres lendsqr_wallet_test
```

### 4. Migrate, seed and start

```bash
pnpm migration:run
pnpm seed:admin
pnpm start:dev
```

The API starts at `http://localhost:3000/api/v1`; Swagger UI is at `http://localhost:3000/docs`.

The seed can be run repeatedly. It creates or promotes the configured administrator and only grants `ADMIN_INITIAL_BALANCE_MINOR` when creating that administrator's wallet for the first time.

## Environment variables

| Variable | Purpose | Local default/example |
| --- | --- | --- |
| `PORT` | HTTP port | `3000` |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://postgres:postgres@localhost:5432/lendsqr_wallet` |
| `DB_SSL` | Enable PostgreSQL TLS | `false` |
| `JWT_SECRET` | Access-token signing secret, at least 32 characters | required |
| `JWT_EXPIRES_IN_SECONDS` | Access-token lifetime | `900` |
| `CORS_ORIGINS` | `*` or comma-separated allowed origins | `*` |
| `RATE_LIMIT_TTL_MS` | Rate-limit window | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Requests per client in the window | `100` |
| `BLACKLIST_PROVIDER` | `test` now; `adjutor` is reserved | `test` |
| `BLACKLIST_TEST_IDENTITIES` | Comma-separated rejected emails or phones | sample values supplied |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PHONE` | Seed administrator identity | required for seeding |
| `ADMIN_INITIAL_BALANCE_MINOR` | First-time demo balance in kobo | `10000000` (NGN 100,000) |

See [.env.example](./.env.example) for the complete template. Secrets are ignored by Git.

## API

All paths below are prefixed with `/api/v1`. Except for registration, login and health checks, send `Authorization: Bearer <access-token>`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Screen identity, create user and wallet |
| `POST` | `/auth/login` | Public | Return a short-lived JWT |
| `GET` | `/users/me` | Authenticated | Return the current user |
| `GET` | `/wallets/me` | Authenticated | Return the current wallet and balance |
| `POST` | `/transfers` | Authenticated | Transfer funds; requires `Idempotency-Key` |
| `GET` | `/transfers/:reference` | Sender | Return one outgoing transfer |
| `GET` | `/admin/users/:id` | Administrator | Inspect an account |
| `PATCH` | `/admin/users/:id/status` | Administrator | Block or unblock an account |
| `GET` | `/health/live` | Public | Confirm the process is running |
| `GET` | `/health/ready` | Public | Confirm PostgreSQL is reachable |

### Example flow

Register a recipient:

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "firstName": "Ada",
    "lastName": "Lovelace",
    "email": "ada@example.com",
    "phone": "+2348012345678",
    "password": "StrongPass123"
  }'
```

Log in as the seeded administrator:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"your-admin-password"}'
```

Use the returned token and the recipient wallet ID to transfer NGN 1,250.50:

```bash
curl -X POST http://localhost:3000/api/v1/transfers \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-transfer-20260904-001' \
  -d '{
    "recipientWalletId": "<recipient-wallet-uuid>",
    "amount": "1250.50",
    "description": "Demo transfer"
  }'
```

Send the exact request again with the same key to observe a safe replay. Change the amount while keeping the key to receive `409 Conflict`.

## Tests and quality checks

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

End-to-end tests run against `lendsqr_wallet_test` and truncate its application tables. Never point `.env.test` at a database containing valuable data.

The concurrency suite proves that:

- Twenty simultaneous NGN 10 transfers from a NGN 100 wallet result in exactly ten successes and a zero sender balance.
- Twenty simultaneous submissions with one idempotency key create one transfer and one debit.
- A key cannot be reused for altered transfer details.
- A blocked recipient causes a failed transfer without changing either balance.

GitHub Actions runs linting, unit tests, compilation and database-backed tests on pushes and pull requests.

## Deploy to Render

The checked-in [render.yaml](./render.yaml) defines a free web service and PostgreSQL database.

1. Push the repository to GitHub.
2. In Render, choose **New > Blueprint** and connect this repository.
3. Enter `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_PHONE` when prompted. Use a unique strong password.
4. Apply the Blueprint and wait for `/api/v1/health/ready` to return `200`.
5. Add the generated service URL near the top of this README.

Each service start applies pending migrations, idempotently seeds the administrator, and then starts the compiled API. Render's free PostgreSQL offering is suitable for this review deployment but has retention and availability limits; a production service should use a persistent paid database and a separately controlled release migration step.

For a real frontend, replace `CORS_ORIGINS=*` with its exact origin. The Blueprint uses Render's private database connection and generates the JWT secret.

## Production evolution

The next changes would be driven by actual product requirements: implement the confirmed Adjutor/Karma adapter with timeout/retry/circuit-breaker behavior; add a double-entry immutable ledger and reconciliation jobs; move rate limiting to a shared Redis store for multiple instances; add refresh-token rotation and key rotation; and emit structured audit/observability events. Those are intentionally outside this exercise rather than partially implemented abstractions.

## License

This repository was created for a take-home engineering assessment and is not licensed for redistribution.
