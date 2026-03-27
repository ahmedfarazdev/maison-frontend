// ============================================================
// D3 — Subscriber Preference Tracking
// Track each subscriber's aura profile, liked/disliked notes,
// preferred perfume families, and feedback from past boxes.
// Helps curate future POTM and subscription boxes.
// ============================================================

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Heart, ThumbsUp, ThumbsDown, Star, Sparkles, User,
  Search, Plus, Edit2, Tag, Droplets, Palette, Wind,
} from 'lucide-react';
import { toast } from 'sonner';

// ---- Types ----
export interface SubscriberPreference {
  customer_id: string;
  customer_name: string;
  aura_profile: string; // e.g. "Ember" or "Velvet"
  liked_notes: string[];
  disliked_notes: string[];
  preferred_families: string[];
  intensity_preference: 'light' | 'moderate' | 'heavy';
  season_preference: string[];
  feedback_history: FeedbackEntry[];
  internal_notes: string;
}

export interface FeedbackEntry {
  date: string;
  perfume_name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
}

// ---- Mock data ----
const mockPreferences: SubscriberPreference[] = [
  {
    customer_id: 'C001',
    customer_name: 'Ahmed Al-Rashid',
    aura_profile: 'Ember',
    liked_notes: ['Oud', 'Amber', 'Sandalwood', 'Vanilla'],
    disliked_notes: ['Citrus', 'Aquatic'],
    preferred_families: ['Oriental', 'Woody'],
    intensity_preference: 'heavy',
    season_preference: ['Winter', 'Fall'],
    feedback_history: [
      { date: '2025-01-15', perfume_name: 'Baccarat Rouge 540', rating: 5, comment: 'Absolutely love this. Perfect for evenings.' },
      { date: '2025-02-01', perfume_name: 'Oud Wood', rating: 4, comment: 'Great but a bit too smoky for daily wear.' },
    ],
    internal_notes: 'VIP customer. Prefers niche houses. Birthday: March 15.',
  },
  {
    customer_id: 'C002',
    customer_name: 'Sara Khan',
    aura_profile: 'Velvet',
    liked_notes: ['Rose', 'Jasmine', 'Musk', 'Peony'],
    disliked_notes: ['Leather', 'Tobacco', 'Heavy Oud'],
    preferred_families: ['Floral', 'Fresh'],
    intensity_preference: 'moderate',
    season_preference: ['Spring', 'Summer'],
    feedback_history: [
      { date: '2025-01-20', perfume_name: 'Delina', rating: 5, comment: 'My new signature! So elegant.' },
      { date: '2025-02-05', perfume_name: 'Lost Cherry', rating: 3, comment: 'Too sweet for me. Prefer lighter florals.' },
    ],
    internal_notes: 'Interested in layering sets. Gifted subscription to her sister.',
  },
  {
    customer_id: 'C003',
    customer_name: 'Fatima Al-Sayed',
    aura_profile: 'Lumina',
    liked_notes: ['Bergamot', 'White Tea', 'Iris', 'Clean Musk'],
    disliked_notes: ['Patchouli', 'Heavy Spice'],
    preferred_families: ['Fresh', 'Green'],
    intensity_preference: 'light',
    season_preference: ['Spring', 'Summer'],
    feedback_history: [
      { date: '2025-01-25', perfume_name: 'Blanche', rating: 5, comment: 'Perfect clean scent. Exactly what I love.' },
    ],
    internal_notes: 'Minimalist taste. Appreciates subtle, skin-close scents.',
  },
];

const allNotes = [
  'Oud', 'Amber', 'Sandalwood', 'Vanilla', 'Rose', 'Jasmine', 'Musk',
  'Bergamot', 'Citrus', 'Leather', 'Tobacco', 'Patchouli', 'Iris',
  'Peony', 'White Tea', 'Vetiver', 'Cedar', 'Saffron', 'Tonka Bean',
  'Aquatic', 'Green Tea', 'Lavender', 'Tuberose', 'Neroli',
];

const perfumeFamilies = ['Oriental', 'Woody', 'Floral', 'Fresh', 'Green', 'Gourmand', 'Chypre', 'Fougère'];

const auraColors: Record<string, string> = {
  Ember: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  Velvet: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  Lumina: 'bg-sky-500/10 text-sky-500 border-sky-500/30',
  Terra: 'bg-amber-700/10 text-amber-700 border-amber-700/30',
  Noir: 'bg-zinc-800/10 text-zinc-300 border-zinc-500/30',
  Flora: 'bg-pink-500/10 text-pink-500 border-pink-500/30',
  Zephyr: 'bg-teal-500/10 text-teal-500 border-teal-500/30',
};

