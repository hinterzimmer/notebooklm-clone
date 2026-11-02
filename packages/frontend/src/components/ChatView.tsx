import React, { useState, useMemo, useEffect, useContext, createContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  RootState,
  workspaceSlice,
  API_BASE,
  apiSlice,
  useGetMessagesQuery,
  useCreateThreadMutation,
} from '../app/store.js';
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  ActionBarPrimitive,
  useAui,
  useAuiState,
  ChainOfThoughtPrimitive,
} from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import {
  Send,
  Sparkles,
  ChevronDown,
  Copy,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { CitationAnchor } from '@notebooklm/shared';
import {
  SourceItem,
  InlineCitationHover,
} from './assistant-ui/sources.js';

interface Props {
  notebookId: string;
  threadId: string | null;
  onSelectCitation?: (citation: any) => void;
  onCitationsChange?: (citations: SourceItem[]) => void;
  onStreamingChange?: (isStreaming: boolean) => void;
}

interface StreamingTurn {
  role: 'assistant';
  content: string;
  reasoning: string;
  citations: (CitationAnchor & { index?: number; filename?: string; snippet?: string })[];
}

interface ChatContextType {
  onSelectCitation?: (citation: any) => void;
  messages: any[];
}

const ChatContext = createContext<ChatContextType>({ messages: [] });

const preprocessMarkdown = (text: string) => {
  let clean = text.replace(/\[anchor:[0-9a-fA-F-]+\]/g, '');
  clean = clean.replace(/\[(\d+)(?:\s*,\s*(\d+))+\]/g, (match) => {
    const nums = match.slice(1, -1).split(',');
    return nums.map((n) => `[${n.trim()}]`).join(' ');
  });
  clean = clean.replace(/\[(\d+)\](?!\()/g, '[[#$1]](#source-card-$1)');
  return clean;
};

// Collapsible Assistant-UI Thinking Component
const AssistantChainOfThought: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const aui = useAui();

  const toggleCollapsed = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        aui.chainOfThought.setCollapsed(next);
      } catch {}
      return next;
    });
  };

  return (
    <ChainOfThoughtPrimitive.Root className="mb-4">
      <ChainOfThoughtPrimitive.AccordionTrigger
        onClick={toggleCollapsed}
        aria-expanded={!isCollapsed}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium transition-colors cursor-pointer select-none group"
      >
        <Sparkles className="w-3.5 h-3.5 text-accent" />
        <span>Thought Process</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
        />
      </ChainOfThoughtPrimitive.AccordionTrigger>
      {!isCollapsed && (
        <ChainOfThoughtPrimitive.Parts>
          {({ part }) => (
            <div className="mt-2 rounded-xl border border-border/60 bg-secondary/30 p-3 text-xs select-text animate-in fade-in-50 duration-150">
              <p className="font-mono text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed select-text">
                {part.type === 'reasoning' ? (part as any).text : ''}
              </p>
            </div>
          )}
        </ChainOfThoughtPrimitive.Parts>
      )}
    </ChainOfThoughtPrimitive.Root>
  );
};

// Assistant Markdown Prose Renderer (smooth={false} prevents state change animations)
const AssistantMarkdownText: React.FC = () => {
  const { onSelectCitation, messages } = useContext(ChatContext);
  const messageId = useAuiState((s) => s.message.id);
  const msg = useMemo(() => messages.find((m) => m.id === messageId), [messages, messageId]);

  const sources: SourceItem[] = useMemo(() => {
    return (msg?.citations || []).map((c: any, i: number) => ({
      id: c.anchor_id,
      title: c.filename || `Source [${c.index || i + 1}]`,
      filename: c.filename,
      snippet: c.snippet,
      url: c.image_url,
      index: c.index || i + 1,
      page: c.page_number || 1,
      lineStart: c.markdown_line_start,
      lineEnd: c.markdown_line_end,
    }));
  }, [msg?.citations]);

  const markdownComponents = useMemo(
    () => ({
      h1: ({ children, ...props }: any) => (
        <h1
          className="font-sans text-xl font-semibold text-foreground tracking-tight my-3"
          {...props}
        >
          {children}
        </h1>
      ),
      h2: ({ children, ...props }: any) => (
        <h2
          className="font-sans text-lg font-semibold text-foreground tracking-tight my-2.5"
          {...props}
        >
          {children}
        </h2>
      ),
      h3: ({ children, ...props }: any) => (
        <h3
          className="font-sans text-base font-semibold text-foreground tracking-tight my-2"
          {...props}
        >
          {children}
        </h3>
      ),
      p: ({ children, ...props }: any) => (
        <p
          className="leading-relaxed my-2 text-foreground/90 font-sans text-sm"
          {...props}
        >
          {children}
        </p>
      ),
      a: ({ href, children, ...props }: any) => {
        if (href?.startsWith('#source-card-')) {
          const idx = parseInt(href.replace('#source-card-', ''), 10);
          const source = sources.find((s) => s.index === idx);
          return (
            <InlineCitationHover
              index={idx}
              source={source}
              onSelectCitation={onSelectCitation}
            />
          );
        }
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline hover:opacity-80 transition-opacity"
            {...props}
          >
            {children}
          </a>
        );
      },
    }),
    [sources, onSelectCitation],
  );

  return (
    <MarkdownTextPrimitive
      smooth={false}
      preprocess={preprocessMarkdown}
      components={markdownComponents}
    />
  );
};

