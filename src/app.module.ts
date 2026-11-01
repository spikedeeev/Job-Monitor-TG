import { Module } from '@nestjs/common';
import { AiService } from './jobs/ai.service';
import { CollectorService } from './jobs/collector.service';
import { DbService } from './jobs/db.service';
import { JobsController } from './jobs/jobs.controller';
import { NotifierService } from './jobs/notifier.service';
import { PipelineService } from './jobs/pipeline.service';

@Module({
  controllers: [JobsController],
  providers: [DbService, AiService, NotifierService, PipelineService, CollectorService],
})
export class AppModule {}
