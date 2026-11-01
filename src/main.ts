import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  // Without an API key the API is reachable only from this machine
  await app.listen(config.port, config.apiKey ? '0.0.0.0' : '127.0.0.1');
}
bootstrap();
