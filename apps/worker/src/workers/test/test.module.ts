import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../../queues/queues.constants.js';
import { TestProcessor } from './test.processor.js';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.TEST })],
  providers: [TestProcessor],
})
export class TestModule {}