// ---- Preference Card ----
export function PreferenceCard({ pref, onEdit }: {
  pref: SubscriberPreference;
  onEdit?: (pref: SubscriberPreference) => void;
}) {
  const auraClass = auraColors[pref.aura_profile] || 'bg-muted text-muted-foreground border-border';

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">{pref.customer_name}</span>
              <Badge variant="outline" className={cn('text-[10px] px-1.5', auraClass)}>
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                {pref.aura_profile}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {pref.preferred_families.join(' · ')} · {pref.intensity_preference} intensity · {pref.season_preference.join(', ')}
            </p>
          </div>
          {onEdit && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(pref)}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Notes preferences */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 flex items-center gap-1">
              <ThumbsUp className="w-3 h-3 text-success" /> Liked Notes
            </p>
            <div className="flex flex-wrap gap-1">
              {pref.liked_notes.map(note => (
                <Badge key={note} variant="outline" className="text-[9px] px-1.5 py-0 border-success/30 text-success bg-success/5">
                  {note}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 flex items-center gap-1">
              <ThumbsDown className="w-3 h-3 text-destructive" /> Disliked Notes
            </p>
            <div className="flex flex-wrap gap-1">
              {pref.disliked_notes.map(note => (
                <Badge key={note} variant="outline" className="text-[9px] px-1.5 py-0 border-destructive/30 text-destructive bg-destructive/5">
                  {note}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Recent feedback */}
        {pref.feedback_history.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Recent Feedback</p>
            <div className="space-y-1">
              {pref.feedback_history.slice(0, 2).map((fb, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[11px] px-2 py-1.5 rounded-md bg-muted/50">
                  <Droplets className="w-3 h-3 text-info shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{fb.perfume_name}</span>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn('w-2.5 h-2.5', i < fb.rating ? 'text-gold fill-gold' : 'text-muted')} />
                        ))}
                      </div>
                    </div>
                    <p className="text-muted-foreground truncate">{fb.comment}</p>
                  </div>
                  <span className="text-[9px] text-muted-foreground shrink-0">{new Date(fb.date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Internal notes */}
        {pref.internal_notes && (
          <p className="text-[10px] text-muted-foreground italic border-t border-border/50 pt-2 mt-2">
            📝 {pref.internal_notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Preference Editor Dialog ----
export function PreferenceEditorDialog({ open, onOpenChange, preference, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preference: SubscriberPreference;
  onSave: (updated: SubscriberPreference) => void;
}) {
  const [likedNotes, setLikedNotes] = useState<string[]>(preference.liked_notes);
  const [dislikedNotes, setDislikedNotes] = useState<string[]>(preference.disliked_notes);
  const [families, setFamilies] = useState<string[]>(preference.preferred_families);
  const [notes, setNotes] = useState(preference.internal_notes);
  const [newNote, setNewNote] = useState('');

  const toggleNote = (note: string, list: 'liked' | 'disliked') => {
    if (list === 'liked') {
      setLikedNotes(prev => prev.includes(note) ? prev.filter(n => n !== note) : [...prev, note]);
      setDislikedNotes(prev => prev.filter(n => n !== note));
    } else {
      setDislikedNotes(prev => prev.includes(note) ? prev.filter(n => n !== note) : [...prev, note]);
      setLikedNotes(prev => prev.filter(n => n !== note));
    }
  };

  const toggleFamily = (family: string) => {
    setFamilies(prev => prev.includes(family) ? prev.filter(f => f !== family) : [...prev, family]);
  };

  const handleSave = () => {
    onSave({
      ...preference,
      liked_notes: likedNotes,
      disliked_notes: dislikedNotes,
      preferred_families: families,
      internal_notes: notes,
    });
    onOpenChange(false);
    toast.success(`Preferences updated for ${preference.customer_name}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-gold" />
            Edit Preferences — {preference.customer_name}
          </DialogTitle>
          <DialogDescription>
            Update scent preferences to improve future curation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Note preferences */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Scent Notes (tap to toggle liked/disliked)</p>
            <div className="flex flex-wrap gap-1.5">
              {allNotes.map(note => {
                const isLiked = likedNotes.includes(note);
                const isDisliked = dislikedNotes.includes(note);
                return (
                  <div key={note} className="flex items-center gap-0.5">
                    <button
                      onClick={() => toggleNote(note, 'liked')}
                      className={cn(
                        'text-[10px] px-2 py-1 rounded-l-md border transition-all',
                        isLiked
                          ? 'bg-success/10 border-success/40 text-success font-medium'
                          : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      <ThumbsUp className="w-2.5 h-2.5 inline mr-0.5" />
                      {note}
                    </button>
                    <button
                      onClick={() => toggleNote(note, 'disliked')}
                      className={cn(
                        'text-[10px] px-1.5 py-1 rounded-r-md border border-l-0 transition-all',
                        isDisliked
                          ? 'bg-destructive/10 border-destructive/40 text-destructive'
                          : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      <ThumbsDown className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Perfume families */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Preferred Families</p>
            <div className="flex flex-wrap gap-1.5">
              {perfumeFamilies.map(family => (
                <button
                  key={family}
                  onClick={() => toggleFamily(family)}
                  className={cn(
                    'text-[10px] px-2.5 py-1 rounded-md border transition-all',
                    families.includes(family)
                      ? 'bg-gold/10 border-gold/40 text-gold font-medium'
                      : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {family}
                </button>
              ))}
            </div>
          </div>

          {/* Internal notes */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Internal Notes</p>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="VIP notes, birthday, special requests..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="bg-gold hover:bg-gold/90 text-gold-foreground">
            Save Preferences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Preferences List Widget ----
export function SubscriberPreferencesWidget() {
  const [search, setSearch] = useState('');
  const [editingPref, setEditingPref] = useState<SubscriberPreference | null>(null);
  const [preferences, setPreferences] = useState(mockPreferences);

  const filtered = useMemo(() => {
    if (!search) return preferences;
    const q = search.toLowerCase();
    return preferences.filter(p =>
      p.customer_name.toLowerCase().includes(q) ||
      p.aura_profile.toLowerCase().includes(q) ||
      p.liked_notes.some(n => n.toLowerCase().includes(q)) ||
      p.preferred_families.some(f => f.toLowerCase().includes(q))
    );
  }, [preferences, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, aura, notes, or family..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(pref => (
          <PreferenceCard
            key={pref.customer_id}
            pref={pref}
            onEdit={setEditingPref}
          />
        ))}
      </div>

      {editingPref && (
        <PreferenceEditorDialog
          open={!!editingPref}
          onOpenChange={(open) => { if (!open) setEditingPref(null); }}
          preference={editingPref}
          onSave={(updated) => {
            setPreferences(prev => prev.map(p => p.customer_id === updated.customer_id ? updated : p));
            setEditingPref(null);
          }}
        />
      )}
    </div>
  );
}
