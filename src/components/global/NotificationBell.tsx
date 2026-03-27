// ============================================================
// Notification Bell — In-app notification center
// Shows unread count badge, notification list with categories,
// mark as read, dismiss, and click-to-navigate.
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell, AlertTriangle, Package, ShoppingCart, CheckSquare,
  Truck, Clock, X, Check, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Notification Types ----
export type NotificationType =
  | 'low_stock'
  | 'overdue_po'
  | 'batch_ready'
  | 'qc_issue'
  | 'order_stuck'
  | 'cutoff_reminder'
  | 'shipment_ready';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  dismissed: boolean;
  link?: string;
  severity: 'critical' | 'warning' | 'info';
}

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string }> = {
  low_stock: { icon: Package, color: 'text-red-500' },
  overdue_po: { icon: Clock, color: 'text-orange-500' },
  batch_ready: { icon: CheckSquare, color: 'text-emerald-500' },
  qc_issue: { icon: AlertTriangle, color: 'text-red-500' },
  order_stuck: { icon: ShoppingCart, color: 'text-amber-500' },
  cutoff_reminder: { icon: Clock, color: 'text-blue-500' },
  shipment_ready: { icon: Truck, color: 'text-purple-500' },
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-blue-500',
};

function generateMockNotifications(): Notification[] {
  const now = new Date();
  return [
    {
      id: 'notif-001', type: 'low_stock', title: 'Critical: Low Stock',
      message: 'Tobacco Vanille (DEC-002) has only 18ml remaining — below 30ml threshold',
      timestamp: new Date(now.getTime() - 10 * 60000).toISOString(),
      read: false, dismissed: false, link: '/inventory/decanting-pool', severity: 'critical',
    },
    {
      id: 'notif-002', type: 'overdue_po', title: 'PO Overdue',
      message: 'PO-003/Ahmed K. expected delivery passed — 2 days overdue',
      timestamp: new Date(now.getTime() - 30 * 60000).toISOString(),
      read: false, dismissed: false, link: '/procurement/purchase-orders', severity: 'warning',
    },
    {
      id: 'notif-003', type: 'batch_ready', title: 'Batch Ready',
      message: 'JOB-2025-001 batch decanting complete — ready for fulfillment',
      timestamp: new Date(now.getTime() - 45 * 60000).toISOString(),
      read: false, dismissed: false, link: '/stations/5-fulfillment', severity: 'info',
    },
    {
      id: 'notif-004', type: 'order_stuck', title: 'Order Stuck',
      message: 'ORD-2025-002 has been in processing for 24+ hours',
      timestamp: new Date(now.getTime() - 60 * 60000).toISOString(),
      read: false, dismissed: false, link: '/orders/one-time', severity: 'warning',
    },
    {
      id: 'notif-005', type: 'low_stock', title: 'Low Stock Warning',
      message: '5ml Labels — only 8 sheets remaining',
      timestamp: new Date(now.getTime() - 90 * 60000).toISOString(),
      read: true, dismissed: false, link: '/inventory/packaging', severity: 'warning',
    },
    {
      id: 'notif-006', type: 'cutoff_reminder', title: 'Cutoff Approaching',
      message: 'Subscription cycle CYC-2025-02 cutoff in 1 day (Feb 14)',
      timestamp: new Date(now.getTime() - 120 * 60000).toISOString(),
      read: true, dismissed: false, link: '/orders/subscriptions', severity: 'info',
    },
    {
      id: 'notif-007', type: 'shipment_ready', title: 'Shipment Ready',
      message: '4 packages ready for courier pickup — Aramex scheduled',
      timestamp: new Date(now.getTime() - 180 * 60000).toISOString(),
      read: true, dismissed: false, link: '/stations/6-shipping', severity: 'info',
    },
    {
      id: 'notif-008', type: 'qc_issue', title: 'QC Flag',
      message: 'ORD-2025-004 box weight mismatch — manual verification needed',
      timestamp: new Date(now.getTime() - 240 * 60000).toISOString(),
      read: true, dismissed: false, link: '/stations/5-fulfillment', severity: 'critical',
    },
  ];
}

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [, setLocation] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>(() => generateMockNotifications());
  const [open, setOpen] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read && !n.dismissed).length,
    [notifications]
  );

  const visibleNotifications = useMemo(
    () => notifications.filter(n => !n.dismissed),
    [notifications]
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, dismissed: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const handleClick = useCallback((notif: Notification) => {
    markAsRead(notif.id);
    if (notif.link) {
      setOpen(false);
      setLocation(notif.link);
    }
  }, [markAsRead, setLocation]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-destructive rounded-full px-1 leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notification list */}
        <ScrollArea className="max-h-[400px]">
          {visibleNotifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All caught up</p>
            </div>
          ) : (
            <div className="py-1">
              {visibleNotifications.map(notif => {
                const config = TYPE_CONFIG[notif.type];
                const Icon = config.icon;
                return (
                  <div
                    key={notif.id}
                    className={cn(
                      'relative flex gap-3 px-4 py-3 border-l-2 cursor-pointer transition-colors group',
                      SEVERITY_STYLES[notif.severity],
                      notif.read
                        ? 'bg-transparent hover:bg-muted/50'
                        : 'bg-accent/30 hover:bg-accent/50',
                    )}
                    onClick={() => handleClick(notif)}
                  >
                    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5', config.color, 'bg-muted/50')}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn('text-xs font-semibold', !notif.read && 'text-foreground')}>
                          {notif.title}
                        </span>
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{formatTimeAgo(notif.timestamp)}</p>
                    </div>
                    {/* Dismiss button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); dismiss(notif.id); }}
                      className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                    >
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
