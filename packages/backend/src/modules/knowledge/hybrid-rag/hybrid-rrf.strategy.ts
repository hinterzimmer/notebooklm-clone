import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.provider.js';
import { BedrockEmbeddingService } from '../../ingestion/embeddings/bedrock-embedding.service.js';
import { IIngestionStrategy, IRetrievalStrategy, IngestionContext } from '../knowledge.interface.js';
import { SearchIntent, RetrievedBlock } from '@notebooklm/shared';

@Injectable()
export class HybridRrfStrategy implements IIngestionStrategy, IRetrievalStrategy {
  private readonly logger = new Logger(HybridRrfStrategy.name);
  readonly strategyName = 'hybrid_rag' as const;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly embeddingService: BedrockEmbeddingService,
  ) {}

  /**
   * Ingests chunks into rag_chunks table with halfvec(1024) embedding and tsvector.
   */
  async indexDocument(context: IngestionContext): Promise<void> {
    const { sourceId, versionId, ownerId, chunks } = context;

    await this.databaseService.withWriteTransaction(async (client) => {
      for (const chunk of chunks) {
        const embeddingStr = await this.embeddingService.getEmbedding(chunk.content);

        await client.query(
          `INSERT INTO rag_chunks (
            source_id, version_id, owner_id, chunk_index, content, embedding, citation_anchor, is_multimodal, image_s3_key
          ) VALUES ($1, $2, $3, $4, $5, $6::halfvec(1024), $7, $8, $9)`,
          [
            sourceId,
            versionId,
            ownerId,
            chunk.chunkIndex,
            chunk.content,
            embeddingStr,
            JSON.stringify(chunk.citationAnchor),
            chunk.isMultimodal,
            chunk.imageS3Key || null,
          ],
        );
      }
    });

    this.logger.log(`Indexed ${chunks.length} chunks into rag_chunks for version ${versionId}`);
  }

  /**
   * Retrieves relevant chunks via Reciprocal Rank Fusion on the READ_POOL.
   */
  async retrieve(
    intent: SearchIntent,
    pinnedVersionIds: string[],
    limit = 6,
  ): Promise<RetrievedBlock[]> {
    if (!pinnedVersionIds || pinnedVersionIds.length === 0) {
      return [];
    }

    const queryText = intent.raw_query;
    const queryVector = await this.embeddingService.getEmbedding(queryText);

    // Clean plain text query for tsquery
    const safeTsQuery = queryText
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(' | ') || 'all';

    const rrfQuery = `
      WITH vector_matches AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> $1::halfvec(1024)) AS rank_vec
        FROM rag_chunks
        WHERE version_id = ANY($2::uuid[])
        LIMIT 50
      ),
      text_matches AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(tsv, to_tsquery('english', $3)) DESC) AS rank_fts
        FROM rag_chunks
        WHERE version_id = ANY($2::uuid[]) AND tsv @@ to_tsquery('english', $3)
        LIMIT 50
      )
      SELECT 
        c.id AS chunk_id,
        c.source_id,
        c.version_id,
        c.content,
        c.citation_anchor,
        c.is_multimodal,
        c.image_s3_key,
        (COALESCE(1.0 / (60 + v.rank_vec), 0.0) + COALESCE(1.0 / (60 + t.rank_fts), 0.0)) AS score
      FROM (
        SELECT COALESCE(v.id, t.id) AS id, v.rank_vec, t.rank_fts
        FROM vector_matches v
        FULL OUTER JOIN text_matches t ON v.id = t.id
      ) r
      JOIN rag_chunks c ON c.id = r.id
      LEFT JOIN vector_matches v ON v.id = c.id
      LEFT JOIN text_matches t ON t.id = c.id
      ORDER BY score DESC
      LIMIT $4
    `;

    try {
      const res = await this.databaseService.withReadTransaction(async (client) => {
        return await client.query(rrfQuery, [
          queryVector,
          pinnedVersionIds,
          safeTsQuery,
          limit,
        ]);
      });

      return res.rows.map((row) => ({
        chunk_id: row.chunk_id,
        source_id: row.source_id,
        version_id: row.version_id,
        content: row.content,
        score: parseFloat(row.score),
        citation_anchor:
          typeof row.citation_anchor === 'string'
            ? JSON.parse(row.citation_anchor)
            : row.citation_anchor,
        is_multimodal: row.is_multimodal,
        image_s3_key: row.image_s3_key,
      }));
    } catch (err) {
      this.logger.error('Hybrid RRF retrieval failed, falling back to vector-only', err);
      // Fallback to simple vector search if tsquery syntax had issues
      const fallbackRes = await this.databaseService.query(
        `SELECT id AS chunk_id, source_id, version_id, content, citation_anchor, is_multimodal, image_s3_key, 1.0 AS score
         FROM rag_chunks
         WHERE version_id = ANY($1::uuid[])
         ORDER BY embedding <=> $2::halfvec(1024)
         LIMIT $3`,
        [pinnedVersionIds, queryVector, limit],
        false, // read pool
      );

      return fallbackRes.rows.map((row) => ({
        chunk_id: row.chunk_id,
        source_id: row.source_id,
        version_id: row.version_id,
        content: row.content,
        score: parseFloat(row.score),
        citation_anchor:
          typeof row.citation_anchor === 'string'
            ? JSON.parse(row.citation_anchor)
            : row.citation_anchor,
        is_multimodal: row.is_multimodal,
        image_s3_key: row.image_s3_key,
      }));
    }
  }
}
