import { Injectable, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { DatabaseService } from '../../database/database.provider.js';
import { UserContextService } from '../../database/user-context.service.js';

export interface CreateNotebookDto {
  title: string;
  strategy?: 'hybrid_rag' | 'open_kg';
}

@Injectable()
export class NotebooksService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly userContextService: UserContextService,
  ) {}

  async createNotebook(dto: CreateNotebookDto) {
    const ownerId =
      this.userContextService.getUserId() || '00000000-0000-7000-8000-000000000001';
    const id = uuidv7();
    const strategy = dto.strategy || 'hybrid_rag';

    const res = await this.databaseService.query(
      `INSERT INTO notebooks (id, owner_id, title, strategy)
       VALUES ($1, $2, $3, $4)
       RETURNING id, owner_id, title, strategy, created_at, updated_at`,
      [id, ownerId, dto.title, strategy],
      true, // write pool
    );

    return res.rows[0];
  }

  async listNotebooks() {
    const res = await this.databaseService.query(
      `SELECT id, owner_id, title, strategy, created_at, updated_at
       FROM notebooks
       ORDER BY updated_at DESC`,
      [],
      false, // read pool
    );
    return res.rows;
  }

  async getNotebook(id: string) {
    const res = await this.databaseService.query(
      `SELECT id, owner_id, title, strategy, created_at, updated_at
       FROM notebooks
       WHERE id = $1`,
      [id],
      false,
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Notebook ${id} not found`);
    }

    return res.rows[0];
  }

  async updateNotebook(id: string, updates: Partial<CreateNotebookDto>) {
    const setClauses: string[] = ['updated_at = now()'];
    const params: any[] = [id];
    let paramIndex = 2;

    if (updates.title) {
      setClauses.push(`title = $${paramIndex++}`);
      params.push(updates.title);
    }
    if (updates.strategy) {
      setClauses.push(`strategy = $${paramIndex++}`);
      params.push(updates.strategy);
    }

    const res = await this.databaseService.query(
      `UPDATE notebooks
       SET ${setClauses.join(', ')}
       WHERE id = $1
       RETURNING id, owner_id, title, strategy, created_at, updated_at`,
      params,
      true,
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Notebook ${id} not found`);
    }

    return res.rows[0];
  }

  async deleteNotebook(id: string) {
    await this.databaseService.query(
      `DELETE FROM notebooks WHERE id = $1`,
      [id],
      true,
    );
    return { success: true };
  }
}
