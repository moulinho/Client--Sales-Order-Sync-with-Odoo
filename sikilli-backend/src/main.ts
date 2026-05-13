import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

function assertEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    logger.error(`Missing required environment variable: ${key}`);
    logger.error(`Copy .env.example to .env and fill in the values.`);
    process.exit(1);
  }
  return val;
}

async function bootstrap() {
  assertEnv('DATABASE_URL');
  const odooHost = assertEnv('ODOO_HOST');
  const odooPort = assertEnv('ODOO_PORT');
  const odooDb = assertEnv('ODOO_DB');
  const odooUser = assertEnv('ODOO_USERNAME');

  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  logger.log(`API listening on http://localhost:${port}`);
  logger.log(
    `Odoo target: http://${odooHost}:${odooPort}  db=${odooDb}  user=${odooUser}`,
  );
}
void bootstrap();
