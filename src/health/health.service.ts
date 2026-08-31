import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

export type DependencyState = 'ONLINE' | 'OFFLINE';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  liveness() {
    return {
      status: 'ONLINE',
      service: 'AtlasWallet API',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }

  async readiness() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const ready = database === 'ONLINE' && redis === 'ONLINE';

    return {
      ready,
      body: {
        status: ready ? 'READY' : 'NOT_READY',
        service: 'AtlasWallet API',
        version: '0.1.0',
        dependencies: {
          database,
          redis,
        },
        timestamp: new Date().toISOString(),
      },
    };
  }

  private async checkDatabase(): Promise<DependencyState> {
    try {
      await this.prisma.ping();
      return 'ONLINE';
    } catch {
      return 'OFFLINE';
    }
  }

  private async checkRedis(): Promise<DependencyState> {
    try {
      await this.redis.ping();
      return 'ONLINE';
    } catch {
      return 'OFFLINE';
    }
  }
}
