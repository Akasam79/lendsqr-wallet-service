import Joi from 'joi';

const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  CORS_ORIGINS: Joi.string().default('*'),
  RATE_LIMIT_TTL_MS: Joi.number().integer().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().positive().default(100),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  DB_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN_SECONDS: Joi.number().integer().positive().default(900),
  BLACKLIST_PROVIDER: Joi.string().valid('test', 'adjutor').default('test'),
  BLACKLIST_TEST_IDENTITIES: Joi.string().allow('').default(''),
  ADJUTOR_BASE_URL: Joi.string().uri().default('https://adjutor.lendsqr.com'),
  ADJUTOR_API_KEY: Joi.string().allow('').optional(),
}).unknown(true);

export type Environment = {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  CORS_ORIGINS: string;
  RATE_LIMIT_TTL_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  DATABASE_URL: string;
  DB_SSL: boolean;
  JWT_SECRET: string;
  JWT_EXPIRES_IN_SECONDS: number;
  BLACKLIST_PROVIDER: 'test' | 'adjutor';
  BLACKLIST_TEST_IDENTITIES: string;
  ADJUTOR_BASE_URL: string;
  ADJUTOR_API_KEY?: string;
};

export function validateEnvironment(
  config: Record<string, unknown>,
): Environment {
  const { error, value } = environmentSchema.validate(config, {
    abortEarly: false,
    convert: true,
  });

  if (error) {
    throw new Error(`Environment validation failed: ${error.message}`);
  }

  const environment = value as Environment;
  if (
    environment.BLACKLIST_PROVIDER === 'adjutor' &&
    !environment.ADJUTOR_API_KEY
  ) {
    throw new Error(
      'Environment validation failed: ADJUTOR_API_KEY is required when BLACKLIST_PROVIDER is adjutor',
    );
  }

  return environment;
}
