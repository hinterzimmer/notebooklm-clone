import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import { UserContextService } from './user-context.service.js';

export const WRITE_POOL = 'WRITE_POOL';
export const READ_POOL = 'READ_POOL';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  public pool: pg.Pool;

  get writePool(): pg.Pool {
    return this.pool;
  }

  get readPool(): pg.Pool {
    return this.pool;
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly userContextService: UserContextService,
  ) {
    const dbConfig = this.configService.get('database');

    this.pool = new pg.Pool({
      host: dbConfig.writeHost,
      port: dbConfig.writePort,
      database: dbConfig.name,
      user: dbConfig.user,
      password: dbConfig.pass,
      max: 20,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle database client', err);
    });
  }

  /**
   * Runs a query on the pool with user context applied.
   */
  async query<T extends pg.QueryResultRow = any>(
    text: string,
    params: any[] = [],
    _useWritePool = false,
  ): Promise<pg.QueryResult<T>> {
    const client = await this.pool.connect();
    try {
      const userId =
        this.userContextService.getUserId() || '00000000-0000-7000-8000-000000000001';
      await client.query("SELECT set_config('app.current_user_id', $1, false)", [userId]);
      return await client.query<T>(text, params);
    } finally {
      client.release();
    }
  }

  /**
   * Executes a callback within a managed transaction with user context applied.
   */
  async withWriteTransaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const userId =
        this.userContextService.getUserId() || '00000000-0000-7000-8000-000000000001';
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Executes a read transaction with BEGIN READ ONLY and user context applied.
   */
  async withReadTransaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      const userId =
        this.userContextService.getUserId() || '00000000-0000-7000-8000-000000000001';
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
