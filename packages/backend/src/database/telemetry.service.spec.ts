import test from 'node:test';
import assert from 'node:assert';
import { TelemetryService } from './telemetry.service.js';
import { IngestionTelemetryEvent } from '@notebooklm/shared';
import { firstValueFrom, toArray, take } from 'rxjs';

test('TelemetryService unit tests', async (t) => {
  await t.test('emitIngestionEvent sends pg_notify query via DatabaseService write pool', async () => {
    // given
    const queryCalls: any[] = [];
    const mockDbService = {
      query: async (sql: string, params: any[], useWritePool: boolean) => {
        queryCalls.push({ sql, params, useWritePool });
      },
    } as any;
    const mockConfigService = {
      get: () => 'API',
    } as any;

    const telemetryService = new TelemetryService(mockConfigService, mockDbService);
    const event: IngestionTelemetryEvent = {
      notebook_id: 'nb-100',
      source_id: 'src-100',
      version_id: 'v-100',
      status: 'READY',
      processing_progress: 100,
      timestamp: '2026-11-02T12:00:00Z',
    };

    // when
    await telemetryService.emitIngestionEvent(event);

    // then
    assert.strictEqual(queryCalls.length, 1);
    assert.ok(queryCalls[0].sql.includes("pg_notify('notebook_ingestion_status'"));
    assert.strictEqual(queryCalls[0].useWritePool, true);
    const parsedPayload = JSON.parse(queryCalls[0].params[0]);
    assert.deepStrictEqual(parsedPayload, event);
  });

  await t.test('getNotebookEvents filters events by notebookId', async () => {
    // given
    const mockConfigService = { get: () => 'WORKER' } as any;
    const mockDbService = {} as any;
    const telemetryService = new TelemetryService(mockConfigService, mockDbService);

    const receivedEvents: IngestionTelemetryEvent[] = [];
    const subscription = telemetryService.getNotebookEvents('target-nb').subscribe((e) => {
      receivedEvents.push(e);
    });

    // when
    const event1: IngestionTelemetryEvent = {
      notebook_id: 'other-nb',
      source_id: 's1',
      version_id: 'v1',
      status: 'BDA_PARSING',
      processing_progress: 25,
      timestamp: '2026-11-02',
    };
    const event2: IngestionTelemetryEvent = {
      notebook_id: 'target-nb',
      source_id: 's2',
      version_id: 'v2',
      status: 'READY',
      processing_progress: 100,
      timestamp: '2026-11-02',
    };

    // Inject events into the internal subject directly
    (telemetryService as any).eventSubject.next(event1);
    (telemetryService as any).eventSubject.next(event2);

    // then
    assert.strictEqual(receivedEvents.length, 1);
    assert.strictEqual(receivedEvents[0].notebook_id, 'target-nb');
    assert.strictEqual(receivedEvents[0].status, 'READY');

    subscription.unsubscribe();
  });

  await t.test('onModuleInit does not start listener when appMode is WORKER', async () => {
    // given
    let startListenerCalled = false;
    const mockConfigService = {
      get: (key: string) => {
        if (key === 'appMode') return 'WORKER';
        return {};
      },
    } as any;
    const mockDbService = {} as any;
    const telemetryService = new TelemetryService(mockConfigService, mockDbService);
    (telemetryService as any).startListener = async () => {
      startListenerCalled = true;
    };

    // when
    await telemetryService.onModuleInit();

    // then
    assert.strictEqual(startListenerCalled, false);
  });

  await t.test('onModuleDestroy ends subscriberClient if connected', async () => {
    // given
    const mockConfigService = { get: () => 'WORKER' } as any;
    const telemetryService = new TelemetryService(mockConfigService, {} as any);
    let ended = false;
    (telemetryService as any).subscriberClient = {
      end: async () => {
        ended = true;
      },
    };

    // when
    await telemetryService.onModuleDestroy();

    // then
    assert.strictEqual(ended, true);
  });
});
