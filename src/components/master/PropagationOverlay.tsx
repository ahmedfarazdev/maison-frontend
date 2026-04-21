import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import {
  RefreshCw, CheckCircle2, AlertTriangle, X, Loader2,
  ArrowRight, Sparkles,
} from 'lucide-react';

interface PropagationProgress {
  step: string;
  progress: number;
  updated: number;
  total?: number;
}

type OverlayState = 'connecting' | 'running' | 'complete' | 'error';

interface PropagationOverlayProps {
  open: boolean;
  onClose: () => void;
  ruleName: string;
}

export default function PropagationOverlay({ open, onClose, ruleName }: PropagationOverlayProps) {
  const [state, setState] = useState<OverlayState>('connecting');
  const [progress, setProgress] = useState<PropagationProgress | null>(null);
  const [recentUpdates, setRecentUpdates] = useState<string[]>([]);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startPropagation = useCallback(() => {
    setState('connecting');
    setProgress(null);
    setRecentUpdates([]);

    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    const performPoll = async () => {
      try {
        const data = await api.subscriptionPricing.getPropagationStatus();
        
          if (data.status === 'running') {
            setState('running');
            setProgress({
              step: data.step,
              progress: data.progress,
              updated: data.updated,
              total: data.total
            });
  
            if (data.step) {
              setRecentUpdates(prev => {
                if (prev[0] === data.step) return prev;
                return [data.step, ...prev].slice(0, 5);
              });
            }
          } else if (data.status === 'completed') {
            setState('complete');
            setProgress({
              step: 'Finished',
              progress: 100,
              updated: data.updated,
              total: data.total
            });
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          } else if (data.status === 'failed') {
            setState('error');
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          } else if (data.status === 'idle' && state === 'running') {
            // If it was running but now is idle, it might have been reset or finished
            setState('complete');
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      };

    // Poll every 1.5 seconds
    pollIntervalRef.current = setInterval(performPoll, 1500);
    
    // Initial poll
    performPoll();
  }, []);

  useEffect(() => {
    if (open) {
      startPropagation();
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [open, startPropagation]);

  if (!open) return null;

  const percentage = progress?.progress ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 mb-4 sm:mb-0 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center',
              state === 'complete' ? 'bg-success/10' :
              state === 'error' ? 'bg-destructive/10' :
              'bg-gold/10'
            )}>
              {state === 'complete' ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : state === 'error' ? (
                <AlertTriangle className="w-5 h-5 text-destructive" />
              ) : (
                <RefreshCw className="w-5 h-5 text-gold animate-spin" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                {state === 'complete' ? 'Propagation Complete' :
                 state === 'error' ? 'Propagation Error' :
                 'Recalculating Prices'}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {ruleName && (
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Triggered by: <span className="font-medium text-foreground">{ruleName}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
          {(state === 'complete' || state === 'error') && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {state === 'connecting' && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Connecting to propagation engine...</span>
            </div>
          )}

          {state === 'running' && progress && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">
                    {progress.step}
                  </span>
                  <span className="font-mono font-bold text-gold">
                    {percentage}%
                  </span>
                </div>
                <div className="h-3 rounded-full overflow-hidden bg-muted/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold transition-all duration-300 ease-out"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              {recentUpdates.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Recently Updated</p>
                  <div className="space-y-0.5">
                    {recentUpdates.map((name, i) => (
                      <div key={`${name}-${i}`} className={cn(
                        'flex items-center gap-1.5 text-xs transition-opacity duration-300',
                        i === 0 ? 'opacity-100' : i === 1 ? 'opacity-70' : 'opacity-40'
                      )}>
                        <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
                        <span className="truncate">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {state === 'complete' && (
            <div className="space-y-4 text-center py-4">
              <div className="flex justify-center mb-2">
                <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
              </div>
              <div>
                <p className="text-lg font-bold">Success</p>
                <p className="text-sm text-muted-foreground">Pricing rules have been propagated to all perfumes.</p>
                {progress?.updated !== undefined && (
                  <p className="text-xs font-mono text-gold mt-2">Total perfumes updated: {progress.updated}</p>
                )}
              </div>
            </div>
          )}

          {state === 'error' && (
            <div className="flex items-start gap-3 p-3 bg-destructive/5 rounded-lg border border-destructive/20 text-destructive text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold">Error</p>
                <p className="opacity-80">Failed to connect to pricing engine. Please try again.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border bg-muted/10">
          {(state === 'complete' || state === 'error') && (
            <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground" onClick={onClose}>
              Close
            </Button>
          )}
          {(state === 'connecting' || state === 'running') && (
            <p className="text-[10px] text-muted-foreground italic">
              Recalculating... please do not close this window
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
