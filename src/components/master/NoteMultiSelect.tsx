// ============================================================
// NoteMultiSelect — Searchable multi-select dropdown for Notes Library
// Used in AddPerfumeForm for top/heart/base note selection
// Features: typeahead search, selected chips, keyboard navigation
// ============================================================
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { X, Search, ChevronDown, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoteOption {
  noteId: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
}

interface NoteMultiSelectProps {
  /** All available notes from the Notes Library */
  options: NoteOption[];
  /** Currently selected note names */
  selected: string[];
  /** Callback when selection changes */
  onChange: (selected: string[]) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Label for the field */
  label?: string;
  /** Position label (top/heart/base) for color coding */
  position?: 'top' | 'heart' | 'base';
  /** Whether the field is required */
  required?: boolean;
  /** Whether the notes library is loading */
  loading?: boolean;
}

const POSITION_COLORS = {
  top: {
    chip: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    chipHover: 'hover:bg-yellow-100',
    ring: 'ring-yellow-300',
    dot: 'bg-yellow-400',
  },
  heart: {
    chip: 'bg-pink-50 text-pink-800 border-pink-200',
    chipHover: 'hover:bg-pink-100',
    ring: 'ring-pink-300',
    dot: 'bg-pink-400',
  },
  base: {
    chip: 'bg-amber-50 text-amber-800 border-amber-200',
    chipHover: 'hover:bg-amber-100',
    ring: 'ring-amber-300',
    dot: 'bg-amber-400',
  },
};

export default function NoteMultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Search notes...',
  label,
  position = 'top',
  required = false,
  loading = false,
}: NoteMultiSelectProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const colors = POSITION_COLORS[position];

  // Filter options based on query, excluding already selected
  const filteredOptions = useMemo(() => {
    const selectedSet = new Set(selected);
    let filtered = options.filter(o => !selectedSet.has(o.name));
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(o => o.name.toLowerCase().includes(q));
    }
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [options, selected, query]);

  // Reset highlight when query or options change
  useEffect(() => {
    setHighlightIndex(0);
  }, [query, filteredOptions.length]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const items = listRef.current.querySelectorAll('[data-option]');
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex, isOpen]);

  const addNote = useCallback((name: string) => {
    if (!selected.includes(name)) {
      onChange([...selected, name]);
    }
    setQuery('');
    setHighlightIndex(0);
    inputRef.current?.focus();
  }, [selected, onChange]);

  const removeNote = useCallback((name: string) => {
    onChange(selected.filter(n => n !== name));
  }, [selected, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(i => Math.min(i + 1, filteredOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightIndex]) {
        addNote(filteredOptions[highlightIndex].name);
      } else if (query.trim()) {
        // Allow adding custom notes not in library
        addNote(query.trim());
      }
    } else if (e.key === 'Backspace' && !query && selected.length > 0) {
      removeNote(selected[selected.length - 1]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, [filteredOptions, highlightIndex, query, selected, addNote, removeNote]);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
      )}

      {/* Input area with chips */}
      <div
        className={cn(
          'min-h-[42px] flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-background transition-all cursor-text',
          isOpen ? `border-gold/60 ring-2 ${colors.ring}/20` : 'border-input hover:border-gold/30',
        )}
        onClick={() => { inputRef.current?.focus(); setIsOpen(true); }}
      >
        {/* Selected chips */}
        {selected.map(name => {
          const noteData = options.find(o => o.name === name);
          return (
            <span
              key={name}
              className={cn(
                'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors',
                colors.chip, colors.chipHover,
              )}
            >
              {noteData?.imageUrl ? (
                <img src={noteData.imageUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
              ) : (
                <span className={cn('w-2 h-2 rounded-full', colors.dot)} />
              )}
              {name}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeNote(name); }}
                className="ml-0.5 hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}

        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
        />

        <ChevronDown className={cn('w-4 h-4 text-muted-foreground/40 shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-[240px] overflow-hidden">
          {loading ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground animate-pulse">
              Loading notes library...
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <Droplets className="w-5 h-5 text-muted-foreground/30 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">
                {query ? `No notes matching "${query}"` : 'All notes selected'}
              </p>
              {query && (
                <button
                  type="button"
                  onClick={() => addNote(query.trim())}
                  className="mt-2 text-[11px] text-gold hover:underline"
                >
                  + Add "{query.trim()}" as custom note
                </button>
              )}
            </div>
          ) : (
            <div ref={listRef} className="overflow-y-auto max-h-[240px] py-1">
              {filteredOptions.map((option, idx) => (
                <button
                  key={option.noteId}
                  type="button"
                  data-option
                  onClick={() => addNote(option.name)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                    idx === highlightIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50',
                  )}
                >
                  {option.imageUrl ? (
                    <img src={option.imageUrl} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                  ) : (
                    <span className="w-5 h-5 rounded flex items-center justify-center shrink-0 bg-muted">
                      <Droplets className="w-3 h-3 text-muted-foreground/70" />
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{option.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Helper text */}
      {selected.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-1">
          {selected.length} note{selected.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );
}
