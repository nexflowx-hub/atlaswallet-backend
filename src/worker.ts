import 'reflect-metadata';
import Redis from 'ioredis';

const VERSION = '0.1.0';

async function bootstrapWorker() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: null,
    connectTimeout: 3000,
    retryStrategy: (times) => Math.min(times * 250, 5000),
  });

  redis.on('error', (error: Error) => {
    console.error(
      JSON.stringify({
        level: 'WARN',
        service: 'AtlasWallet Worker',
        event: 'REDIS_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
    );
  });

  await redis.connect();
  const pong = await redis.ping();

  if (pong !== 'PONG') {
    throw new Error(`Unexpected Redis PING response: ${pong}`);
  }

  console.log(
    JSON.stringify({
      status: 'ONLINE',
      service: 'AtlasWallet Worker',
      version: VERSION,
      dependencies: {
        redis: 'ONLINE',
      },
      timestamp: new Date().toISOString(),
    }),
  );

  await new Promise<void>((resolve) => {
    let stopping = false;

    const shutdown = async (signal: string) => {
      if (stopping) return;
      stopping = true;

      console.log(
        JSON.stringify({
          status: 'STOPPING',
          service: 'AtlasWallet Worker',
          signal,
          timestamp: new Date().toISOString(),
        }),
      );

      try {
        await redis.quit();
      } catch {
        redis.disconnect();
      }

      resolve();
    };

    process.once('SIGTERM', () => void shutdown('SIGTERM'));
    process.once('SIGINT', () => void shutdown('SIGINT'));
  });
}

bootstrapWorker().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(
    JSON.stringify({
      status: 'FAILED',
      service: 'AtlasWallet Worker',
      version: VERSION,
      error: message,
      timestamp: new Date().toISOString(),
    }),
  );

  process.exit(1);
});
