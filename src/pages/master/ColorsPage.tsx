import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTaxonomies } from '@/hooks/useTaxonomies';
import type { ColorDefinition } from '@/types';
import { Edit, Loader2, Palette, Plus, Save, Trash2 } from 'lucide-react';

export default function ColorsPage() {
  const { colorsQuery, createColor, updateColor, deleteColor } = useTaxonomies();

  const colors = useMemo(() => (colorsQuery.data as ColorDefinition[] | undefined) ?? [], [colorsQuery.data]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ColorDefinition | null>(null);
  const [form, setForm] = useState<{ name: string; hex_code: string }>({ name: '', hex_code: '#888888' });

  const isLoading = colorsQuery.isLoading;
  const isPending = createColor.isPending || updateColor.isPending || deleteColor.isPending;

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', hex_code: '#888888' });
    setDialogOpen(true);
  };

  const openEdit = (color: ColorDefinition) => {
    setEditing(color);
    setForm({ name: color.name, hex_code: color.hex_code });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (isPending) return;
    setDialogOpen(false);
    setDeleteDialogOpen(false);
    setEditing(null);
  };

  const save = () => {
    if (!form.name.trim()) return;
    const payload = { name: form.name.trim(), hex_code: form.hex_code };
    if (!editing?.id) {
      createColor.mutate(payload, {
        onSuccess: () => closeDialog(),
      });
      return;
    }

    updateColor.mutate(
      { id: editing.id, data: payload },
      {
        onSuccess: () => closeDialog(),
      },
    );
  };

  const confirmDelete = () => {
    if (!editing?.id) return;
    deleteColor.mutate(editing.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setDialogOpen(false);
        setEditing(null);
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Colors"
        subtitle={`${colors.length} colors configured for aura workflows`}
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Colors' }]}
        actions={
          <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={openAdd} disabled={isPending || isLoading}>
            <Plus className="w-3.5 h-3.5" /> Add Color
          </Button>
        }
      />

      <div className="p-6">
        {isLoading ? (
          <div className="h-24 rounded-xl border border-border bg-card/40 animate-pulse" />
        ) : colors.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
            No colors yet. Add your first color to power aura selection dropdowns.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {colors.map((color) => (
              <div key={color.id || color.name} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full border border-border" style={{ backgroundColor: color.hex_code }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{color.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{color.hex_code}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit(color)} disabled={isPending}>
                  <Edit className="w-3 h-3" /> Edit
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-4 h-4" /> {editing ? 'Edit Color' : 'Add Color'}
            </DialogTitle>
            <DialogDescription>
              Colors configured here are used in aura and perfume creation inputs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
                placeholder="e.g. Ruby"
                disabled={isPending}
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Hex Code</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={form.hex_code}
                  onChange={(e) => setForm((prev) => ({ ...prev, hex_code: e.target.value }))}
                  className="w-9 h-9 rounded border border-border"
                  disabled={isPending}
                />
                <input
                  value={form.hex_code}
                  onChange={(e) => setForm((prev) => ({ ...prev, hex_code: e.target.value }))}
                  className="h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30 font-mono"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between">
            {editing?.id ? (
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setDeleteDialogOpen(true)} disabled={isPending}>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            ) : <div />}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={closeDialog} disabled={isPending}>Cancel</Button>
              <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={save} disabled={isPending || !form.name.trim()}>
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open && !deleteColor.isPending) setDeleteDialogOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {editing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. If this color is in use by aura or perfume records, deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteColor.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (deleteColor.isPending) return;
                confirmDelete();
              }}
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={deleteColor.isPending}
            >
              {deleteColor.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
              {deleteColor.isPending ? 'Deleting...' : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
