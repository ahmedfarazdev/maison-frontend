// ============================================================
// DashboardCustomizer — Slide-out panel for layout preferences
// Design: "Maison Ops" — clean, precise, institutional
// ============================================================

import { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  X, GripVertical, RotateCcw, Eye, EyeOff,
  ShoppingCart, RotateCcw as SubIcon, FlaskConical, Truck,
  BarChart3, Droplets, AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { KPICardConfig, DashboardSection } from '@/hooks/useDashboardLayout';

const KPI_ICONS: Record<string, React.ElementType> = {
  one_time_orders: ShoppingCart,
  subscription_cycle: SubIcon,
  decant_batches: FlaskConical,
  ready_for_pickup: Truck,
};

const SECTION_ICONS: Record<string, React.ElementType> = {
  pipeline: BarChart3,
  inventory_health: Droplets,
  alerts: AlertTriangle,
};

const KPI_COLORS: Record<string, string> = {
  one_time_orders: 'text-primary',
  subscription_cycle: 'text-gold',
  decant_batches: 'text-success',
  ready_for_pickup: 'text-warning',
};

interface DashboardCustomizerProps {
  open: boolean;
  onClose: () => void;
  cards: KPICardConfig[];
  sections: DashboardSection[];
  onToggleCard: (id: string) => void;
  onToggleSection: (id: string) => void;
  onReorderCards: (from: number, to: number) => void;
  onReorderSections: (from: number, to: number) => void;
  onReset: () => void;
  hasCustomizations: boolean;
}

// ---- Draggable Item ----
function DraggableItem<T extends { id: string; label: string; visible: boolean; order: number }>({
  item,
  index,
  iconMap,
  colorMap,
  onToggle,
  onDragStart,
  onDragOver,
  onDrop,
  dragOverIndex,
  isDragging,
}: {
  item: T;
  index: number;
  iconMap: Record<string, React.ElementType>;
  colorMap?: Record<string, string>;
  onToggle: (id: string) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent) => void;
  dragOverIndex: number | null;
  isDragging: boolean;
}) {
  const Icon = iconMap[item.id] || ShoppingCart;
  const color = colorMap?.[item.id] || 'text-muted-foreground';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={onDrop}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing select-none',
        item.visible
          ? 'bg-card border-border hover:border-gold/30 hover:shadow-sm'
          : 'bg-muted/30 border-border/50 opacity-60',
        dragOverIndex === index && isDragging && 'border-gold/50 shadow-md bg-gold/5',
      )}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
      <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0', item.visible ? 'bg-muted/50' : 'bg-muted/20')}>
        <Icon className={cn('w-3.5 h-3.5', item.visible ? color : 'text-muted-foreground/40')} />
      </div>
      <span className={cn('text-sm font-medium flex-1', !item.visible && 'text-muted-foreground line-through')}>
        {item.label}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(item.id); }}
        className={cn(
          'p-1 rounded-md transition-colors',
          item.visible ? 'text-success hover:bg-success/10' : 'text-muted-foreground hover:bg-muted',
        )}
        title={item.visible ? 'Hide' : 'Show'}
      >
        {item.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
    </motion.div>
  );
}

export function DashboardCustomizer({
  open,
  onClose,
  cards,
  sections,
  onToggleCard,
  onToggleSection,
  onReorderCards,
  onReorderSections,
  onReset,
  hasCustomizations,
}: DashboardCustomizerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // ---- Card drag state ----
  const [cardDragIndex, setCardDragIndex] = useState<number | null>(null);
  const [cardDragOverIndex, setCardDragOverIndex] = useState<number | null>(null);

  const handleCardDragStart = useCallback((index: number) => {
    setCardDragIndex(index);
  }, []);

  const handleCardDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setCardDragOverIndex(index);
  }, []);

  const handleCardDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (cardDragIndex !== null && cardDragOverIndex !== null && cardDragIndex !== cardDragOverIndex) {
      onReorderCards(cardDragIndex, cardDragOverIndex);
    }
    setCardDragIndex(null);
    setCardDragOverIndex(null);
  }, [cardDragIndex, cardDragOverIndex, onReorderCards]);

  // ---- Section drag state ----
  const [sectionDragIndex, setSectionDragIndex] = useState<number | null>(null);
  const [sectionDragOverIndex, setSectionDragOverIndex] = useState<number | null>(null);

  const handleSectionDragStart = useCallback((index: number) => {
    setSectionDragIndex(index);
  }, []);

  const handleSectionDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setSectionDragOverIndex(index);
  }, []);

  const handleSectionDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (sectionDragIndex !== null && sectionDragOverIndex !== null && sectionDragIndex !== sectionDragOverIndex) {
      onReorderSections(sectionDragIndex, sectionDragOverIndex);
    }
    setSectionDragIndex(null);
    setSectionDragOverIndex(null);
  }, [sectionDragIndex, sectionDragOverIndex, onReorderSections]);

  const sortedCards = [...cards].sort((a, b) => a.order - b.order);
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const visibleCount = cards.filter(c => c.visible).length;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-[380px] max-w-[90vw] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Customize Dashboard</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Drag to reorder · Toggle visibility</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {/* KPI Cards Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    KPI Cards
                  </h3>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {visibleCount}/{cards.length} visible
                  </span>
                </div>
                <div
                  className="space-y-1.5"
                  onDragOver={(e) => e.preventDefault()}
                >
                  <AnimatePresence mode="popLayout">
                    {sortedCards.map((card, i) => (
                      <DraggableItem
                        key={card.id}
                        item={card}
                        index={i}
                        iconMap={KPI_ICONS}
                        colorMap={KPI_COLORS}
                        onToggle={onToggleCard}
                        onDragStart={handleCardDragStart}
                        onDragOver={handleCardDragOver}
                        onDrop={handleCardDrop}
                        dragOverIndex={cardDragOverIndex}
                        isDragging={cardDragIndex !== null}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Dashboard Sections */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Dashboard Sections
                  </h3>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {sections.filter(s => s.visible).length}/{sections.length} visible
                  </span>
                </div>
                <div
                  className="space-y-1.5"
                  onDragOver={(e) => e.preventDefault()}
                >
                  <AnimatePresence mode="popLayout">
                    {sortedSections.map((section, i) => (
                      <DraggableItem
                        key={section.id}
                        item={section}
                        index={i}
                        iconMap={SECTION_ICONS}
                        onToggle={onToggleSection}
                        onDragStart={handleSectionDragStart}
                        onDragOver={handleSectionDragOver}
                        onDrop={handleSectionDrop}
                        dragOverIndex={sectionDragOverIndex}
                        isDragging={sectionDragIndex !== null}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Column Layout Toggle */}
              <div className="pt-2 border-t border-border">
                <p className="text-[11px] text-muted-foreground mb-3">
                  Your layout preferences are saved automatically and persist across sessions.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                disabled={!hasCustomizations}
                className="gap-1.5 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
              </Button>
              <Button size="sm" onClick={onClose} className="bg-gold hover:bg-gold/90 text-gold-foreground text-xs">
                Done
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
