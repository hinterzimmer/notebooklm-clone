import React, { useState } from 'react';
import { CitationAnchor } from '@notebooklm/shared';
import { FileText, Image as ImageIcon, X } from 'lucide-react';

interface Props {
  anchor: CitationAnchor;
  index: number;
}

export const CitationAnchorChip: React.FC<Props> = ({ anchor, index }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 my-1 mr-1.5 text-xs font-medium rounded-full bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors shadow-2xs font-mono cursor-pointer"
        title={`View Source Citation (Page ${anchor.page_number || 'N/A'})`}
      >
        {anchor.image_url ? (
          <ImageIcon className="w-3.5 h-3.5 text-accent" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-accent" />
        )}
        <span>Source [{index + 1}]</span>
        {anchor.page_number && <span className="opacity-70">p.{anchor.page_number}</span>}
      </button>

      {/* Citation Inspector Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-popover border border-border rounded-2xl shadow-2xl max-w-lg w-full p-6 relative text-foreground">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-secondary border border-border rounded-lg text-accent">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-sans text-base font-semibold text-foreground">Citation Details</h3>
                <p className="text-xs text-muted-foreground font-mono">Anchor: {anchor.anchor_id}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-foreground/90">
              <div className="grid grid-cols-2 gap-2 bg-secondary/40 p-3 rounded-xl border border-border">
                <div>
                  <span className="text-xs text-muted-foreground block">Page Number</span>
                  <span className="font-medium text-foreground">
                    {anchor.page_number || '1'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Markdown Lines</span>
                  <span className="font-medium text-foreground font-mono">
                    {anchor.markdown_line_start || 1} - {anchor.markdown_line_end || 1}
                  </span>
                </div>
              </div>

              {anchor.bounding_box && (
                <div className="bg-secondary/40 p-3 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground block mb-1">Bounding Box Coordinates</span>
                  <div className="relative w-full h-28 bg-card rounded-lg border border-dashed border-border overflow-hidden">
                    <div
                      className="absolute bg-accent/20 border-2 border-accent rounded"
                      style={{
                        top: `${anchor.bounding_box.top * 100}%`,
                        left: `${anchor.bounding_box.left * 100}%`,
                        width: `${anchor.bounding_box.width * 100}%`,
                        height: `${anchor.bounding_box.height * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {anchor.image_url && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Extracted Figure</span>
                  <img
                    src={anchor.image_url}
                    alt={anchor.caption || 'Extracted document diagram'}
                    className="rounded-xl border border-border max-h-48 object-contain w-full bg-card"
                  />
                  {anchor.caption && (
                    <p className="text-xs text-muted-foreground mt-1 font-sans">{anchor.caption}</p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
