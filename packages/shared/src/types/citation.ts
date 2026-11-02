export interface BoundingBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface CitationAnchor {
  anchor_id: string; // UUIDv7
  source_id: string; // UUIDv7
  version_id: string; // UUIDv7
  page_number?: number;
  markdown_line_start?: number;
  markdown_line_end?: number;
  bounding_box?: BoundingBox;
  caption?: string;
  image_url?: string;
  snippet?: string;
  filename?: string;
  index?: number;
}

export function isCitationAnchor(obj: any): obj is CitationAnchor {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.anchor_id === 'string' &&
    typeof obj.source_id === 'string' &&
    typeof obj.version_id === 'string'
  );
}
