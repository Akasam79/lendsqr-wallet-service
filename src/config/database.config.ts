import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const useSsl = config.get<boolean>('DB_SSL', false);

    return {
      type: 'postgres',
      url: config.getOrThrow<string>('DATABASE_URL'),
      autoLoadEntities: true,
      synchronize: false,
      migrationsRun: false,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    };
  },
};
