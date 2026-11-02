import React, { useRef, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  useGetSourcesQuery,
  useUploadSourceMutation,
  RootState,
  workspaceSlice,
  API_BASE,
} from '../app/store.js';
import {
  FileText,
  Upload,
  Loader2,
  RefreshCw,
  X,
  ExternalLink,
  Quote,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { IngestionStatus } from '@notebooklm/shared';
import { SourceItem } from './assistant-ui/sources.js';

interface Props {
  notebookId: string;
  onClose?: () => void;
  activeCitation?: {
    index: number;
    filename?: string;
    snippet?: string;
    page?: number;
    lineStart?: number;
    lineEnd?: number;
  } | null;
  onClearActiveCitation?: () => void;
  citedSources?: SourceItem[];
  onSelectCitation?: (source: SourceItem) => void;
  isStreaming?: boolean;
}

export const SourceInspector: React.FC<Props> = ({
  notebookId,
  onClose,
  activeCitation,
  onClearActiveCitation,
  citedSources = [],
  onSelectCitation,
  isStreaming = false,
}) => {
  const dispatch = useDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const token = useSelector((state: RootState) => state.auth.token);
  const ingestionStatuses = useSelector(
    (state: RootState) => state.workspace.ingestionStatuses,
  );

  const [isPassagesOpen, setIsPassagesOpen] = useState(true);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(true);

  const { data: sources, isLoading, refetch } = useGetSourcesQuery(notebookId);
  const [uploadSource, { isLoading: isUploading }] = useUploadSourceMutation();

  // Auto-expand passages section when a citation is selected
  useEffect(() => {
    if (activeCitation) {
      setIsPassagesOpen(true);
    }
  }, [activeCitation]);

  // Subscribe to SSE Ingestion Telemetry for this notebook
  useEffect(() => {
    if (!notebookId) return;

    const sseUrl = `${API_BASE}/notebooks/${notebookId}/events${
      token ? `?token=${token}` : ''
    }`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        dispatch(workspaceSlice.actions.updateIngestionStatus(payload));
        if (payload.status === 'READY') {
          refetch();
        }
      } catch (err) {
        console.error('Failed to parse SSE ingestion event', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [notebookId, token, dispatch, refetch]);

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    try {
      for (const file of fileArray) {
        const formData = new FormData();
        formData.append('file', file);
        await uploadSource({ notebookId, formData }).unwrap();
      }
      refetch();
    } catch (err) {
      console.error('Failed to upload source file(s)', err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(e.target.files);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(e.dataTransfer.files);
    }
  };

  return (
    <aside className="w-80 md:w-96 shrink-0 border-l border-border bg-muted/20 flex flex-col h-full select-none overflow-hidden">
      {/* Header */}
      <div className="h-14 px-4 sm:px-5 border-b border-border flex items-center justify-between shrink-0 bg-card/40">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent" />
          <h2 className="font-sans text-xs font-semibold tracking-wider text-foreground uppercase">
            Sources & Inspector
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors cursor-pointer"
            title="Refresh Sources"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors cursor-pointer"
              title="Close Inspector"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
        {/* SECTION 1: Referenced Sources & Passages (Collapsible) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
            <button
              onClick={() => setIsPassagesOpen(!isPassagesOpen)}
              className="flex items-center gap-2 text-left cursor-pointer group flex-1 py-0.5"
            >
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                {isPassagesOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>
              <h3 className="font-sans text-[11px] font-semibold text-muted-foreground group-hover:text-foreground tracking-wider uppercase transition-colors flex items-center gap-1.5">
                <span>Referenced Passages</span>
                {isStreaming ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium animate-pulse">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    <span>grounding...</span>
                  </span>
                ) : citedSources.length > 0 ? (
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-accent/15 text-accent font-semibold">
                    {citedSources.length}
                  </span>
                ) : null}
              </h3>
            </button>

            {activeCitation && onClearActiveCitation && isPassagesOpen && !isStreaming && (
              <button
                onClick={onClearActiveCitation}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-sans shrink-0 ml-2"
              >
                Clear highlight
              </button>
            )}
          </div>

          {isPassagesOpen && (
            <>
              {isStreaming ? (
                <div className="p-3.5 rounded-xl border border-accent/30 bg-card shadow-2xs space-y-3 animate-pulse">
                  {/* Header Skeleton */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-4 w-7 rounded bg-accent/20" />
                      <div className="h-3.5 w-32 rounded bg-secondary" />
                    </div>
                    <div className="h-3 w-10 rounded bg-secondary" />
                  </div>

                  {/* Snippet Skeleton lines */}
                  <div className="p-2.5 rounded-lg border border-border/50 bg-background/60 space-y-2">
                    <div className="h-2.5 w-full rounded bg-secondary/80" />
                    <div className="h-2.5 w-5/6 rounded bg-secondary/70" />
                    <div className="h-2.5 w-3/4 rounded bg-secondary/60" />
                  </div>

                  {/* Helper status text */}
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-sans pt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-accent shrink-0 animate-spin" />
                    <span>Grounding citations from indexed sources...</span>
                  </div>
                </div>
              ) : citedSources.length === 0 && !activeCitation ? (
                <div className="p-4 rounded-xl border border-dashed border-border/80 bg-background/40 text-center">
                  <Quote className="w-4 h-4 text-muted-foreground/60 mx-auto mb-1.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                    Passages cited in assistant responses will appear here as inspectable cards.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {citedSources.map((cit) => {
                    const isSelected = activeCitation?.index === cit.index;
                    return (
                      <div
                        key={cit.id || cit.index}
                        id={`source-card-${cit.index}`}
                        onClick={() => onSelectCitation?.(cit)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-accent/10 border-accent ring-1 ring-accent shadow-sm'
                            : 'bg-card border-border hover:border-accent/40 shadow-2xs'
                        }`}
                      >
                        {/* Card Header: Citation Badge, Filename, Page/Line */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-semibold shrink-0">
                              [{cit.index}]
                            </span>
                            <span
                              className="font-sans text-xs font-medium text-foreground truncate"
                              title={cit.filename}
                            >
                              {cit.filename}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">
                            p.{cit.page || 1}
                            {cit.lineStart ? ` L${cit.lineStart}-${cit.lineEnd}` : ''}
                          </span>
                        </div>

                        {/* Verbatim Snippet */}
                        {cit.snippet ? (
                          <p className="text-xs font-sans text-foreground/90 leading-relaxed bg-background/70 p-2.5 rounded-lg border border-border/60 select-text">
                            "{cit.snippet}"
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic font-sans">
                            No passage snippet available.
                          </p>
                        )}

                        {cit.url && (
                          <div className="pt-2 flex justify-end">
                            <a
                              href={cit.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] font-sans text-accent hover:underline"
                            >
                              <span>Open file</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* SECTION 2: Indexed Documents (Collapsible) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
            <button
              onClick={() => setIsDocumentsOpen(!isDocumentsOpen)}
              className="flex items-center gap-2 text-left cursor-pointer group flex-1 py-0.5"
            >
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                {isDocumentsOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>
              <h3 className="font-sans text-[11px] font-semibold text-muted-foreground group-hover:text-foreground tracking-wider uppercase transition-colors flex items-center gap-1.5">
                <span>Indexed Documents</span>
                {sources && sources.length > 0 && (
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-secondary text-muted-foreground font-semibold">
                    {sources.length}
                  </span>
                )}
              </h3>
            </button>
          </div>

          {isDocumentsOpen && (
            <div className="space-y-3">
              {/* Upload Dropzone */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.md,.txt,.png,.jpg,.jpeg"
              />

              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => {
                  if (!isUploading) fileInputRef.current?.click();
                }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label="Upload research documents"
                className={`w-full py-3 px-3.5 rounded-xl border border-dashed transition-all cursor-pointer select-none flex flex-col items-center justify-center text-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-accent/50 ${
                  isDragging
                    ? 'border-accent bg-accent/10 text-accent scale-[1.01]'
                    : isUploading
                    ? 'border-border bg-background/30 text-muted-foreground opacity-60 cursor-not-allowed'
                    : 'border-border hover:border-accent/60 bg-background/50 hover:bg-secondary/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                ) : (
                  <Upload
                    className={`w-4 h-4 transition-transform ${
                      isDragging ? 'text-accent scale-110' : 'text-muted-foreground'
                    }`}
                  />
                )}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs font-medium">
                    {isUploading
                      ? 'Ingesting documents...'
                      : isDragging
                      ? 'Drop files to upload'
                      : 'Upload research document'}
                  </span>
                  <span className="text-[10px] text-muted-foreground/80">
                    {isDragging ? 'Release to upload' : 'Drag & drop or click to browse'}
                  </span>
                </div>
              </div>

              {/* Documents List */}
              <div className="space-y-2.5">
                {isLoading ? (
                  <div className="flex justify-center p-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !sources || sources.length === 0 ? (
                  <div className="text-center py-6 px-3 text-xs text-muted-foreground font-sans">
                    No sources uploaded yet. Add a document to ground your synthesis.
                  </div>
                ) : (
                  sources.map((source) => {
                    const telemetry =
                      source.latest_version_id && ingestionStatuses[source.latest_version_id];
                    const currentStatus: IngestionStatus =
                      telemetry?.status || source.status || 'UPLOADED';
                    const progress =
                      telemetry?.processing_progress ?? source.processing_progress ?? 0;
                    const isReady = currentStatus === 'READY';
                    const isFailed = currentStatus === 'FAILED';

                    return (
                      <div
                        key={source.id}
                        className="p-3.5 rounded-xl bg-card border border-border space-y-2 shadow-2xs hover:border-border/80 transition-all font-sans"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span
                              className="text-xs font-medium text-foreground truncate"
                              title={source.filename}
                            >
                              {source.filename}
                            </span>
                          </div>

                          <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                            v{source.version_number || '1.0'}
                          </span>
                        </div>

                        {!isReady && !isFailed && (
                          <div className="space-y-1">
                            <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                              <span>{currentStatus.replace('_', ' ')}</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-secondary h-1 rounded-full overflow-hidden">
                              <div
                                className="bg-accent h-1 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {isReady && (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              INDEXED & ISOLATED
                            </span>
                          </div>
                        )}

                        {isFailed && (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                            <span className="font-mono text-[10px] text-destructive font-medium">
                              INGESTION FAILED
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};
