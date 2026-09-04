import dataSource from './data-source';

async function runMigrations(): Promise<void> {
  try {
    await dataSource.initialize();
    await dataSource.runMigrations();
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

runMigrations().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
