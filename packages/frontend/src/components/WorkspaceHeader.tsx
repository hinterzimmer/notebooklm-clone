import React from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

interface Props {
  notebookTitle?: string;
  conversationTitle?: string;
  sourceCount: number;
  isDrawerOpen: boolean;
  onToggleDrawer: () => void;
}

export const WorkspaceHeader: React.FC<Props> = ({
  notebookTitle,
  conversationTitle,
  sourceCount,
  isDrawerOpen,
  onToggleDrawer,
}) => {
  return (
    <header className="h-13 px-5 border-b border-border flex items-center justify-between shrink-0 bg-card select-none">
      {/* Left (Context Breadcrumb) */}
      <div className="flex items-center gap-2 truncate">
        <span className="text-xs text-muted-foreground truncate font-sans">
          {notebookTitle || 'Workspace'}
        </span>
        <span className="text-xs text-muted-foreground/60">/</span>
        <span className="text-xs font-medium text-foreground truncate font-sans">
          {conversationTitle || 'Synthesis'}
        </span>
      </div>

      {/* Right (Source Status & Drawer Toggle Pill) */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleDrawer}
          className="px-2.5 py-1 rounded-full bg-secondary/70 hover:bg-secondary border border-border flex items-center gap-2 text-xs transition-colors cursor-pointer group shadow-2xs"
          title={isDrawerOpen ? 'Close Source Inspector' : 'Open Source Inspector'}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] shrink-0" />
          <span className="text-[11px] font-medium text-foreground">
            {sourceCount === 1 ? '1 Source Indexed' : `${sourceCount} Sources Indexed`}
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-background text-accent font-medium">
            v1.0
          </span>
          <span className="text-muted-foreground group-hover:text-foreground transition-colors ml-0.5">
            {isDrawerOpen ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5" />
            )}
          </span>
        </button>
      </div>
    </header>
  );
};
