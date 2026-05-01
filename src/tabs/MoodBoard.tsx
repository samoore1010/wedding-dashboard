import { useRef, useState, useEffect, type DragEvent } from 'react';
import { Trash2, ImagePlus, Upload, X, Image as ImageIcon } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { EditableText } from '../components/ui/EditableText';
import { EmptyState } from '../components/ui/EmptyState';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import { uploadImage, deleteImage } from '../images';
import { cn } from '../utils';
import toast from 'react-hot-toast';
import type { MoodBoardItem } from '../types';

export function MoodBoard() {
  const { moodBoard, addMoodImage, updateMoodImage, removeMoodImage } = useShallowStore((s) => ({
    moodBoard: s.moodBoard ?? [],
    addMoodImage: s.addMoodImage,
    updateMoodImage: s.updateMoodImage,
    removeMoodImage: s.removeMoodImage,
  }));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState<MoodBoardItem | null>(null);
  const [filter, setFilter] = useState<string>('All');

  const sections = Array.from(
    new Set(moodBoard.map((m) => m.section).filter((s): s is string => !!s))
  ).sort();

  const filtered = filter === 'All' ? moodBoard : moodBoard.filter((m) => m.section === filter);

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    setUploading(true);
    let successes = 0;
    for (const file of arr) {
      try {
        const { src } = await uploadImage(file);
        addMoodImage({ src, caption: '', section: filter !== 'All' ? filter : undefined });
        successes++;
      } catch (e: any) {
        toast.error(e?.message ?? 'Upload failed');
      }
    }
    setUploading(false);
    if (successes > 0) {
      toast.success(`${successes} image${successes > 1 ? 's' : ''} added`);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  // ESC closes lightbox
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox]);

  return (
    <div className="space-y-5">
      <Card
        title="Mood Board"
        action={
          <Button
            icon={<ImagePlus size={14} />}
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Add Images'}
          </Button>
        }
      >
        <p className="text-sm text-muted">
          Collect inspiration — venue vibes, color palettes, dress styles, florals.
          Drop images anywhere on this page or click <span className="font-semibold">Add Images</span>.
          Tip: tag images with a section (e.g. "Florals") to group them.
        </p>

        {sections.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            <FilterChip active={filter === 'All'} onClick={() => setFilter('All')}>
              All ({moodBoard.length})
            </FilterChip>
            {sections.map((s) => (
              <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
                {s} ({moodBoard.filter((m) => m.section === s).length})
              </FilterChip>
            ))}
          </div>
        )}
      </Card>

      <div
        className={cn(
          'relative rounded-xl2 transition-all',
          dragOver && 'ring-2 ring-accent ring-offset-4 ring-offset-bg'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ImageIcon size={22} />}
              title={moodBoard.length === 0 ? 'No images yet' : `Nothing tagged "${filter}"`}
              description={
                moodBoard.length === 0
                  ? 'Drag images here, or click Add Images. JPEG, PNG, GIF, or WebP up to 10 MB.'
                  : 'Try a different filter or add images to this section.'
              }
              action={
                <Button icon={<Upload size={14} />} onClick={() => fileInputRef.current?.click()}>
                  Add Images
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((item) => (
              <MoodCard
                key={item.id}
                item={item}
                onUpdate={(p) => updateMoodImage(item.id, p)}
                onOpen={() => setLightbox(item)}
                onDelete={async () => {
                  if (
                    await confirmAction({
                      title: 'Remove image?',
                      message: 'This image will be removed from your mood board and the file will be deleted from the server.',
                      confirmLabel: 'Remove',
                      variant: 'danger',
                    })
                  ) {
                    await deleteImage(item.src);
                    removeMoodImage(item.id);
                  }
                }}
              />
            ))}
          </div>
        )}

        {dragOver && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-accent/10 rounded-xl2 backdrop-blur-sm">
            <div className="bg-surface rounded-full px-4 py-2 shadow-lift text-sm font-semibold text-accent">
              Drop to upload
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {lightbox && (
        <Lightbox
          item={lightbox}
          onClose={() => setLightbox(null)}
          onUpdate={(p) => {
            updateMoodImage(lightbox.id, p);
            setLightbox({ ...lightbox, ...p });
          }}
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-full text-xs font-semibold transition-colors border',
        active
          ? 'bg-primary text-white border-primary'
          : 'bg-bg border-border text-muted hover:text-ink'
      )}
    >
      {children}
    </button>
  );
}

function MoodCard({
  item,
  onUpdate,
  onOpen,
  onDelete,
}: {
  item: MoodBoardItem;
  onUpdate: (p: Partial<MoodBoardItem>) => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative bg-surface border border-border rounded-xl2 overflow-hidden shadow-soft hover:shadow-lift transition-shadow">
      <button
        type="button"
        className="block w-full aspect-square overflow-hidden bg-bg"
        onClick={onOpen}
        aria-label="Enlarge image"
      >
        <img
          src={item.src}
          alt={item.caption || ''}
          loading="lazy"
          className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]"
        />
      </button>
      <div className="p-2.5 space-y-1">
        <EditableText
          value={item.caption ?? ''}
          onChange={(v) => onUpdate({ caption: v })}
          placeholder="Add a caption…"
          className="text-xs"
          blank=""
        />
        <EditableText
          value={item.section ?? ''}
          onChange={(v) => onUpdate({ section: v.trim() || undefined })}
          placeholder="Tag (e.g. Florals)"
          className="text-[11px] text-muted"
          blank=""
        />
      </div>
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-ink/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-danger transition-all"
        aria-label="Remove image"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function Lightbox({
  item,
  onClose,
  onUpdate,
}: {
  item: MoodBoardItem;
  onClose: () => void;
  onUpdate: (p: Partial<MoodBoardItem>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full bg-surface rounded-xl2 overflow-hidden shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={item.src}
          alt={item.caption || ''}
          className="w-full max-h-[75vh] object-contain bg-ink"
        />
        <div className="p-4 space-y-2 border-t border-border">
          <Input
            value={item.caption ?? ''}
            onChange={(e) => onUpdate({ caption: e.target.value })}
            placeholder="Caption"
          />
          <Input
            value={item.section ?? ''}
            onChange={(e) => onUpdate({ section: e.target.value.trim() || undefined })}
            placeholder='Section tag (e.g. "Florals")'
          />
        </div>
        <IconButton
          tone="default"
          onClick={onClose}
          className="absolute top-3 right-3 h-9 w-9 bg-surface/80 hover:bg-surface"
          aria-label="Close"
        >
          <X size={18} />
        </IconButton>
      </div>
    </div>
  );
}
