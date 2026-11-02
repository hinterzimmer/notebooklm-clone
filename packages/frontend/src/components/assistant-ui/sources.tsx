import React, { useState } from 'react';
import {
  FileText,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Quote,
} from 'lucide-react';

export interface SourceItem {
  id?: string;
  title: string;
  filename?: string;
  snippet?: string;
  url?: string;
  index?: number;
  page?: number;
  lineStart?: number;
  lineEnd?: number;
}

export interface SourcesProps {
  sources: readonly SourceItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  layout?: 'grid' | 'list';
  className?: string;
  onSelectCitation?: (source: SourceItem) => void;
}

export const Sources: React.FC<SourcesProps> = ({
  sources,
  open: controlledOpen,
  onOpenChange,
  layout = 'grid',
  className = '',
  onSelectCitation,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;

  const handleToggle = () => {
    const next = !isOpen;
    if (onOpenChange) {
      onOpenChange(next);
    } else {
      setUncontrolledOpen(next);
    }
  };

  if (!sources || sources.length === 0) return null;

  return (
    <div
      className={`not-prose my-3 border border-border rounded-xl overflow-hidden bg-card/60 text-xs transition-all ${className}`}
    >
      {/* Sources Trigger */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-secondary/60 transition-colors text-left cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 text-foreground font-medium">
          <div className="p-1 bg-secondary text-accent rounded-md border border-border/60">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <span>Sources</span>
          <span className="px-1.5 py-0.2 bg-secondary border border-border/40 rounded-full text-[10px] text-muted-foreground font-semibold">
            {sources.length}
          </span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="text-[11px]">{isOpen ? 'Hide' : 'Show passages'}</span>
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {/* Sources Content / Cards */}
      {isOpen && (
        <div
          className={`p-3 border-t border-border ${
            layout === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 gap-2.5'
              : 'space-y-2'
          }`}
        >
          {sources.map((source, i) => (
            <SourceCard
              key={source.id || i}
              source={source}
              index={source.index || i + 1}
              onSelectCitation={onSelectCitation}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const SourceCard: React.FC<{
  source: SourceItem;
  index: number;
  onSelectCitation?: (source: SourceItem) => void;
}> = ({ source, index, onSelectCitation }) => {
  const filename = source.filename || source.title || 'Document';
  const page = source.page || 1;

  return (
    <div
      id={`source-card-${index}`}
      onClick={() => onSelectCitation?.(source)}
      className="p-3 bg-popover border border-border rounded-xl shadow-2xs hover:border-accent/40 transition-all flex flex-col justify-between cursor-pointer"
    >
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-border/50">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-semibold">
              [{index}]
            </span>
            <span
              className="font-medium text-foreground truncate text-xs"
              title={filename}
            >
              {filename}
            </span>
          </div>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
            p.{page}
            {source.lineStart ? ` (L${source.lineStart}-${source.lineEnd})` : ''}
          </span>
        </div>

        {/* Verbatim Passage / Snippet */}
        {source.snippet ? (
          <div className="relative pl-2.5 my-1.5 border-l-2 border-accent/60 bg-accent/5 py-1.5 pr-2 rounded-r">
            <div className="flex items-start gap-1.5">
              <Quote className="w-3 h-3 text-accent shrink-0 mt-0.5" />
              <p className="text-[11px] text-foreground/90 leading-relaxed font-sans line-clamp-6 select-text">
                {source.snippet}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">No passage text available.</p>
        )}
      </div>

      {source.url && (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] text-accent hover:underline self-end"
        >
          <span>Open attachment</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
};

/**
 * Interactive inline citation badge [1], [2] with instant hover tooltip preview
 */
export const InlineCitationHover: React.FC<{
  index: number;
  source?: SourceItem;
  onSelectCitation?: (source: SourceItem) => void;
}> = ({ index, source, onSelectCitation }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (source && onSelectCitation) {
      onSelectCitation(source);
    }
    const el = document.getElementById(`source-card-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-accent');
      setTimeout(() => el.classList.remove('ring-2', 'ring-accent'), 1500);
    }
  };

  return (
    <span
      className="relative inline-block mx-0.5 align-baseline"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded text-[11px] font-mono bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer transition-all"
        title={source?.filename ? `Source ${index}: ${source.filename}` : `Source ${index}`}
      >
        [{index}]
      </button>

      {/* Zero-Click Hover Popover displaying the passage */}
      {isHovered && source && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 p-3 bg-popover border border-border rounded-xl shadow-xl text-left pointer-events-none animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between gap-1 mb-1.5 pb-1 border-b border-border/60">
            <span className="font-semibold text-xs text-foreground truncate">
              {source.filename || source.title}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground shrink-0">
              Page {source.page || 1}
            </span>
          </div>
          {source.snippet ? (
            <p className="text-[11px] text-foreground/90 leading-snug line-clamp-4 font-sans">
              "{source.snippet}"
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">Reference #{index}</p>
          )}
        </div>
      )}
    </span>
  );
};
