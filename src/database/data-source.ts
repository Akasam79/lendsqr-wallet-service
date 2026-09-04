import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

const useSsl = process.env.DB_SSL === 'true';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: false,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});
