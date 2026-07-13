import { Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { StorageService } from '../storage/storage.service';

const HEALTH_TIMEOUT_MS = 1000;

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('MinIO healthcheck timed out'));
    }, timeoutMs);

    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

@Injectable()
export class MinioHealthIndicator {
  constructor(
    private readonly healthIndicator: HealthIndicatorService,
    private readonly storage: StorageService,
  ) {}

  async isHealthy<Key extends string>(key: Key): Promise<HealthIndicatorResult<Key>> {
    const indicator = this.healthIndicator.check(key);

    try {
      const bucketExists = await withTimeout(
        this.storage.client.bucketExists(this.storage.rawBucket),
        HEALTH_TIMEOUT_MS,
      );

      return bucketExists ? indicator.up() : indicator.down();
    } catch {
      return indicator.down();
    }
  }
}
