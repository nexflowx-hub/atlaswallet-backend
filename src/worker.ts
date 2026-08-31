import 'reflect-metadata';

async function bootstrapWorker() {
  // Queue processors are introduced in the Redis/worker stage.
  // Keeping a dedicated process entrypoint now prevents the API process
  // from becoming the execution environment for asynchronous financial jobs.
  console.log(
    JSON.stringify({
      status: 'ONLINE',
      service: 'AtlasWallet Worker',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    }),
  );

  // Keep the worker container alive until queue processors are wired.
  await new Promise<void>(() => undefined);
}

void bootstrapWorker();
