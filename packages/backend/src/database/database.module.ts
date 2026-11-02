import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseService } from './database.provider.js';
import { UserContextService } from './user-context.service.js';
import { TelemetryService } from './telemetry.service.js';
import { UserContextInterceptor } from './user-context.interceptor.js';

@Global()
@Module({
  providers: [
    DatabaseService,
    UserContextService,
    TelemetryService,
    {
      provide: APP_INTERCEPTOR,
      useClass: UserContextInterceptor,
    },
  ],
  exports: [DatabaseService, UserContextService, TelemetryService],
})
export class DatabaseModule {}
