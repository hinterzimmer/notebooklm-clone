import React, { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  RootState,
  workspaceSlice,
  authSlice,
  useGetNotebooksQuery,
  useCreateNotebookMutation,
  useUpdateNotebookMutation,
  useDeleteNotebookMutation,
  useGetThreadsQuery,
  useCreateThreadMutation,
  useUpdateThreadMutation,
  useDeleteThreadMutation,
} from '../app/store.js';
import { useTheme } from '../theme/ThemeProvider.js';
import {
  BookOpen,
  Plus,
  MessageSquare,
  Sun,
  Moon,
  Laptop,
  MoreHorizontal,
  Edit2,
  Trash2,
  FolderInput,
  User,
  LogOut,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const dispatch = useDispatch();
  const { theme, setTheme } = useTheme();

  const activeNotebookId = useSelector(
    (state: RootState) => state.workspace.activeNotebookId,
  );
  const activeThreadId = useSelector(
    (state: RootState) => state.workspace.activeThreadId,
  );
  const authUser = useSelector((state: RootState) => state.auth);

  const { data: notebooks } = useGetNotebooksQuery(undefined, {
    skip: !authUser.token,
  });
  const [createNotebook, { isLoading: isCreatingNotebook }] = useCreateNotebookMutation();
  const [updateNotebook] = useUpdateNotebookMutation();
  const [deleteNotebook] = useDeleteNotebookMutation();

  const { data: threads } = useGetThreadsQuery(activeNotebookId || '', {
    skip: !activeNotebookId,
  });
  const [createThread] = useCreateThreadMutation();
  const [updateThread] = useUpdateThreadMutation();
  const [deleteThread] = useDeleteThreadMutation();

  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Submenu state
  const [openMenu, setOpenMenu] = useState<{
    type: 'notebook' | 'thread';
    id: string;
    title: string;
    top: number;
    right: number;
  } | null>(null);

  // Rename modal state
  const [renamingItem, setRenamingItem] = useState<{
    type: 'notebook' | 'thread';
    id: string;
    title: string;
  } | null>(null);

  // Move thread modal state
  const [movingThread, setMovingThread] = useState<{
    id: string;
    title: string;
    currentNotebookId: string;
  } | null>(null);
  const [selectedTargetNotebook, setSelectedTargetNotebook] = useState<string>('');

  const menuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click or scroll
  useEffect(() => {
    if (!openMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };

    const handleScroll = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [openMenu]);

  const toggleMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    type: 'notebook' | 'thread',
    id: string,
    title: string,
  ) => {
    e.stopPropagation();
    if (openMenu?.type === type && openMenu.id === id) {
      setOpenMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const estimatedHeight = type === 'notebook' ? 80 : 120;
    const showAbove = rect.bottom + estimatedHeight > window.innerHeight;
    setOpenMenu({
      type,
      id,
      title,
      top: showAbove ? Math.max(8, rect.top - estimatedHeight) : rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  };

  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotebookTitle.trim()) return;

    try {
      const res = await createNotebook({
        title: newNotebookTitle.trim(),
        strategy: 'hybrid_rag',
      }).unwrap();
      dispatch(workspaceSlice.actions.setActiveNotebook(res.id));
      setIsDialogOpen(false);
      setNewNotebookTitle('');
    } catch (err) {
      console.error('Failed to create notebook', err);
    }
  };

  const handleCreateThread = async () => {
    if (!activeNotebookId) return;
    try {
      const res = await createThread({ notebookId: activeNotebookId }).unwrap();
      dispatch(workspaceSlice.actions.setActiveThread(res.id));
    } catch (err) {
      console.error('Failed to create thread', err);
    }
  };

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingItem || !renamingItem.title.trim()) return;

    try {
      if (renamingItem.type === 'notebook') {
        await updateNotebook({
          id: renamingItem.id,
          title: renamingItem.title.trim(),
        }).unwrap();
      } else {
        await updateThread({
          id: renamingItem.id,
          title: renamingItem.title.trim(),
        }).unwrap();
      }
      setRenamingItem(null);
    } catch (err) {
      console.error('Failed to rename item', err);
    }
  };

  const handleDeleteNotebook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenu(null);
    if (!window.confirm('Are you sure you want to delete this notebook?')) return;

    try {
      await deleteNotebook(id).unwrap();
      if (activeNotebookId === id) {
        dispatch(workspaceSlice.actions.setActiveNotebook(null));
      }
    } catch (err) {
      console.error('Failed to delete notebook', err);
    }
  };

  const handleDeleteThread = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenu(null);
    if (!window.confirm('Are you sure you want to delete this conversation?')) return;

    try {
      await deleteThread(id).unwrap();
      if (activeThreadId === id) {
        dispatch(workspaceSlice.actions.setActiveThread(null));
      }
    } catch (err) {
      console.error('Failed to delete thread', err);
    }
  };

  const handleMoveThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingThread || !selectedTargetNotebook) return;

    try {
      await updateThread({
        id: movingThread.id,
        notebookId: selectedTargetNotebook,
      }).unwrap();
      setMovingThread(null);
      setSelectedTargetNotebook('');
    } catch (err) {
      console.error('Failed to move thread', err);
    }
  };

  return (
    <nav className="w-60 shrink-0 flex flex-col justify-between px-2 py-2.5 bg-background select-none h-full border-0">
      <div className="flex flex-col min-h-0 flex-1">
        {/* Brand Header */}
        <div className="px-2.5 py-2 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0 shadow-2xs">
              <BookOpen className="w-3.5 h-3.5 text-accent" />
            </div>
            <span className="font-sans text-sm font-semibold tracking-tight text-foreground">
              NotebookLM
            </span>
          </div>
        </div>

        {/* Notebook Section */}
        <div className="mb-4">
          <div className="text-[11px] font-medium text-muted-foreground px-2.5 mb-1.5 flex items-center justify-between">
            <span className="tracking-wide">Notebooks</span>
            <button
              onClick={() => setIsDialogOpen(true)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
              title="Create Notebook"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
            {notebooks?.map((nb) => {
              const isActive = activeNotebookId === nb.id;
              const isMenuOpen = openMenu?.type === 'notebook' && openMenu.id === nb.id;

              return (
                <div
                  key={nb.id}
                  onClick={() => dispatch(workspaceSlice.actions.setActiveNotebook(nb.id))}
                  className={`group relative w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                    isActive
                      ? 'bg-popover text-foreground font-medium border border-border shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1 mr-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                        isActive ? 'bg-accent shadow-[0_0_6px_rgba(208,114,17,0.4)]' : 'bg-muted-foreground/30'
                      }`}
                    />
                    <span className="truncate">{nb.title}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-[10px] text-muted-foreground/70">
                      v1.0
                    </span>

                    {/* 3-dots Menu Button */}
                    <button
                      onClick={(e) => toggleMenu(e, 'notebook', nb.id, nb.title)}
                      className={`p-0.5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-secondary/80 transition-opacity cursor-pointer ${
                        isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      title="Notebook options"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Conversations Section */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="text-[11px] font-medium text-muted-foreground px-2.5 mb-1.5 flex items-center justify-between">
            <span className="tracking-wide">Conversations</span>
            <button
              onClick={handleCreateThread}
              disabled={!activeNotebookId}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-30 transition-colors cursor-pointer"
              title="New Conversation"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 overflow-y-auto flex-1 pr-0.5">
            {threads?.map((th) => {
              const isActive = activeThreadId === th.id;
              const isMenuOpen = openMenu?.type === 'thread' && openMenu.id === th.id;

              return (
                <div
                  key={th.id}
                  onClick={() => dispatch(workspaceSlice.actions.setActiveThread(th.id))}
                  className={`group relative w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                    isActive
                      ? 'bg-secondary/80 text-foreground font-medium border border-border/60 shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1 mr-1">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{th.title}</span>
                  </div>

                  {/* 3-dots Menu Button */}
                  <button
                    onClick={(e) => toggleMenu(e, 'thread', th.id, th.title)}
                    className={`p-0.5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-secondary/80 transition-opacity cursor-pointer ${
                      isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    title="Conversation options"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / Account & Theme Switcher */}
      <div className="pt-2.5 border-t border-border/60 px-2 flex flex-col gap-2 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0 pr-1">
            <div className="w-5 h-5 rounded-md bg-secondary border border-border flex items-center justify-center shrink-0 text-accent">
              <User className="w-3 h-3" />
            </div>
            <span
              className="text-[11px] font-medium text-foreground truncate max-w-[100px]"
              title={authUser.email || authUser.userId || 'User'}
            >
              {authUser.email || 'Developer'}
            </span>
          </div>

          <button
            onClick={() => dispatch(authSlice.actions.clearAuth())}
            className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer shrink-0"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[11px] font-medium">Theme</span>
          <div className="flex items-center bg-secondary/80 border border-border/60 p-0.5 rounded-lg">
            <button
              onClick={() => setTheme('light')}
              className={`p-1 rounded-md transition-all cursor-pointer ${
                theme === 'light'
                  ? 'bg-popover text-accent shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Light Mode (Archival Paper)"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-1 rounded-md transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-popover text-accent shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Dark Mode (Warm Obsidian)"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`p-1 rounded-md transition-all cursor-pointer ${
                theme === 'system'
                  ? 'bg-popover text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="System Sync"
            >
              <Laptop className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Submenu */}
      {openMenu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: openMenu.top,
            right: openMenu.right,
          }}
          className="z-50 min-w-36 bg-popover border border-border rounded-xl shadow-lg py-1 text-xs text-foreground"
        >
          {openMenu.type === 'notebook' ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const { id, title } = openMenu;
                  setOpenMenu(null);
                  setRenamingItem({
                    type: 'notebook',
                    id,
                    title,
                  });
                }}
                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-secondary/70 text-foreground cursor-pointer transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Rename</span>
              </button>
              <button
                onClick={(e) => handleDeleteNotebook(openMenu.id, e)}
                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-destructive/10 text-destructive cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const { id, title } = openMenu;
                  setOpenMenu(null);
                  setRenamingItem({
                    type: 'thread',
                    id,
                    title,
                  });
                }}
                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-secondary/70 text-foreground cursor-pointer transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Rename</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const { id, title } = openMenu;
                  setOpenMenu(null);
                  setMovingThread({
                    id,
                    title,
                    currentNotebookId: activeNotebookId || '',
                  });
                  const otherNb = notebooks?.find(
                    (n) => n.id !== activeNotebookId,
                  );
                  setSelectedTargetNotebook(otherNb ? otherNb.id : '');
                }}
                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-secondary/70 text-foreground cursor-pointer transition-colors"
              >
                <FolderInput className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Move...</span>
              </button>
              <button
                onClick={(e) => handleDeleteThread(openMenu.id, e)}
                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-destructive/10 text-destructive cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* New Notebook Modal */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm">
          <form
            onSubmit={handleCreateNotebook}
            className="bg-popover border border-border rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4 text-foreground"
          >
            <h3 className="font-sans text-base font-semibold tracking-tight text-foreground">
              Create New Notebook
            </h3>

            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Title</label>
              <input
                type="text"
                value={newNotebookTitle}
                onChange={(e) => setNewNotebookTitle(e.target.value)}
                placeholder="e.g. Q3 Earnings Analysis"
                className="w-full px-3 py-2 text-xs bg-secondary/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newNotebookTitle.trim() || isCreatingNotebook}
                className="px-3.5 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:opacity-90 rounded-xl disabled:opacity-50 transition-all cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {renamingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm">
          <form
            onSubmit={handleSaveRename}
            className="bg-popover border border-border rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4 text-foreground"
          >
            <h3 className="font-sans text-base font-semibold tracking-tight text-foreground">
              Rename {renamingItem.type === 'notebook' ? 'Notebook' : 'Conversation'}
            </h3>

            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">New Title</label>
              <input
                type="text"
                value={renamingItem.title}
                onChange={(e) =>
                  setRenamingItem({ ...renamingItem, title: e.target.value })
                }
                className="w-full px-3 py-2 text-xs bg-secondary/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenamingItem(null)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!renamingItem.title.trim()}
                className="px-3.5 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:opacity-90 rounded-xl disabled:opacity-50 transition-all cursor-pointer"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Move Thread to Notebook Modal */}
      {movingThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm">
          <form
            onSubmit={handleMoveThread}
            className="bg-popover border border-border rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4 text-foreground"
          >
            <h3 className="font-sans text-base font-semibold tracking-tight text-foreground">
              Move Conversation
            </h3>

            <p className="text-xs text-muted-foreground">
              Moving <span className="font-medium text-foreground">"{movingThread.title}"</span>. Select target notebook:
            </p>

            <div>
              <select
                value={selectedTargetNotebook}
                onChange={(e) => setSelectedTargetNotebook(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-secondary/40 border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="" disabled>Select a notebook...</option>
                {notebooks
                  ?.filter((n) => n.id !== movingThread.currentNotebookId)
                  .map((nb) => (
                    <option key={nb.id} value={nb.id}>
                      {nb.title}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMovingThread(null)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedTargetNotebook}
                className="px-3.5 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:opacity-90 rounded-xl disabled:opacity-50 transition-all cursor-pointer"
              >
                Move
              </button>
            </div>
          </form>
        </div>
      )}
    </nav>
  );
};
