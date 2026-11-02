import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import { Subject, Observable, filter } from 'rxjs';
import { IngestionTelemetryEvent } from '@notebooklm/shared';
import { DatabaseService } from './database.provider.js';

const INGESTION_CHANNEL = 'notebook_ingestion_status';

@Injectable()
export class TelemetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryService.name);
  private subscriberClient?: pg.Client;
  private readonly eventSubject = new Subject<IngestionTelemetryEvent>();

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  async onModuleInit() {
    const appMode = this.configService.get<string>('appMode');
    // Only API and ALL modes need to listen to notification events
    if (appMode === 'API' || appMode === 'ALL') {
      await this.startListener();
    }
  }

  private async startListener() {
    const dbConfig = this.configService.get('database');
    this.subscriberClient = new pg.Client({
      host: dbConfig.writeHost,
      port: dbConfig.writePort,
      database: dbConfig.name,
      user: dbConfig.user,
      password: dbConfig.pass,
    });

    try {
      await this.subscriberClient.connect();
      await this.subscriberClient.query(`LISTEN ${INGESTION_CHANNEL}`);

      this.subscriberClient.on('notification', (msg) => {
        if (msg.channel === INGESTION_CHANNEL && msg.payload) {
          try {
            const event: IngestionTelemetryEvent = JSON.parse(msg.payload);
            this.eventSubject.next(event);
          } catch (err) {
            this.logger.error('Failed to parse telemetry notification JSON', err);
          }
        }
      });

      this.subscriberClient.on('error', (err) => {
        this.logger.error('Telemetry subscriber connection error', err);
      });

      this.logger.log(`Subscribed to PostgreSQL LISTEN ${INGESTION_CHANNEL}`);
    } catch (err) {
      this.logger.error('Could not initialize PostgreSQL LISTEN subscriber', err);
    }
  }

  /**
   * Emits an ingestion progress event via PostgreSQL pg_notify
   * (Usable by WORKER or ALL mode)
   */
  async emitIngestionEvent(event: IngestionTelemetryEvent): Promise<void> {
    const payload = JSON.stringify(event);
    await this.databaseService.query(
      `SELECT pg_notify('${INGESTION_CHANNEL}', $1)`,
      [payload],
      true, // use write pool
    );
  }

  /**
   * Returns an Observable of events filtered by notebookId for the SSE controller
   */
  getNotebookEvents(notebookId: string): Observable<IngestionTelemetryEvent> {
    return this.eventSubject
      .asObservable()
      .pipe(filter((event) => event.notebook_id === notebookId));
  }

  async onModuleDestroy() {
    if (this.subscriberClient) {
      await this.subscriberClient.end();
    }
  }
}
