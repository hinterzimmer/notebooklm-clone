import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  RootState,
  useGetNotebooksQuery,
  useGetThreadsQuery,
  useGetSourcesQuery,
} from './app/store.js';
import { Sidebar } from './components/Sidebar.js';
import { WorkspaceHeader } from './components/WorkspaceHeader.js';
import { ChatView } from './components/ChatView.js';
import { SourceInspector } from './components/SourceInspector.js';
import { SourceItem } from './components/assistant-ui/sources.js';
import { LoginView } from './components/LoginView.js';
import { BookOpen } from 'lucide-react';

export const App: React.FC = () => {
  const token = useSelector((state: RootState) => state.auth.token);
  const activeNotebookId = useSelector(
    (state: RootState) => state.workspace.activeNotebookId,
  );
  const activeThreadId = useSelector(
    (state: RootState) => state.workspace.activeThreadId,
  );

  const { data: notebooks } = useGetNotebooksQuery(undefined, {
    skip: !token,
  });
  const { data: threads } = useGetThreadsQuery(activeNotebookId || '', {
    skip: !token || !activeNotebookId,
  });
  const { data: sources } = useGetSourcesQuery(activeNotebookId || '', {
    skip: !token || !activeNotebookId,
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [activeCitation, setActiveCitation] = useState<any | null>(null);
  const [citedSources, setCitedSources] = useState<SourceItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  if (!token) {
    return <LoginView />;
  }

  const activeNotebook = notebooks?.find((n) => n.id === activeNotebookId);
  const activeThread = threads?.find((t) => t.id === activeThreadId);

  const handleSelectCitation = (citation: any) => {
    setActiveCitation(citation);
    setIsDrawerOpen(true);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground p-2 gap-1.5 font-sans">
      {/* Recessed Left Navigation Rail */}
      <Sidebar />

      {/* Inset Workspace Container */}
      <main className="flex-1 flex flex-col bg-card rounded-2xl border border-border shadow-sm dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden min-w-0">
        {activeNotebookId ? (
          <>
            {/* Top Workspace Header */}
            <WorkspaceHeader
              notebookTitle={activeNotebook?.title}
              conversationTitle={activeThread?.title}
              sourceCount={sources?.length || 0}
              isDrawerOpen={isDrawerOpen}
              onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
            />

            {/* Inset Canvas Body: Center Thread Area + Right Source Inspector */}
            <div className="flex-1 flex h-full overflow-hidden min-h-0 w-full">
              <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
                <ChatView
                  notebookId={activeNotebookId}
                  threadId={activeThreadId}
                  onSelectCitation={handleSelectCitation}
                  onCitationsChange={setCitedSources}
                  onStreamingChange={setIsStreaming}
                />
              </div>

              {isDrawerOpen && (
                <SourceInspector
                  notebookId={activeNotebookId}
                  activeCitation={activeCitation}
                  onClearActiveCitation={() => setActiveCitation(null)}
                  citedSources={citedSources}
                  onSelectCitation={handleSelectCitation}
                  onClose={() => setIsDrawerOpen(false)}
                  isStreaming={isStreaming}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-card">
            <div className="w-12 h-12 rounded-2xl bg-secondary border border-border flex items-center justify-center text-accent mb-4 shadow-2xs">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="font-sans text-2xl sm:text-3xl font-semibold text-foreground mb-2 tracking-tight">
              Research Workspace
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm leading-relaxed font-sans">
              Select or create a notebook from the navigation rail to begin analyzing and synthesizing documents with strict attribution.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
