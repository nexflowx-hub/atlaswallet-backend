import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  health() {
    return this.healthService.liveness();
  }

  @Get('ready')
  async ready() {
    const result = await this.healthService.readiness();

    if (!result.ready) {
      throw new ServiceUnavailableException(result.body);
    }

    return result.body;
  }
}
