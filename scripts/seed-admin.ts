import { runAdminSeed } from '../src/database/seed-admin';

runAdminSeed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
