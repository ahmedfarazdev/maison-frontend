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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared';
import { cn } from '@/lib/utils';
import {
  Plus, Search, X, Edit2, Trash2, Droplets, Download, FileSpreadsheet, Upload, Check, AlertTriangle,
} from 'lucide-react';

// ---- Types ----
interface Note {
  id: number;
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
  const [refreshKey, setRefreshKey] = useState(0);

  // CSV import state (matching Perfume Master pattern)
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [csvParsed, setCsvParsed] = useState<{ name: string; imageUrl?: string; description?: string; valid: boolean; error?: string }[]>([]);
  const [importing, setImporting] = useState(false);

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

  const notes: Note[] = notesRes?.data ?? [];
  const counts: Record<string, number> = (countsData as any) ?? {};
  const perfumes: PerfumeRef[] = (perfumesForNote as any)?.data ?? [];

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
    setSaving(true);
    try {
      await api.notes.create({
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
      await api.notes.update(selectedNote.noteId, {
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
    if (!confirm(`Delete "${note.name}" from the notes library?`)) return;
    setDeleting(note.noteId);
    try {
      await api.notes.delete(note.noteId);
      toast.success(`"${note.name}" deleted`);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete note');
    } finally {
      setDeleting(null);
    }
  };

  // ---- CSV Import (Perfume Master pattern) ----
  const downloadTemplate = () => {
    const header = 'name,image_url,description';
    const example1 = 'Bergamot,https://example.com/bergamot.jpg,Fresh citrus note with bright zesty character';
    const example2 = 'Rose,,Classic floral heart note';
    const example3 = 'Oud,https://example.com/oud.jpg,Rich woody base note with smoky depth';
    const csv = `${header}\n${example1}\n${example2}\n${example3}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'maison_em_notes_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { toast.error('CSV must have a header row and at least one data row'); return; }

    const header = lines[0].toLowerCase().replace(/\r/g, '');
    const cols = header.split(',').map(c => c.trim());
    const nameIdx = cols.findIndex(c => c === 'name');
    const imageIdx = cols.findIndex(c => c === 'image_url' || c === 'imageurl' || c === 'image');
    const descIdx = cols.findIndex(c => c === 'description' || c === 'desc');

    if (nameIdx === -1) {
      toast.error('CSV must have a "name" column');
      return;
    }

    const existingNames = new Set(notes.map(n => n.name.toLowerCase()));
    const parsed: typeof csvParsed = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].replace(/\r/g, '');
      // Simple CSV parsing (handles quoted fields)
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const char of row) {
        if (char === '"') { inQuotes = !inQuotes; continue; }
        if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
        current += char;
      }
      values.push(current.trim());

      const name = values[nameIdx] || '';
      if (!name) {
        parsed.push({ name: `(row ${i + 1})`, valid: false, error: 'Missing name' });
        continue;
      }
      if (existingNames.has(name.toLowerCase())) {
        parsed.push({ name, valid: false, error: 'Duplicate — already exists' });
        continue;
      }
      existingNames.add(name.toLowerCase());

      parsed.push({
        name,
        imageUrl: imageIdx >= 0 ? values[imageIdx] || undefined : undefined,
        description: descIdx >= 0 ? values[descIdx] || undefined : undefined,
        valid: true,
      });
    }

    setCsvParsed(parsed);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(parseCSV);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      file.text().then(parseCSV);
    } else {
      toast.error('Please drop a .csv file');
    }
  };

  const validRows = csvParsed.filter(r => r.valid);
  const invalidRows = csvParsed.filter(r => !r.valid);

  const handleImportConfirm = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const notesToImport = validRows.map(r => ({
        name: r.name,
        imageUrl: r.imageUrl,
        description: r.description,
      }));
      const result = await api.notes.bulkImport(notesToImport);
      toast.success(`Imported ${(result as any)?.imported ?? notesToImport.length} notes`);
      setShowImportDialog(false);
      setCsvParsed([]);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // ---- Click note → show perfumes ----
  const openPerfumes = (note: Note) => {
    setSelectedNote(note);
    setShowPerfumesDialog(true);
  };

  // ---- Note Card ----
  const NoteCard = ({ note }: { note: Note }) => {
    const count = counts[note.name] ?? 0;

    return (
      <div
        className="group relative bg-card/60 backdrop-blur border border-border/50 rounded-xl overflow-hidden hover:border-gold/40 hover:shadow-lg hover:shadow-gold/5 transition-all duration-200 cursor-pointer"
        onClick={() => openPerfumes(note)}
      >
        {/* Image */}
        <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden">
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
            disabled={deleting === note.noteId}
          >
            <Trash2 className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
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
        <Button onClick={() => { setShowImportDialog(true); setCsvParsed([]); }} size="sm" variant="outline" className="gap-1.5">
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
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Image URL</label>
              <Input value={addForm.imageUrl} onChange={e => setAddForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." />
              {addForm.imageUrl && (
                <div className="mt-2 w-16 h-16 rounded-lg overflow-hidden bg-muted/30">
                  <img src={addForm.imageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
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
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !addForm.name.trim()} className="bg-gold hover:bg-gold/90 text-gold-foreground">
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
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Image URL</label>
              <Input value={editForm.imageUrl} onChange={e => setEditForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." />
              {editForm.imageUrl && (
                <div className="mt-2 w-16 h-16 rounded-lg overflow-hidden bg-muted/30">
                  <img src={editForm.imageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
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
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving || !editForm.name.trim()} className="bg-gold hover:bg-gold/90 text-gold-foreground">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- CSV Import Dialog (Perfume Master pattern) ---- */}
      <Dialog open={showImportDialog} onOpenChange={(open) => { setShowImportDialog(open); if (!open) setCsvParsed([]); }}>
        <DialogContent className="bg-card border-border/50 max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Bulk CSV Import</DialogTitle>
            <DialogDescription>Upload a CSV to create fragrance notes in bulk</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {/* Drop zone — shown when no CSV parsed yet */}
            {csvParsed.length === 0 && (
              <>
                <div
                  className={cn(
                    'border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer',
                    dragOver
                      ? 'border-gold bg-gold/5 scale-[1.01]'
                      : 'border-border hover:border-gold/50 hover:bg-muted/30'
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center">
                      <FileSpreadsheet className="w-8 h-8 text-gold" />
                    </div>
                    <div>
                      <p className="text-base font-semibold">Drop your CSV file here</p>
                      <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                    </div>
                    <p className="text-xs text-muted-foreground max-w-md">
                      Required column: <span className="font-mono text-foreground">name</span>.
                      Optional: <span className="font-mono text-foreground">image_url</span>, <span className="font-mono text-foreground">description</span>
                    </p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
                    <Download className="w-3.5 h-3.5" /> Download CSV Template
                  </Button>
                </div>
              </>
            )}

            {/* Parsed results */}
            {csvParsed.length > 0 && (
              <>
                {/* Summary bar */}
                <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-semibold">{csvParsed.length} rows parsed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{validRows.length} valid</span>
                  </div>
                  {invalidRows.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-red-600 dark:text-red-400 font-medium">{invalidRows.length} errors</span>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="ml-auto gap-1.5 text-muted-foreground"
                    onClick={() => { setCsvParsed([]); if (fileRef.current) fileRef.current.value = ''; }}>
                    <Trash2 className="w-3.5 h-3.5" /> Clear
                  </Button>
                </div>

                {/* Row table */}
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5 w-12">#</th>
                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Status</th>
                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Name</th>
                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Image</th>
                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvParsed.map((row, idx) => (
                        <tr key={idx} className={cn('border-b border-border last:border-0', !row.valid && 'bg-red-50/5')}>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{idx + 1}</td>
                          <td className="px-4 py-2">
                            {row.valid ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <span className="text-[10px] text-red-500">{row.error}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium">{row.name}</td>
                          <td className="px-4 py-2">
                            {row.imageUrl ? (
                              <img src={row.imageUrl} alt="" className="w-8 h-8 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[200px]">{row.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => { setShowImportDialog(false); setCsvParsed([]); }}>Cancel</Button>
            {csvParsed.length > 0 && (
              <Button
                onClick={handleImportConfirm}
                disabled={importing || validRows.length === 0}
                className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
              >
                {importing ? 'Importing...' : `Import ${validRows.length} Notes`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
