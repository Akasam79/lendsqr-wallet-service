import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../auth/decorators/public.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Confirm that the application process is alive' })
  liveness() {
    return this.healthService.liveness();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Confirm that the application can reach PostgreSQL',
  })
  readiness() {
    return this.healthService.readiness();
  }
}
