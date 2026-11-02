import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration.js';
import { DatabaseModule } from './database/database.module.js';
import { AwsModule } from './aws/aws.module.js';
import { ApiModule } from './api.module.js';
import { IngestionModule } from './modules/ingestion/ingestion.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    DatabaseModule,
    AwsModule,
    ApiModule,
    IngestionModule,
  ],
})
export class AppModule {
  static forRoot(_appMode?: string): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        DatabaseModule,
        AwsModule,
        ApiModule,
        IngestionModule,
      ],
    };
  }
}
