import { Controller, ForbiddenException, Get, Headers, Query } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { config } from '../config';
import { DbService } from './db.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly db: DbService) {}

  @Get()
  list(@Headers('x-api-key') key = '', @Query('minScore') minScore = '0', @Query('limit') limit = '50') {
    if (config.apiKey) {
      const a = Buffer.from(key);
      const b = Buffer.from(config.apiKey);
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ForbiddenException();
    }
    const l = Math.min(200, Math.max(1, Number(limit) || 50));
    return this.db.list(Number(minScore) || 0, l);
  }
}
