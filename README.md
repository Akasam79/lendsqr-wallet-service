# Lendsqr Wallet Service

A focused wallet API that creates a wallet during registration, screens identities through a pluggable blacklist provider, funds wallets, lets administrators block or unblock accounts, and transfers NGN without losing balance accuracy under concurrent requests. An Adjutor Karma adapter is included for external blacklist checks.

Repository: [github.com/Akasam79/lendsqr-wallet-service](https://github.com/Akasam79/lendsqr-wallet-service)

Live API: https://lendsqr-wallet-service-vk80.onrender.com

Interactive API documentation is available at `/docs` when the service is running.

## What is included

- Atomic user and wallet creation after blacklist screening
- JWT authentication with Argon2 password hashing
- Role-protected account inspection, blocking and unblocking
- Authenticated, audited and idempotent wallet funding
- Atomic wallet-to-wallet transfers with PostgreSQL row locks
- Mandatory idempotency keys and request fingerprinting
- Integer minor-unit money storage (`10050` means `NGN 100.50`)
- Database constraints, versioned migrations and an idempotent admin seed
- Request validation, security headers, CORS configuration and rate limiting
- Liveness/readiness endpoints, Swagger documentation and CI
- Unit tests and PostgreSQL-backed concurrency tests

## Deliberate scope

The product surface is deliberately small so that its financial behavior remains explicit. Each user owns one NGN wallet. There is no withdrawal flow, transaction pagination, refresh-token system or multi-currency conversion.

The funding endpoint credits only the authenticated user's wallet and models confirmation that an external deposit has succeeded. Production payment rails would invoke the underlying operation from a signed provider webhook rather than expose direct self-funding to a customer.

## Design decisions

### Concurrency and balance integrity

A transfer runs in one database transaction. It loads both account records and both wallets, then acquires PostgreSQL pessimistic write locks in deterministic UUID order. The active/blocked decision and both balance updates therefore use the same committed state. Parallel requests cannot overdraw a wallet, and opposite-direction transfers use the same lock order to avoid deadlocks.

The database also enforces non-negative wallet balances, positive transfer amounts, different sender and recipient wallets, unique transfer references, and one idempotency key per sender wallet.

### Idempotency and replay protection

Every funding and transfer request requires an `Idempotency-Key` header. The first request persists the key and a SHA-256 fingerprint of the request details in the same transaction as the balance change.

- Retrying the same request returns the original transfer and never debits twice.
- Reusing the key with different transfer details returns `409 Conflict`.
- Simultaneous retries are serialized by the database uniqueness constraint.

### Money representation

Amounts enter the API as decimal strings to avoid JavaScript floating-point errors. They are parsed into integer kobo and stored in PostgreSQL `BIGINT` columns. Responses include both the formatted major amount and/or the unambiguous minor-unit value where applicable.

### Blacklist integration boundary

Registration depends on a `BlacklistProvider` interface. The production adapter calls Adjutor's `GET /v2/verification/karma/:identity` endpoint with bearer authentication and a bounded timeout. A successful Karma match blocks registration; a missing identity may proceed. Integration errors fail closed with `503` so an unchecked user is never onboarded.

The deterministic provider is enabled with `BLACKLIST_PROVIDER=test` and reads `BLACKLIST_TEST_IDENTITIES`. It makes local development, automated tests and hosted demonstrations reproducible without external network calls or paid API access. The Render Blueprint uses this provider by default. The Adjutor adapter can be enabled without a code change when an API key is available.

### Account controls

Only administrators can block or unblock a user. Blocking requires a reason and records who performed it and when. A blocked user cannot log in, use an existing token, send funds or receive funds. Account status changes lock the same user row used by the transfer path, so blocking and transferring cannot make decisions from inconsistent states.

## Project structure

```text
src/
├── admin/          # role-protected user status management
├── auth/           # registration, login, JWT guards and decorators
├── blacklist/      # Adjutor Karma adapter and deterministic test provider
├── config/         # validated environment and database configuration
├── database/       # TypeORM data source and versioned migrations
├── health/         # liveness and database readiness checks
├── transfers/      # money parsing and concurrency-safe transfer workflow
├── users/          # user entity and current-user endpoint
├── wallets/        # wallet balance, funding records and funding workflow
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

The seed can be run repeatedly. It creates or synchronizes the configured administrator, including its profile, password, role and active status. `ADMIN_INITIAL_BALANCE_MINOR` is applied only when the administrator's wallet is created for the first time and defaults to zero because the funding endpoint is available.

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
| `BLACKLIST_PROVIDER` | `test` or the real `adjutor` adapter | `test` locally |
| `BLACKLIST_TEST_IDENTITIES` | Comma-separated rejected emails or phones | sample values supplied |
| `ADJUTOR_BASE_URL` | Adjutor API origin | `https://adjutor.lendsqr.com` |
| `ADJUTOR_API_KEY` | Adjutor app bearer token | required with `adjutor` |
| `ADJUTOR_TIMEOUT_MS` | Karma lookup timeout | `5000` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PHONE` | Seed administrator identity | required for seeding |
| `ADMIN_INITIAL_BALANCE_MINOR` | Optional first-time opening balance in kobo | `0` |

See [.env.example](./.env.example) for the complete template. Secrets are ignored by Git.

## API

All paths below are prefixed with `/api/v1`. Except for registration, login and health checks, send `Authorization: Bearer <access-token>`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Screen identity, create user and wallet |
| `POST` | `/auth/login` | Public | Return a short-lived JWT |
| `GET` | `/users/me` | Authenticated | Return the current user |
| `GET` | `/wallets/me` | Authenticated | Return the current wallet and balance |
| `POST` | `/wallets/me/fund` | Authenticated | Fund own wallet; requires `Idempotency-Key` |
| `POST` | `/transfers` | Authenticated | Transfer funds; requires `Idempotency-Key` |
| `GET` | `/transfers/:reference` | Sender | Return one outgoing transfer |
| `GET` | `/admin/users/:id` | Administrator | Inspect an account |
| `PATCH` | `/admin/users/:id/status` | Administrator | Block or unblock an account |
| `GET` | `/health/live` | Public | Confirm the process is running |
| `GET` | `/health/ready` | Public | Confirm PostgreSQL is reachable |

### Postman collection

Import [`postman/lendsqr-wallet-service.postman_collection.json`](./postman/lendsqr-wallet-service.postman_collection.json) into Postman. The collection uses the deployed API by default; change its `baseUrl` variable to `http://localhost:3000/api/v1` to test a local instance.

1. Open the collection's **Variables** tab and set `adminEmail` and `adminPassword` to the administrator values configured in Render. Keep these as local values and never commit them.
2. Run the requests from folders 1 through 6 in order, or use **Run collection**. Start with **Register Sender** for each new run; its pre-request script generates unique emails, phone numbers and idempotency keys.
3. Registration and login scripts capture the user IDs, wallet IDs and JWTs automatically. Funding and transfer scripts capture their references for later requests.
4. Open the **Test Results** panel. Each request explains its purpose and expected response, and includes assertions for the expected status and important response fields.

The sequence checks both happy paths and security-sensitive behavior: blacklist rejection, missing authentication, idempotent funding and transfer replays, rejection of altered replays, balance accuracy, administrator authorization, and block/unblock enforcement. Render's free service may take roughly 50 seconds to wake after inactivity, so allow the first health request to finish before running the collection.

Interactive OpenAPI documentation is also available at [`/docs`](https://lendsqr-wallet-service-vk80.onrender.com/docs), with the machine-readable document at [`/docs-json`](https://lendsqr-wallet-service-vk80.onrender.com/docs-json).

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

Fund the authenticated wallet with NGN 5,000:

```bash
curl -X POST http://localhost:3000/api/v1/wallets/me/fund \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-funding-20260905-001' \
  -d '{"amount":"5000.00","description":"Demo funding"}'
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

- Simultaneous funding retries create one funding record and one credit.
- Distinct parallel funding requests all contribute exactly once to the balance.
- Ten simultaneous NGN 10 transfers from a NGN 50 wallet result in exactly five successes and a zero sender balance.
- Ten simultaneous submissions with one idempotency key create one transfer and one debit.
- A key cannot be reused for altered transfer details.
- A blocked recipient causes a failed transfer without changing either balance.

GitHub Actions runs linting, unit tests, compilation and database-backed tests on pushes and pull requests.

### Database isolation and reset

The Postman collection generates unique identities and idempotency keys, so it can be run repeatedly without resetting the database. Its generated records contain only synthetic data. The hosted database is intentionally persistent and retains the seeded administrator used for account controls.

The end-to-end suite uses the separate `lendsqr_wallet_test` database and deletes its own application rows before each test. It must never be pointed at the development or Render database.

To reset a local development environment, stop the API, drop and recreate only `lendsqr_wallet` in pgAdmin, then run `pnpm migration:run` and `pnpm seed:admin`. Confirm the database name before dropping it. The hosted database does not require this reset.

## Deploy to Render

The checked-in [render.yaml](./render.yaml) defines a free web service and PostgreSQL database.

1. Push the repository to GitHub.
2. In Render, choose **New > Blueprint** and connect this repository.
3. Enter `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_PHONE` when prompted. Use a unique strong password.
4. Apply the Blueprint and wait for `/api/v1/health/ready` to return `200`.
5. Add the generated service URL near the top of this README.

Each service start applies pending migrations, idempotently seeds the administrator, and then starts the compiled API. Render's free PostgreSQL offering is sufficient for this hosted instance but has retention and availability limits; a production service should use a persistent paid database and a separately controlled release migration step.

For a real frontend, replace `CORS_ORIGINS=*` with its exact origin. The Blueprint uses Render's private database connection, generates the JWT secret and configures the deterministic blacklist provider with `blocked@example.com` and `+2348000000000` as test fixtures.

To use Karma, create an Adjutor app with the Karma lookup scope, configure its bearer token as `ADJUTOR_API_KEY`, and change `BLACKLIST_PROVIDER` to `adjutor`. The service validates this configuration at startup and fails closed if the credential is missing or if the lookup cannot be completed.

## Possible extensions

Further changes should be driven by product requirements: connect funding to signed payment-provider webhooks; add a double-entry immutable ledger and reconciliation jobs; add retry/circuit-breaker policy informed by Adjutor's billing and availability contract; move rate limiting to a shared Redis store for multiple instances; add refresh-token rotation and key rotation; and emit structured audit/observability events. These capabilities are not represented by partial abstractions in the current codebase.

## License

No license is granted for redistribution.
