import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const configuredOrigins = config.get<string>('CORS_ORIGINS', '*');

  app.use(helmet());
  app.enableCors({
    origin:
      configuredOrigins === '*'
        ? true
        : configuredOrigins.split(',').map((origin) => origin.trim()),
  });
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Lendsqr Wallet Service')
      .setDescription(
        'User onboarding, account controls and concurrency-safe wallet transfers',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
  });
}
