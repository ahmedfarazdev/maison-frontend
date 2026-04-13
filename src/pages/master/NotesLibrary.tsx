// ============================================================
// Notes Library — Fragrance notes grid
// Each note: image + name + perfume count badge
// Click → shows perfumes using that note
// CRUD + CSV bulk import (matching Perfume Master pattern)
// ============================================================
import { useState, useRef, useMemo, useCallback } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared';
import { cn } from '@/lib/utils';
import {
  Plus, Search, X, Edit2, Trash2, Droplets, Download, FileSpreadsheet, Upload, Check, AlertTriangle, Loader2,
  ChevronDown, ChevronRight, ImageIcon,
} from 'lucide-react';
import GenericBulkImport, { ImportColumn } from '@/components/shared/GenericBulkImport';
import { useFileUpload } from '@/hooks/useFileUpload';

// ---- Types ----
interface Note {
  id: string;
  noteId: string;
  name: string;
  imageUrl: string | null;
  category: string | null;
  description: string | null;
  createdAt: string;
}

interface PerfumeRef {
  masterId: string;
  name: string;
  brand: string;
  notePosition: string; // top, heart, base
}

const NOTE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'category', label: 'Category', description: 'Citrus, Floral, Woody, etc.' },
  { key: 'image_url', label: 'Image URL' },
  { key: 'description', label: 'Description' },
];

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// ---- Note Image Upload Component ----
function NoteImageUpload({ currentUrl, onUpload }: { currentUrl?: string; onUpload: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useFileUpload({
    bucket: 'note-images',
    folder: 'notes',
    maxSizeMB: 2,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    onSuccess: (result) => {
      onUpload(result.url);
      toast.success('Note image uploaded');
    },
    onError: (err) => toast.error(err),
  });

  const handleClick = () => fileRef.current?.click();
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await upload(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="relative group">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      {currentUrl ? (
        <div className="w-[100px] h-[100px] rounded-xl overflow-hidden border border-border bg-muted/20 cursor-pointer" onClick={handleClick}>
          <img src={currentUrl} alt="Note" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
            {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Upload className="w-6 h-6 text-white" />}
          </div>
        </div>
      ) : (
        <button
          onClick={handleClick}
          disabled={uploading}
          className="w-[100px] h-[100px] rounded-xl border-2 border-dashed border-border hover:border-gold/50 bg-muted/10 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          ) : (
            <>
              <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
              <span className="text-[10px] uppercase text-muted-foreground/50 font-semibold text-center px-1">Upload Photo</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default function NotesLibrary() {
  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showPerfumesDialog, setShowPerfumesDialog] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [editForm, setEditForm] = useState({ name: '', imageUrl: '', description: '' });
  const [addForm, setAddForm] = useState({ name: '', imageUrl: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Data fetching
  const { data: notesRes, isLoading } = useApiQuery(
    () => api.notes.list(),
    [refreshKey],
  );
  const { data: countsData } = useApiQuery(
    () => api.notes.perfumeCounts(),
    [refreshKey],
  );
  const { data: perfumesForNote } = useApiQuery(
    () => selectedNote ? api.notes.perfumesByNote(selectedNote.name) : Promise.resolve({ data: [], meta: { total: 0, page: 1, per_page: 50 } }),
    [selectedNote?.name ?? ''],
  );

  const notes: Note[] = notesRes ?? [];
  const counts: Record<string, number> = (countsData as any) ?? {};
  const perfumes: PerfumeRef[] = (perfumesForNote as any) ?? [];

  // Filtering
  const filtered = useMemo(() => {
    let result = notes;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(n => n.name.toLowerCase().includes(q) || (n.description ?? '').toLowerCase().includes(q));
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [notes, search]);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // ---- Add Note ----
  const handleAdd = async () => {
    if (!addForm.name.trim()) { toast.error('Note name is required'); return; }
    const existing = new Set(notes.map(n => n.noteId.toLowerCase()));
    const baseId = slugify(addForm.name.trim()) || `note-${Date.now()}`;
    let noteId = baseId;
    let counter = 2;
    while (existing.has(noteId)) {
      noteId = `${baseId}-${counter}`;
      counter += 1;
    }
    setSaving(true);
    try {
      await api.notes.create({
        noteId,
        name: addForm.name.trim(),
        imageUrl: addForm.imageUrl.trim() || undefined,
        description: addForm.description.trim() || undefined,
      });
      toast.success(`"${addForm.name}" added to library`);
      setAddForm({ name: '', imageUrl: '', description: '' });
      setShowAddDialog(false);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  // ---- Edit Note ----
  const openEdit = (note: Note) => {
    setSelectedNote(note);
    setEditForm({
      name: note.name,
      imageUrl: note.imageUrl ?? '',
      description: note.description ?? '',
    });
    setShowEditDialog(true);
  };

  const handleEdit = async () => {
    if (!selectedNote || !editForm.name.trim()) return;
    setSaving(true);
    try {
      await api.notes.update(selectedNote.id, {
        name: editForm.name.trim(),
        imageUrl: editForm.imageUrl.trim() || undefined,
        description: editForm.description.trim() || undefined,
      });
      toast.success(`"${editForm.name}" updated`);
      setShowEditDialog(false);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update note');
    } finally {
      setSaving(false);
    }
  };

  // ---- Delete Note ----
  const handleDelete = async (note: Note) => {
    setDeleteTarget(note);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id);
    try {
      await api.notes.delete(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted`);
      refresh();
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete note');
    } finally {
      setDeleting(null);
    }
  };

  // ---- Import ----
  const handleBulkImport = async (data: any[]) => {
    await api.notes.bulkImport(data);
    refresh();
  };

  // ---- Click note → show perfumes ----
  const openPerfumes = (note: Note) => {
    setSelectedNote(note);
    setShowPerfumesDialog(true);
  };

  // ---- Note Card ----
  const NoteCard = ({ note }: { note: Note }) => {
    const count = counts[note.name.toLowerCase()] ?? 0;

    return (
      <div
        className="group relative bg-card/60 backdrop-blur border border-border/50 rounded-xl overflow-hidden hover:border-gold/40 hover:shadow-lg hover:shadow-gold/5 transition-all duration-200 cursor-pointer"
        onClick={() => openPerfumes(note)}
      >
        {/* Image */}
        <div className="w-[100px] h-[100px] mx-auto bg-muted/30 flex items-center justify-center overflow-hidden rounded-lg mt-3">
          {note.imageUrl ? (
            <img
              src={note.imageUrl}
              alt={note.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <Droplets className="w-8 h-8 text-muted-foreground/40" />
          )}
        </div>

        {/* Name + count */}
        <div className="p-3 text-center">
          <p className="text-sm font-medium text-foreground truncate">{note.name}</p>
          {count > 0 && (
            <p className="text-[10px] text-gold mt-0.5">{count} perfume{count !== 1 ? 's' : ''}</p>
          )}
        </div>

        {/* Hover actions */}
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(note); }}
            className="p-1 bg-background/80 backdrop-blur rounded-md hover:bg-background border border-border/50"
          >
            <Edit2 className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(note); }}
            className="p-1 bg-background/80 backdrop-blur rounded-md hover:bg-destructive/20 border border-border/50"
            disabled={deleting === note.id}
          >
            <Trash2 className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Notes Library"
        subtitle={`${notes.length} fragrance notes • Click any note to see tagged perfumes`}
        breadcrumbs={[{ label: 'System Setup' }, { label: 'Notes Library' }]}
      />

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="pl-9 bg-card/60 border-border/50"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
          <Plus className="w-4 h-4" /> Add Note
        </Button>
        <Button onClick={() => setShowImportDialog(true)} size="sm" variant="outline" className="gap-1.5">
          <Upload className="w-4 h-4" /> CSV Import
        </Button>
      </div>

      {/* Notes Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-card/30 rounded-xl animate-pulse aspect-square" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card/40 border-border/30">
          <CardContent className="py-16 text-center">
            <Droplets className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {search ? 'No notes match your search' : 'No notes yet — add your first note or import via CSV'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map(note => <NoteCard key={note.noteId} note={note} />)}
        </div>
      )}

      {/* ---- Add Note Dialog ---- */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-card border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle>Add Fragrance Note</DialogTitle>
            <DialogDescription>Add a new note to the library. It will be available for tagging in perfume master data.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Note Name *</label>
              <Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Bergamot" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Note Photo</label>
              <NoteImageUpload
                currentUrl={addForm.imageUrl || undefined}
                onUpload={(url) => setAddForm(f => ({ ...f, imageUrl: url }))}
              />
              <p className="text-[10px] text-muted-foreground mt-2">Recommended: Square PNG/JPG, max 2MB</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <textarea
                value={addForm.description}
                onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of the note..."
                className="w-full h-20 rounded-md border border-border/50 bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !addForm.name.trim()} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {saving ? 'Adding...' : 'Add Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Edit Note Dialog ---- */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-card border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>Update the details of this fragrance note.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Note Name *</label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Note Photo</label>
              <NoteImageUpload
                currentUrl={editForm.imageUrl || undefined}
                onUpload={(url) => setEditForm(f => ({ ...f, imageUrl: url }))}
              />
              <p className="text-[10px] text-muted-foreground mt-2">Recommended: Square PNG/JPG, max 2MB</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <textarea
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                className="w-full h-20 rounded-md border border-border/50 bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving || !editForm.name.trim()} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- CSV Import Dialog ---- */}
      {showImportDialog && (
        <GenericBulkImport
          title="Import Fragrance Notes"
          subtitle="Upload a CSV to add multiple notes to your library at once."
          columns={NOTE_IMPORT_COLUMNS}
          onImport={handleBulkImport}
          onClose={() => setShowImportDialog(false)}
          templateFilename="maison-notes-template.csv"
          templateExample={{
            name: 'Bergamot',
            category: 'citrus',
            image_url: 'https://...',
            description: 'Fresh and bright citrus note'
          }}
          transformRow={(raw) => {
            const existingIds = new Set(notes.map(n => n.noteId.toLowerCase()));
            const name = raw.name || '';
            const base = slugify(name) || `note-${Date.now()}`;
            let noteId = base;
            let counter = 2;
            while (existingIds.has(noteId)) {
              noteId = `${base}-${counter}`;
              counter += 1;
            }
            return {
              noteId,
              name,
              category: raw.category || 'other',
              imageUrl: raw.image_url || null,
              description: raw.description || null
            };
          }}
        />
      )}

      {/* ---- Perfumes using this note Dialog ---- */}
      <Dialog open={showPerfumesDialog} onOpenChange={setShowPerfumesDialog}>
        <DialogContent className="bg-card border-border/50 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedNote?.imageUrl ? (
                <img src={selectedNote.imageUrl} alt={selectedNote.name} className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center">
                  <Droplets className="w-5 h-5 text-muted-foreground/50" />
                </div>
              )}
              <span>{selectedNote?.name}</span>
            </DialogTitle>
            <DialogDescription>
              {perfumes.length > 0
                ? `${perfumes.length} perfume${perfumes.length !== 1 ? 's' : ''} tagged with this note`
                : 'No perfumes are using this note yet'}
            </DialogDescription>
          </DialogHeader>
          {selectedNote?.description && (
            <p className="text-sm text-muted-foreground italic border-l-2 border-gold/30 pl-3">{selectedNote.description}</p>
          )}
          {perfumes.length > 0 ? (
            <div className="space-y-2 mt-2">
              {perfumes.map((p: PerfumeRef, i: number) => (
                <div key={`${p.masterId}-${i}`} className="flex items-center justify-between bg-muted/20 rounded-lg px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.brand}</p>
                  </div>
                  <Badge variant="outline" className={`text-[9px] ${
                    p.notePosition === 'top' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
                    p.notePosition === 'heart' ? 'bg-pink-500/10 text-pink-400 border-pink-500/30' :
                    'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    {p.notePosition} note
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Droplets className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Add this note to perfumes in the Perfume Master page</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPerfumesDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
