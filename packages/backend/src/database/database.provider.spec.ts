import test from 'node:test';
import assert from 'node:assert';
import { DatabaseService } from './database.provider.js';

test('DatabaseService unit tests', async (t) => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'database') {
        return {
          writeHost: 'localhost',
          writePort: 5432,
          name: 'notebooklm',
          user: 'postgres',
          pass: 'postgres',
        };
      }
      return {};
    },
  } as any;

  await t.test('query applies user context and releases client in finally block', async () => {
    // given
    const mockUserContextService = {
      getUserId: () => 'u-context-123',
    } as any;
    const service = new DatabaseService(mockConfigService, mockUserContextService);

    let clientReleased = false;
    const clientQueries: any[] = [];
    const mockClient = {
      query: async (text: string, params: any[]) => {
        clientQueries.push({ text, params });
        return { rows: [{ val: 42 }] };
      },
      release: () => {
        clientReleased = true;
      },
    };
    service.pool.connect = async () => mockClient as any;

    // when
    const result = await service.query('SELECT $1', [100], false);

    // then
    assert.deepStrictEqual(result.rows, [{ val: 42 }]);
    assert.strictEqual(clientReleased, true);
    assert.strictEqual(clientQueries.length, 2);
    assert.strictEqual(clientQueries[0].text, "SELECT set_config('app.current_user_id', $1, false)");
    assert.strictEqual(clientQueries[0].params[0], 'u-context-123');
    assert.strictEqual(clientQueries[1].text, 'SELECT $1');
    assert.strictEqual(clientQueries[1].params[0], 100);
    assert.strictEqual(service.writePool, service.pool);
    assert.strictEqual(service.readPool, service.pool);
  });

  await t.test('query uses fallback userId when user context returns undefined', async () => {
    // given
    const mockUserContextService = {
      getUserId: () => undefined,
    } as any;
    const service = new DatabaseService(mockConfigService, mockUserContextService);

    const clientQueries: any[] = [];
    const mockClient = {
      query: async (text: string, params: any[]) => {
        clientQueries.push({ text, params });
        return { rows: [] };
      },
      release: () => {},
    };
    service.pool.connect = async () => mockClient as any;

    // when
    await service.query('SELECT 1');

    // then
    assert.strictEqual(clientQueries[0].params[0], '00000000-0000-7000-8000-000000000001');
  });

  await t.test('withWriteTransaction commits on success and releases client', async () => {
    // given
    const mockUserContextService = {
      getUserId: () => 'u-tx-1',
    } as any;
    const service = new DatabaseService(mockConfigService, mockUserContextService);

    let released = false;
    const txCommands: string[] = [];
    const mockClient = {
      query: async (text: string) => {
        txCommands.push(text);
        return { rows: [] };
      },
      release: () => {
        released = true;
      },
    };
    service.pool.connect = async () => mockClient as any;

    // when
    const result = await service.withWriteTransaction(async (client) => {
      await client.query('INSERT INTO something VALUES (1)');
      return 'ok';
    });

    // then
    assert.strictEqual(result, 'ok');
    assert.strictEqual(released, true);
    assert.strictEqual(txCommands[0], 'BEGIN');
    assert.ok(txCommands[1].includes("set_config('app.current_user_id'"));
    assert.strictEqual(txCommands[2], 'INSERT INTO something VALUES (1)');
    assert.strictEqual(txCommands[3], 'COMMIT');
  });

  await t.test('withWriteTransaction rollbacks on failure and rethrows error', async () => {
    // given
    const mockUserContextService = {
      getUserId: () => 'u-tx-1',
    } as any;
    const service = new DatabaseService(mockConfigService, mockUserContextService);

    let released = false;
    const txCommands: string[] = [];
    const mockClient = {
      query: async (text: string) => {
        txCommands.push(text);
        return { rows: [] };
      },
      release: () => {
        released = true;
      },
    };
    service.pool.connect = async () => mockClient as any;

    // when
    let caughtErr: any;
    try {
      await service.withWriteTransaction(async () => {
        throw new Error('Transaction failure');
      });
    } catch (err) {
      caughtErr = err;
    }

    // then
    assert.ok(caughtErr);
    assert.strictEqual(caughtErr.message, 'Transaction failure');
    assert.strictEqual(released, true);
    assert.ok(txCommands.includes('ROLLBACK'));
    assert.strictEqual(txCommands.includes('COMMIT'), false);
  });

  await t.test('withReadTransaction executes read transaction with BEGIN READ ONLY', async () => {
    // given
    const mockUserContextService = {
      getUserId: () => 'u-read-1',
    } as any;
    const service = new DatabaseService(mockConfigService, mockUserContextService);

    let released = false;
    const txCommands: string[] = [];
    const mockClient = {
      query: async (text: string) => {
        txCommands.push(text);
        return { rows: [] };
      },
      release: () => {
        released = true;
      },
    };
    service.pool.connect = async () => mockClient as any;

    // when
    const result = await service.withReadTransaction(async () => 'read_success');

    // then
    assert.strictEqual(result, 'read_success');
    assert.strictEqual(released, true);
    assert.strictEqual(txCommands[0], 'BEGIN READ ONLY');
    assert.ok(txCommands.includes('COMMIT'));
  });

  await t.test('withReadTransaction rollbacks on error and releases client', async () => {
    // given
    const mockUserContextService = {
      getUserId: () => 'u-read-1',
    } as any;
    const service = new DatabaseService(mockConfigService, mockUserContextService);

    let released = false;
    const txCommands: string[] = [];
    const mockClient = {
      query: async (text: string) => {
        txCommands.push(text);
        return { rows: [] };
      },
      release: () => {
        released = true;
      },
    };
    service.pool.connect = async () => mockClient as any;

    // when
    let error: any;
    try {
      await service.withReadTransaction(async () => {
        throw new Error('Read error');
      });
    } catch (err) {
      error = err;
    }

    // then
    assert.ok(error);
    assert.strictEqual(error.message, 'Read error');
    assert.strictEqual(released, true);
    assert.ok(txCommands.includes('ROLLBACK'));
  });

  await t.test('onModuleDestroy ends pool connection', async () => {
    // given
    const mockUserContextService = { getUserId: () => undefined } as any;
    const service = new DatabaseService(mockConfigService, mockUserContextService);
    let poolEnded = false;
    service.pool.end = async () => {
      poolEnded = true;
    };

    // when
    await service.onModuleDestroy();

    // then
    assert.strictEqual(poolEnded, true);
  });
});
