import { HealthIndicatorService } from '@nestjs/terminus';
import { Test, type TestingModule } from '@nestjs/testing';
import { StorageService } from '../storage/storage.service';
import { MinioHealthIndicator } from './minio.health-indicator';

const bucketExists = jest.fn();

describe('MinioHealthIndicator', () => {
  let indicator: MinioHealthIndicator;

  beforeEach(async () => {
    bucketExists.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioHealthIndicator,
        HealthIndicatorService,
        {
          provide: StorageService,
          useValue: {
            client: {
              bucketExists,
            },
            rawBucket: 'documents-raw',
          },
        },
      ],
    }).compile();

    indicator = module.get(MinioHealthIndicator);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should report MinIO as up when the raw bucket exists', async () => {
    bucketExists.mockResolvedValueOnce(true);

    await expect(indicator.isHealthy('minio')).resolves.toEqual({
      minio: {
        status: 'up',
      },
    });

    expect(bucketExists).toHaveBeenCalledWith('documents-raw');
  });

  it('should report MinIO as down when the raw bucket does not exist', async () => {
    bucketExists.mockResolvedValueOnce(false);

    await expect(indicator.isHealthy('minio')).resolves.toEqual({
      minio: {
        status: 'down',
      },
    });
  });

  it('should report MinIO as down when the request fails', async () => {
    bucketExists.mockRejectedValueOnce(new Error('MinIO unavailable'));

    await expect(indicator.isHealthy('minio')).resolves.toEqual({
      minio: {
        status: 'down',
      },
    });
  });

  it('should report MinIO as down when the request times out', async () => {
    jest.useFakeTimers();

    bucketExists.mockReturnValueOnce(new Promise(() => undefined));

    const result = indicator.isHealthy('minio');

    await jest.advanceTimersByTimeAsync(1000);

    await expect(result).resolves.toEqual({
      minio: {
        status: 'down',
      },
    });
  });
});