const messagePartsComponents = {
  ChainOfThought: AssistantChainOfThought,
  Text: AssistantMarkdownText,
  Source: () => null,
};

const AssistantMessageRow: React.FC = () => {
  return (
    <MessagePrimitive.Root className="max-w-3xl mx-auto my-6 px-1 group select-text">
      {/* Unboxed Assistant Prose & Collapsible Thought Process */}
      <div className="text-foreground/90 text-sm leading-relaxed space-y-3 font-sans select-text">
        <MessagePrimitive.Parts components={messagePartsComponents} />
      </div>

      {/* Subtle Action Bar */}
      <div className="flex items-center justify-start pt-3">
        <ActionBarPrimitive.Root className="flex items-center gap-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionBarPrimitive.Copy
            className="p-1 rounded-md hover:bg-secondary hover:text-foreground transition-colors cursor-pointer text-xs flex items-center gap-1"
            title="Copy response"
          >
            <Copy className="w-3.5 h-3.5" />
          </ActionBarPrimitive.Copy>
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
};

const UserMessageRow: React.FC = () => {
  return (
    <MessagePrimitive.Root className="flex max-w-3xl mx-auto justify-end my-4 select-text">
      <div className="max-w-lg rounded-2xl rounded-tr-sm bg-secondary border border-border px-4 py-3 text-xs sm:text-sm text-foreground leading-relaxed shadow-2xs font-sans select-text">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
};

const threadMessageComponents = {
  UserMessage: UserMessageRow,
  AssistantMessage: AssistantMessageRow,
};

// Helper to extract citation indices explicitly referenced in text (e.g. [1], [1, 2], #source-card-1)
function extractCitedIndices(text?: string): Set<number> {
  const cited = new Set<number>();
  if (!text) return cited;
  const bracketRegex = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  let m;
  while ((m = bracketRegex.exec(text)) !== null) {
    const parts = m[1].split(',');
    for (const p of parts) {
      const num = parseInt(p.trim(), 10);
      if (!isNaN(num)) cited.add(num);
    }
  }
  const cardRegex = /#source-card-(\d+)/g;
  while ((m = cardRegex.exec(text)) !== null) {
    const num = parseInt(m[1], 10);
    if (!isNaN(num)) cited.add(num);
  }
  return cited;
}

export const ChatView: React.FC<Props> = ({
  notebookId,
  threadId,
  onSelectCitation,
  onCitationsChange,
  onStreamingChange,
}) => {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.auth.token);
  const [createThread] = useCreateThreadMutation();

  const { data: initialMessages, refetch } = useGetMessagesQuery(
    { threadId: threadId || '' },
    { skip: !threadId },
  );

  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStream, setCurrentStream] = useState<StreamingTurn | null>(null);
  const [optimisticUserText, setOptimisticUserText] = useState<string | null>(null);

  const setStreamingState = (streaming: boolean) => {
    setIsStreaming(streaming);
    onStreamingChange?.(streaming);
  };

  // Combine persisted messages + optimistic user turn + currently streaming turn
  const combinedMessages = useMemo(() => {
    if (!threadId) {
      const list: any[] = [];
      if (optimisticUserText) {
        list.push({
          id: 'optimistic-user-turn',
          role: 'user' as const,
          content: optimisticUserText,
          citations: [],
          reasoning: '',
        });
      }
      if (currentStream) {
        list.push({
          id: 'streaming-turn',
          role: 'assistant' as const,
          content: currentStream.content,
          citations: currentStream.citations,
          reasoning: currentStream.reasoning,
        });
      }
      return list;
    }

    const list = (initialMessages || []).map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      citations: (m.citations as (CitationAnchor & { index?: number; filename?: string })[]) || [],
      reasoning: m.reasoning || '',
    }));

    if (optimisticUserText) {
      const existsInList = list.some(
        (m) => m.role === 'user' && m.content === optimisticUserText,
      );
      if (!existsInList) {
        list.push({
          id: 'optimistic-user-turn',
          role: 'user' as const,
          content: optimisticUserText,
          citations: [],
          reasoning: '',
        });
      }
    }

    if (currentStream) {
      list.push({
        id: 'streaming-turn',
        role: 'assistant' as const,
        content: currentStream.content,
        citations: currentStream.citations,
        reasoning: currentStream.reasoning,
      });
    }

    return list;
  }, [threadId, initialMessages, optimisticUserText, currentStream]);

  // Extract citations for the active assistant turn once the answer is completed
  const activeTurnCitations: SourceItem[] = useMemo(() => {
    // Only fill citations once the answer is completed
    if (isStreaming) {
      return [];
    }

    const list: SourceItem[] = [];
    const seen = new Set<string>();

    for (let i = combinedMessages.length - 1; i >= 0; i--) {
      const msg = combinedMessages[i];
      if (msg.id === 'streaming-turn') continue;

      if (msg.role === 'assistant' && msg.citations && msg.citations.length > 0) {
        const citedIndices = extractCitedIndices(msg.content);

        // If the message contains no bracket citations in text, do not display ungrounded citations
        if (citedIndices.size === 0) {
          break;
        }

        for (const c of msg.citations) {
          // Strictly only include passages whose index is explicitly cited in the response text
          if (c.index !== undefined && !citedIndices.has(c.index)) {
            continue;
          }

          const key = c.anchor_id || `${c.filename}-${c.index}`;
          if (!seen.has(key)) {
            seen.add(key);
            list.push({
              id: c.anchor_id,
              title: c.filename || `Source [${c.index || list.length + 1}]`,
              filename: c.filename,
              snippet: c.snippet,
              url: c.image_url,
              index: c.index || list.length + 1,
              page: c.page_number || 1,
              lineStart: c.markdown_line_start,
              lineEnd: c.markdown_line_end,
            });
          }
        }
        // Scope the inspector citations to the active assistant response
        break;
      }
    }
    return list;
  }, [combinedMessages, isStreaming]);

  const citationsKey = useMemo(() => {
    return activeTurnCitations.map((c) => `${c.id || c.index}:${c.filename}`).join('|');
  }, [activeTurnCitations]);

  useEffect(() => {
    if (onCitationsChange) {
      onCitationsChange(activeTurnCitations);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citationsKey]);

  const handleSendText = async (userText: string, targetThreadId?: string) => {
    const activeId = targetThreadId || threadId;
    if (!userText.trim() || isStreaming || !activeId) return;

    setStreamingState(true);
    setOptimisticUserText(userText);
    setCurrentStream({
      role: 'assistant',
      content: '',
      reasoning: '',
      citations: [],
    });

    const sseUrl = `${API_BASE}/threads/${activeId}/stream?message=${encodeURIComponent(
      userText,
    )}${token ? `&token=${token}` : ''}`;
    const eventSource = new EventSource(sseUrl);

    // Race condition throttled batching:
    // Update either when TIME_THRESHOLD_MS has elapsed OR LENGTH_THRESHOLD_CHARS has been reached
    const TIME_THRESHOLD_MS = 60;
    const LENGTH_THRESHOLD_CHARS = 40;

    let bufferDelta = '';
    let bufferReasoning = '';
    let bufferCitations: (CitationAnchor & { index?: number; filename?: string })[] = [];
    let lastFlushTime = Date.now();
    let timerHandle: any = null;

    const flushBuffer = () => {
      if (timerHandle !== null) {
        clearTimeout(timerHandle);
        timerHandle = null;
      }
      if (bufferDelta || bufferReasoning || bufferCitations.length > 0) {
        const deltaToAdd = bufferDelta;
        const reasoningToAdd = bufferReasoning;
        const citationsToAdd = bufferCitations;
        bufferDelta = '';
        bufferReasoning = '';
        bufferCitations = [];
        lastFlushTime = Date.now();

        setCurrentStream((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            content: prev.content + deltaToAdd,
            reasoning: prev.reasoning + reasoningToAdd,
            citations:
              citationsToAdd.length > 0
                ? [...prev.citations, ...citationsToAdd]
                : prev.citations,
          };
        });
      }
    };

    const scheduleFlush = () => {
      const now = Date.now();
      const timeElapsed = now - lastFlushTime;
      const lengthReached =
        bufferDelta.length >= LENGTH_THRESHOLD_CHARS ||
        bufferReasoning.length >= LENGTH_THRESHOLD_CHARS;

      // Race condition trigger: time or length threshold reached
      if (timeElapsed >= TIME_THRESHOLD_MS || lengthReached) {
        flushBuffer();
      } else if (timerHandle === null) {
        const remaining = Math.max(0, TIME_THRESHOLD_MS - timeElapsed);
        timerHandle = setTimeout(flushBuffer, remaining);
      }
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.title) {
          dispatch(apiSlice.util.invalidateTags(['Thread']));
        }
        if (data.done) {
          // Top both conditions: synchronously flush all remaining buffer
          flushBuffer();
          eventSource.close();
          setStreamingState(false);
          setCurrentStream(null);
          setOptimisticUserText(null);
          dispatch(apiSlice.util.invalidateTags(['Thread', 'Message']));
          refetch();
          return;
        }

        if (data.delta) bufferDelta += data.delta;
        if (data.reasoning) bufferReasoning += data.reasoning;
        if (data.citations) bufferCitations.push(...data.citations);

        scheduleFlush();
      } catch (err) {
        console.error('SSE chat turn parse error', err);
      }
    };

    eventSource.onerror = () => {
      flushBuffer();
      eventSource.close();
      setStreamingState(false);
      setCurrentStream(null);
      setOptimisticUserText(null);
      refetch();
    };
  };

  const runtime = useExternalStoreRuntime({
    messages: combinedMessages,
    isRunning: isStreaming,
    convertMessage: (msg: any) => {
      const parts: any[] = [];
      if (msg.reasoning) {
        parts.push({ type: 'reasoning' as const, text: msg.reasoning });
      }
      if (msg.content) {
        parts.push({ type: 'text' as const, text: msg.content });
      }
      const citations = (msg.citations as any[]) || [];
      const citedIndices = extractCitedIndices(msg.content);
      for (const c of citations) {
        if (citedIndices.size > 0 && c.index !== undefined && !citedIndices.has(c.index)) {
          continue;
        }
        parts.push({
          type: 'source' as const,
          sourceType: 'document' as const,
          id: c.anchor_id,
          title: c.filename
            ? `${c.filename} (p.${c.page_number || 1})`
            : `Source [${c.index || 1}]`,
          filename: c.filename,
          url: c.image_url,
          providerMetadata: {
            index: c.index,
            page: c.page_number,
            lineStart: c.markdown_line_start,
            lineEnd: c.markdown_line_end,
            snippet: c.snippet,
          },
        });
      }
      return {
        id: msg.id,
        role: msg.role,
        content: parts.length > 0 ? parts : [{ type: 'text' as const, text: ' ' }],
      };
    },
    onNew: async (message) => {
      const text = message.content
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('');

      let targetId = threadId;
      if (!targetId) {
        try {
          const words = text
            .replace(
              /^(what\s+is\s+the|what\s+is|what\s+are|how\s+to|how\s+do|can\s+you\s+explain|tell\s+me\s+about|explain)\s+/i,
              '',
            )
            .replace(/[^\w\s-]/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 6);
          const initialTitle =
            words.length > 0
              ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
              : 'New Research Conversation';

          const res = await createThread({
            notebookId,
            title: initialTitle,
          }).unwrap();
          dispatch(workspaceSlice.actions.setActiveThread(res.id));
          targetId = res.id;
        } catch (err) {
          console.error('Failed to auto-create thread', err);
          return;
        }
      }

      await handleSendText(text, targetId || undefined);
    },
  });

  const hasMessages = combinedMessages.length > 0;

  return (
    <ChatContext.Provider
      value={{
        onSelectCitation,
        messages: combinedMessages,
      }}
    >
      <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex-1 flex flex-col h-full bg-card min-w-0 overflow-hidden">
        {/* assistant-ui Thread Root */}
        <ThreadPrimitive.Root className="flex-1 flex flex-col overflow-hidden">
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 select-text">
            {/* Empty State vs Active Messages */}
            {!hasMessages ? (
              <div className="min-h-full flex flex-col items-center justify-center py-10 px-4 text-center max-w-2xl mx-auto">
                {/* Corpus Context Pill */}
                <div className="mb-4 px-3 py-1 rounded-full bg-secondary/60 border border-border font-mono text-[11px] text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                  <span>Strict Grounding • v1.0 • Isolated Corpus</span>
                </div>

                {/* Modern Sans Heading */}
                <h1 className="font-sans text-3xl sm:text-4xl font-semibold text-foreground text-center tracking-tight mb-2.5">
                  What would you like to synthesize?
                </h1>

                {/* Subtitle */}
                <p className="text-xs sm:text-sm text-muted-foreground text-center max-w-md mb-8 leading-relaxed font-sans">
                  Query across your isolated documents with fine-grained attribution and historical version isolation.
                </p>

                {/* Elevated Composer Directly in the Center */}
                <div className="w-full max-w-2xl rounded-2xl bg-popover border border-border shadow-lg dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-3.5 mb-7 focus-within:ring-1 focus-within:ring-ring transition-all text-left">
                  <ComposerPrimitive.Root className="space-y-3">
                    <ComposerPrimitive.Input
                      placeholder="Ask a question or request a synthesis across indexed documents..."
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed font-sans"
                      rows={2}
                    />
                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                      <span className="font-mono text-[10px] px-2 py-1 rounded-md bg-secondary text-muted-foreground">
                        Strict Citations • v1.0
                      </span>

                      <ComposerPrimitive.Send
                        className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-40"
                      >
                        <span>Synthesize</span>
                        <Send className="w-3.5 h-3.5" />
                      </ComposerPrimitive.Send>
                    </div>
                  </ComposerPrimitive.Root>
                </div>

                {/* Source-Aware Suggestion Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-2xl text-left">
                  <ThreadPrimitive.Suggestion
                    prompt="Synthesize the key findings, core methodology, and main takeaways across all uploaded sources."
                    send
                    className="group p-3.5 rounded-xl bg-popover/70 hover:bg-popover border border-border hover:border-muted-foreground/40 text-left flex flex-col justify-between transition-all shadow-2xs cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3 w-full">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary text-accent font-medium">
                        SYNTHESIS
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground mb-1 font-sans">
                        Executive Synthesis
                      </h4>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 font-sans">
                        Synthesize findings, core methodology, and primary conclusions.
                      </p>
                    </div>
                  </ThreadPrimitive.Suggestion>

                  <ThreadPrimitive.Suggestion
                    prompt="Compare and contrast the findings, perspectives, and metrics between the indexed documents."
                    send
                    className="group p-3.5 rounded-xl bg-popover/70 hover:bg-popover border border-border hover:border-muted-foreground/40 text-left flex flex-col justify-between transition-all shadow-2xs cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3 w-full">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary text-accent font-medium">
                        ANALYSIS
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground mb-1 font-sans">
                        Comparative Analysis
                      </h4>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 font-sans">
                        Contrast methodology, discrepancies, and unique arguments.
                      </p>
                    </div>
                  </ThreadPrimitive.Suggestion>

                  <ThreadPrimitive.Suggestion
                    prompt="Extract all critical data points, statistics, dates, and quantitative evidence with exact citations."
                    send
                    className="group p-3.5 rounded-xl bg-popover/70 hover:bg-popover border border-border hover:border-muted-foreground/40 text-left flex flex-col justify-between transition-all shadow-2xs cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3 w-full">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary text-accent font-medium">
                        EVIDENCE
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground mb-1 font-sans">
                        Data & Citations
                      </h4>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 font-sans">
                        Extract quantitative benchmarks, timestamps, and evidence.
                      </p>
                    </div>
                  </ThreadPrimitive.Suggestion>
                </div>
              </div>
            ) : (
              <ThreadPrimitive.Messages components={threadMessageComponents} />
            )}
          </ThreadPrimitive.Viewport>

          {/* Bottom Docked Composer (when messages exist) */}
          {hasMessages && (
            <div className="p-4 border-t border-border bg-card/90 backdrop-blur shrink-0">
              <div className="max-w-3xl mx-auto">
                <ComposerPrimitive.Root className="flex items-center bg-popover border border-border rounded-2xl shadow-sm focus-within:ring-1 focus-within:ring-ring p-1.5 pl-4 transition-all">
                  <ComposerPrimitive.Input
                    placeholder="Ask a follow-up or refine research query..."
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none py-1.5 font-sans"
                    rows={1}
                  />
                  <ComposerPrimitive.Send
                    className="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer disabled:opacity-30 shrink-0 ml-2"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </ComposerPrimitive.Send>
                </ComposerPrimitive.Root>
              </div>
            </div>
          )}
        </ThreadPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  </ChatContext.Provider>
  );
};
