// ============================================================
// Order Definitions — System Setup
// Configure order types, statuses, and workflow rules
// ============================================================
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared';
import { toast } from 'sonner';
import {
  ShoppingCart, RotateCcw, Gift, Briefcase, ChevronRight, Settings,
} from 'lucide-react';

const ORDER_TYPES = [
  {
    id: 'one_time',
    name: 'One-Time Order',
    icon: ShoppingCart,
    description: 'Single purchase order — customer selects perfumes, pays once, receives one shipment.',
    statuses: ['pending', 'confirmed', 'in_production', 'quality_check', 'ready_to_ship', 'shipped', 'delivered'],
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    active: true,
  },
  {
    id: 'subscription',
    name: 'Subscription Order',
    icon: RotateCcw,
    description: 'Recurring order on a 7-day cycle. Initial order treated as one-time within the subscription space. Subsequent cycles auto-generate.',
    statuses: ['pending', 'confirmed', 'cycle_queued', 'in_production', 'quality_check', 'ready_to_ship', 'shipped', 'delivered'],
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    active: true,
  },
  {
    id: 'gift',
    name: 'Gift Order',
    icon: Gift,
    description: 'Gift purchase — can be one-time or subscription gifted to a recipient. Includes gift wrapping and personalization options.',
    statuses: ['pending', 'confirmed', 'in_production', 'gift_wrapping', 'quality_check', 'ready_to_ship', 'shipped', 'delivered'],
    color: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    active: true,
  },
  {
    id: 'corporate',
    name: 'Corporate / Bulk',
    icon: Briefcase,
    description: 'B2B bulk orders for corporate gifting, events, or wholesale. Custom pricing and MOQ apply.',
    statuses: ['inquiry', 'quoted', 'confirmed', 'in_production', 'quality_check', 'ready_to_ship', 'shipped', 'delivered'],
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    active: true,
  },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  confirmed: 'bg-blue-500/20 text-blue-300',
  in_production: 'bg-purple-500/20 text-purple-300',
  cycle_queued: 'bg-indigo-500/20 text-indigo-300',
  quality_check: 'bg-cyan-500/20 text-cyan-300',
  gift_wrapping: 'bg-pink-500/20 text-pink-300',
  ready_to_ship: 'bg-emerald-500/20 text-emerald-300',
  shipped: 'bg-teal-500/20 text-teal-300',
  delivered: 'bg-green-500/20 text-green-300',
  inquiry: 'bg-orange-500/20 text-orange-300',
  quoted: 'bg-amber-500/20 text-amber-300',
};

export default function OrderDefinitions() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order Definitions"
        subtitle="Configure order types, status workflows, and processing rules"
        breadcrumbs={[{ label: 'System Setup' }, { label: 'Order Definitions' }]}
      />

      <div className="grid gap-4">
        {ORDER_TYPES.map(type => {
          const Icon = type.icon;
          const isExpanded = expanded === type.id;
          return (
            <Card
              key={type.id}
              className={`bg-card/60 border-border/50 cursor-pointer transition-all hover:border-gold/30 ${isExpanded ? 'border-gold/40' : ''}`}
              onClick={() => setExpanded(isExpanded ? null : type.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl ${type.color} border`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-foreground">{type.name}</h3>
                      <Badge variant="outline" className={type.active ? 'bg-green-500/10 text-green-400 border-green-500/30 text-[9px]' : 'text-[9px]'}>
                        {type.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{type.description}</p>

                    {isExpanded && (
                      <div className="mt-4 space-y-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status Workflow</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {type.statuses.map((status, i) => (
                            <div key={status} className="flex items-center gap-1.5">
                              <Badge variant="outline" className={`text-[9px] px-2 py-0.5 ${STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground'}`}>
                                {status.replace(/_/g, ' ')}
                              </Badge>
                              {i < type.statuses.length - 1 && (
                                <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={(e) => { e.stopPropagation(); toast.info('Status workflow editor coming soon'); }}>
                            <Settings className="w-3 h-3" /> Edit Workflow
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/10 border-border/30">
        <CardContent className="py-6 text-center">
          <p className="text-xs text-muted-foreground">
            Order definitions control how orders flow through the system. Subscription orders use 7-day cycles — the initial order is treated as a one-time order within the subscription space.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
