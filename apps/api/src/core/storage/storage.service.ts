import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';

@Injectable()
export class StorageService {
  readonly client: Client;
  readonly rawBucket: string;

  constructor(config: ConfigService) {
    this.client = new Client({
      endPoint: config.getOrThrow<string>('MINIO_ENDPOINT'),
      port: config.getOrThrow<number>('MINIO_PORT'),
      useSSL: config.getOrThrow<boolean>('MINIO_USE_SSL'),
      accessKey: config.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: config.getOrThrow<string>('MINIO_SECRET_KEY'),
    });

    this.rawBucket = config.getOrThrow<string>('MINIO_RAW_BUCKET');
  }
}
