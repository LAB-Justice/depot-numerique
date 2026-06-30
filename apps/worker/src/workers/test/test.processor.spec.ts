import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { TestProcessor } from './test.processor.js';

describe('TestProcessor', () => {
  it('returns the processed message and a valid timestamp', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const processor = new TestProcessor();
    const job = {
      id: 'test-job',
      data: { message: 'hello' },
    } as Job<{ message: string }>;

    const result = await processor.process(job);

    expect(result.message).toBe('Processed: hello');
    expect(Number.isNaN(Date.parse(result.processedAt))).toBe(false);
    expect(Logger.prototype.log).toHaveBeenCalledWith('Processing job test-job: hello');
  });
});
