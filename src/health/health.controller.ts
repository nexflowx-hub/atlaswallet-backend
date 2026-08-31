import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ONLINE',
      service: 'AtlasWallet API',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  ready() {
    return {
      status: 'READY',
      service: 'AtlasWallet API',
      dependencies: {
        database: 'NOT_CONFIGURED',
        redis: 'NOT_CONFIGURED',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
