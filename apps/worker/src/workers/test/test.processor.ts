import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUES } from '../../queues/queues.constants.js';
import type { TestJobData, TestJobResult } from './test.dto.js';

@Processor(QUEUES.TEST)
export class TestProcessor extends WorkerHost {
  private readonly logger = new Logger(TestProcessor.name);

  async process(job: Job<TestJobData, TestJobResult>): Promise<TestJobResult> {
    this.logger.log(`Processing job ${job.id}: ${job.data.message}`);

    // Simulation asynchrone
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      message: `Processed: ${job.data.message}`,
      processedAt: new Date().toISOString(),
    };
  }
}
