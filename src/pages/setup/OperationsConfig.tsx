// ============================================================
// Operations Config — Moved from Settings → Operations tab
// Now lives under System Setup → Operations Config
// ============================================================

import { useState, useEffect } from 'react';
import { PageHeader, SectionCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { SETTINGS_KEYS } from '@/lib/settings-keys';
import { Clock, Save, Loader2, CalendarDays, Truck, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function OperationsConfig() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // One-time order cut-off
  const [cutoffStart, setCutoffStart] = useState('09:00');
  const [cutoffEnd, setCutoffEnd] = useState('21:00');
  const [packLeadDays, setPackLeadDays] = useState('1');
  const [deliveryLeadDays, setDeliveryLeadDays] = useState('2');

  // Subscription cycle settings
  const [cycleDays, setCycleDays] = useState('7,14,21,28');
  const [cycleDeliveryLeadDays, setCycleDeliveryLeadDays] = useState('7');
  const [cyclesPerMonth, setCyclesPerMonth] = useState('4');
  const [cycleProcessingDays, setCycleProcessingDays] = useState('5');

  // Load settings from DB
  useEffect(() => {
    (async () => {
      try {
        const settings = await api.settings.list();
        const map = new Map(settings.data.map((s: any) => [s.key, s.value]));
        if (map.has(SETTINGS_KEYS.CUTOFF_START)) setCutoffStart(map.get(SETTINGS_KEYS.CUTOFF_START)!);
        if (map.has(SETTINGS_KEYS.CUTOFF_END)) setCutoffEnd(map.get(SETTINGS_KEYS.CUTOFF_END)!);
        if (map.has(SETTINGS_KEYS.PACK_LEAD_DAYS)) setPackLeadDays(map.get(SETTINGS_KEYS.PACK_LEAD_DAYS)!);
        if (map.has(SETTINGS_KEYS.DELIVERY_LEAD_DAYS)) setDeliveryLeadDays(map.get(SETTINGS_KEYS.DELIVERY_LEAD_DAYS)!);
        if (map.has(SETTINGS_KEYS.CYCLE_CUTOFF_DAYS)) setCycleDays(map.get(SETTINGS_KEYS.CYCLE_CUTOFF_DAYS)!);
        if (map.has(SETTINGS_KEYS.CYCLE_DELIVERY_LEAD_DAYS)) setCycleDeliveryLeadDays(map.get(SETTINGS_KEYS.CYCLE_DELIVERY_LEAD_DAYS)!);
        if (map.has(SETTINGS_KEYS.CYCLES_PER_MONTH)) setCyclesPerMonth(map.get(SETTINGS_KEYS.CYCLES_PER_MONTH)!);
        if (map.has(SETTINGS_KEYS.CYCLE_PROCESSING_DAYS)) setCycleProcessingDays(map.get(SETTINGS_KEYS.CYCLE_PROCESSING_DAYS)!);
      } catch (e) {
        console.warn('Failed to load settings', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.mutations.settings.setBulk([
        { key: SETTINGS_KEYS.CUTOFF_START, value: cutoffStart, description: 'Daily order cut-off start time (HH:mm)' },
        { key: SETTINGS_KEYS.CUTOFF_END, value: cutoffEnd, description: 'Daily order cut-off end time (HH:mm)' },
        { key: SETTINGS_KEYS.PACK_LEAD_DAYS, value: packLeadDays, description: 'Days after cut-off to pack orders' },
        { key: SETTINGS_KEYS.DELIVERY_LEAD_DAYS, value: deliveryLeadDays, description: 'Days after cut-off to deliver orders' },
        { key: SETTINGS_KEYS.CYCLE_CUTOFF_DAYS, value: cycleDays, description: 'Subscription cycle cut-off days of month (comma-separated)' },
        { key: SETTINGS_KEYS.CYCLE_DELIVERY_LEAD_DAYS, value: cycleDeliveryLeadDays, description: 'Days after cycle cut-off to deliver subscription orders' },
        { key: SETTINGS_KEYS.CYCLES_PER_MONTH, value: cyclesPerMonth, description: 'Number of subscription cycles per month' },
        { key: SETTINGS_KEYS.CYCLE_PROCESSING_DAYS, value: cycleProcessingDays, description: 'Days to process a subscription cycle (picking through shipping)' },
      ]);
      toast.success('Operations settings saved');
    } catch (e: any) {
      toast.error(`Failed to save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Config"
        subtitle="Configure order cut-off windows, subscription cycle timelines, and fulfillment lead times"
      />

      {/* One-Time Order Cut-off */}
      <SectionCard title="One-Time Orders Cut-Off Time Window" subtitle="Configure daily order collection windows and fulfillment timelines">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Cut-off Start Time</label>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <input
                type="time"
                value={cutoffStart}
                onChange={e => setCutoffStart(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Orders received after this time start a new batch window</p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Cut-off End Time</label>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <input
                type="time"
                value={cutoffEnd}
                onChange={e => setCutoffEnd(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Orders received before this time are included in today's batch</p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Pack Lead (Days After Cut-off)</label>
            <input
              type="number"
              min={0}
              max={7}
              value={packLeadDays}
              onChange={e => setPackLeadDays(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Orders packed this many days after cut-off (e.g., 1 = next day)</p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Delivery Lead (Days After Cut-off)</label>
            <input
              type="number"
              min={0}
              max={14}
              value={deliveryLeadDays}
              onChange={e => setDeliveryLeadDays(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Orders delivered this many days after cut-off (e.g., 2 = day after packing)</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-muted/30 rounded-md border border-border">
          <p className="text-xs font-medium text-muted-foreground mb-1">Example Timeline</p>
          <p className="text-sm">
            Orders from <span className="font-mono font-semibold text-gold">{cutoffStart}</span> to{' '}
            <span className="font-mono font-semibold text-gold">{cutoffEnd}</span> →{' '}
            Packed <span className="font-semibold">{packLeadDays} day(s)</span> later →{' '}
            Delivered <span className="font-semibold">{deliveryLeadDays} day(s)</span> after cut-off
          </p>
        </div>
      </SectionCard>

      {/* Subscription Cycle Settings */}
      <SectionCard title="Subscription Cut-Off Time Window" subtitle="Configure monthly subscription cycle cut-off dates, processing windows, and delivery timelines">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Cycles Per Month</label>
            <input
              type="number"
              min={1}
              max={8}
              value={cyclesPerMonth}
              onChange={e => setCyclesPerMonth(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Cut-off Days of Month</label>
            <input
              type="text"
              value={cycleDays}
              onChange={e => setCycleDays(e.target.value)}
              placeholder="7,14,21,28"
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Comma-separated days (e.g., 7,14,21,28)</p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Processing Window (Days)</label>
            <input
              type="number"
              min={1}
              max={14}
              value={cycleProcessingDays}
              onChange={e => setCycleProcessingDays(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Days to process cycle (picking → decanting → fulfillment)</p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Delivery Lead (Days After Cycle Cut-off)</label>
            <input
              type="number"
              min={1}
              max={14}
              value={cycleDeliveryLeadDays}
              onChange={e => setCycleDeliveryLeadDays(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Delivery starts this many days after cycle cut-off</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-muted/30 rounded-md border border-border">
          <p className="text-xs font-medium text-muted-foreground mb-1">Cycle Schedule Preview</p>
          <div className="flex flex-wrap gap-3 mt-2">
            {cycleDays.split(',').map((day, i) => {
              const d = parseInt(day.trim());
              if (isNaN(d)) return null;
              const deliveryDay = d + parseInt(cycleDeliveryLeadDays || '7');
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-gold/20 text-gold flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </div>
                  <span>Cut-off: <span className="font-mono font-semibold">{d}th</span></span>
                  <span className="text-muted-foreground">→</span>
                  <span>Deliver: <span className="font-mono font-semibold">{deliveryDay > 28 ? `${deliveryDay - 28}th (next mo.)` : `${deliveryDay}th`}</span></span>
                </div>
              );
            })}
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Operations Settings
        </Button>
      </div>
    </div>
  );
}
