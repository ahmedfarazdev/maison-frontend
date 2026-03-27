// ============================================================
// Shared UI Components — Maison Em OS
// Design: "Enterprise Ops" — Luxury Command Center
// Typography hierarchy, 8px grid, micro-interactions
// ============================================================

import { cn } from '@/lib/utils';
import { ChevronRight, AlertTriangle, CheckCircle2, Clock, Info, ArrowRight, X } from 'lucide-react';
import { Link } from 'wouter';

// ---- Status Badge ----
type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'gold' | 'muted';
const badgeStyles: Record<BadgeVariant, string> = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
  gold: 'bg-gold/10 text-gold',
  muted: 'bg-muted text-muted-foreground',
};

export function StatusBadge({ children, variant = 'default', className }: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-full',
      badgeStyles[variant],
      className,
    )}>
      {children}
    </span>
  );
}

// ---- KPI Card (Enterprise) ----
// Bigger numbers (28-32px), stronger accent strip, hover elevation, trend at top-right
export function KPICard({ label, value, sublabel, icon: Icon, trend, variant = 'default' }: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ElementType;
  trend?: { value: string; up: boolean };
  variant?: 'default' | 'gold' | 'success' | 'warning' | 'destructive';
}) {
  const accentColors: Record<string, string> = {
    default: 'border-l-primary',
    gold: 'border-l-gold',
    success: 'border-l-success',
    warning: 'border-l-warning',
    destructive: 'border-l-destructive',
  };
  return (
    <div className={cn(
      'bg-card border border-border rounded-lg p-5 border-l-[3px] card-hover',
      accentColors[variant],
    )}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold leading-none">{label}</p>
        <div className="flex items-center gap-2">
          {trend && (
            <span className={cn(
              'inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
              trend.up ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
            )}>
              {trend.up ? '↑' : '↓'} {trend.value}
            </span>
          )}
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-muted-foreground/70" />
            </div>
          )}
        </div>
      </div>
      <p className="text-[28px] font-bold mt-2 tracking-tight leading-none">{value}</p>
      {sublabel && <p className="text-[11px] text-muted-foreground/70 mt-1.5 leading-tight">{sublabel}</p>}
    </div>
  );
}

// ---- Pipeline Progress ----
export function PipelineProgress({ stages }: { stages: { stage: string; count: number }[] }) {
  const total = stages.reduce((s, st) => s + st.count, 0);
  const colors = [
    'bg-info/70', 'bg-info', 'bg-gold/70', 'bg-gold', 'bg-success/70', 'bg-success',
  ];
  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {stages.map((s, i) => (
          s.count > 0 && (
            <div
              key={s.stage}
              className={cn('transition-all duration-500', colors[i % colors.length])}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${s.stage}: ${s.count}`}
            />
          )
        ))}
      </div>
      <div className="flex items-center gap-1 text-xs">
        {stages.map((s, i) => (
          <div key={s.stage} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
            <span className="text-muted-foreground">{s.stage}</span>
            <span className="font-semibold font-mono">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Station Stepper ----
export function StationStepper({ stations, currentStation }: {
  stations: { id: number; label: string; status: 'completed' | 'active' | 'pending' }[];
  currentStation: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {stations.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1">
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
            s.status === 'completed' && 'bg-success/10 text-success',
            s.status === 'active' && 'bg-gold/15 text-gold ring-1 ring-gold/30',
            s.status === 'pending' && 'bg-muted text-muted-foreground',
          )}>
            {s.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
            {s.status === 'active' && <Clock className="w-3.5 h-3.5" />}
            <span>S{s.id}</span>
          </div>
          {i < stations.length - 1 && (
            <ArrowRight className="w-3 h-3 text-muted-foreground/30" />
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Alert Item (Enterprise) ----
// Compressed height, severity badge, quick action button, left border + neutral bg
export function AlertItem({ severity, message, time, onAction, actionLabel }: {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  time: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  const icons = {
    critical: <AlertTriangle className="w-3.5 h-3.5 text-destructive" />,
    warning: <AlertTriangle className="w-3.5 h-3.5 text-warning" />,
    info: <Info className="w-3.5 h-3.5 text-info" />,
  };
  const severityBadge = {
    critical: 'bg-destructive/10 text-destructive',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-info/10 text-info',
  };
  const borderColor = {
    critical: 'border-l-destructive',
    warning: 'border-l-warning',
    info: 'border-l-info',
  };
  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-md border-l-[3px] bg-card/50 transition-colors hover:bg-muted/30',
      borderColor[severity],
    )}>
      {icons[severity]}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] leading-tight truncate">{message}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{time}</p>
      </div>
      <span className={cn(
        'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0',
        severityBadge[severity],
      )}>
        {severity}
      </span>
      {onAction && (
        <button
          onClick={onAction}
          className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors shrink-0 px-2 py-1 rounded hover:bg-muted/50"
        >
          {actionLabel || 'View'}
        </button>
      )}
    </div>
  );
}

// ---- Page Header (Enterprise) ----
// Stronger title (text-2xl), better hierarchy
export function PageHeader({ title, subtitle, actions, breadcrumbs }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  return (
    <div className="px-6 pt-6 pb-5 border-b border-border bg-card/50">
      {breadcrumbs && (
        <nav className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-3">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="w-3 h-3" />}
              {b.href ? (
                <Link href={b.href} className="hover:text-foreground transition-colors">{b.label}</Link>
              ) : (
                <span className="text-foreground font-medium">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground/70 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// ---- Empty State ----
export function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-muted-foreground/50" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---- Section Card (Enterprise) ----
// Consistent 8px grid padding, hover elevation
export function SectionCard({ title, subtitle, children, className, headerActions }: {
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}) {
  return (
    <div className={cn('bg-card border border-border rounded-lg card-hover', className)}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-bold tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
        </div>
        {headerActions}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ---- Checkbox Row (for pick lists) ----
export function CheckboxRow({ checked, onChange, children, className }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn(
      'flex items-center gap-3 px-3 py-3 rounded-md border border-border cursor-pointer transition-all',
      checked ? 'bg-success/5 border-success/30' : 'hover:bg-muted/50',
      className,
    )}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-border text-success focus:ring-success/30"
      />
      <div className="flex-1 min-w-0">{children}</div>
      {checked && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
    </label>
  );
}
