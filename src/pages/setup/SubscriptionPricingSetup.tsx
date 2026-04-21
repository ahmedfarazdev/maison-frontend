// ============================================================
// Subscription Pricing & Setup — System Setup Module
// Moved from Settings. Single source of truth for subscription config.
// ============================================================

import { useState, useEffect } from 'react';
import { PageHeader, SectionCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Save, Loader2, ToggleLeft, ToggleRight, Info, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import PropagationOverlay from '@/components/master/PropagationOverlay';

interface SubscriptionSettings {
  basePrice: string;
  extraVialPrice: string;
  minVials: string;
  maxVials: string;
  surchargePerLevel: string;
  baseSurchargeTier: string;
  annualDiscount: string;
  refillDiscount: string;
  capsuleDiscount: string;
  vaultAccessFree: boolean;
  exchangesPerYear: string;
  vialCollectionBox: boolean;
  whispererVialsPerMonth: string;
  whispererVialSize: string;
  billingTerms: string[];
  pauseEnabled: boolean;
  skipEnabled: boolean;
  cancelEnabled: boolean;
}

const INITIAL_EMPTY_STATE: SubscriptionSettings = {
  basePrice: '',
  extraVialPrice: '',
  minVials: '',
  maxVials: '',
  surchargePerLevel: '',
  baseSurchargeTier: 'S0',
  annualDiscount: '',
  refillDiscount: '',
  capsuleDiscount: '',
  vaultAccessFree: true,
  exchangesPerYear: '',
  vialCollectionBox: true,
  whispererVialsPerMonth: '',
  whispererVialSize: '',
  billingTerms: ['monthly', 'annual'],
  pauseEnabled: true,
  skipEnabled: true,
  cancelEnabled: true,
};

export default function SubscriptionPricingSetup() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPropagation, setShowPropagation] = useState(false);
  const [propagationTrigger, setPropagationTrigger] = useState('');

  // Primary state object - replaces individual usestates
  const [formData, setFormData] = useState<SubscriptionSettings>(INITIAL_EMPTY_STATE);
  const [pristineData, setPristineData] = useState<SubscriptionSettings>(INITIAL_EMPTY_STATE);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.subscriptionPricing.get();
        const s = res.data;
        if (s) {
          const hydrated: SubscriptionSettings = {
            basePrice: String(s.basePrice ?? ''),
            extraVialPrice: String(s.extraVialPrice ?? ''),
            minVials: String(s.minVials ?? ''),
            maxVials: String(s.maxVials ?? ''),
            surchargePerLevel: String(s.surchargePerLevel ?? ''),
            baseSurchargeTier: s.baseSurchargeTier ?? 'S0',
            annualDiscount: String(s.annualDiscount ?? ''),
            refillDiscount: String(s.refillDiscount ?? ''),
            capsuleDiscount: String(s.capsuleDiscount ?? ''),
            vaultAccessFree: Boolean(s.vaultAccessFree),
            exchangesPerYear: String(s.exchangesPerYear ?? ''),
            vialCollectionBox: Boolean(s.vialCollectionBox),
            whispererVialsPerMonth: String(s.whispererVialsPerMonth ?? ''),
            whispererVialSize: String(s.whispererVialSize ?? ''),
            billingTerms: Array.isArray(s.billingTerms) ? s.billingTerms : ['monthly', 'annual'],
            pauseEnabled: Boolean(s.pauseEnabled),
            skipEnabled: Boolean(s.skipEnabled),
            cancelEnabled: Boolean(s.cancelEnabled),
          };
          setFormData(hydrated);
          setPristineData(hydrated);
        }
      } catch (err: any) {
        if (err?.response?.status === 404) {
          console.log('[Setup] No existing settings found. Initializing with empty state.');
        } else {
          console.error('Failed to fetch pricing settings:', err);
          toast.error('Failed to load settings. Please refresh the page.');
        }
      }
      setLoading(false);
    })();
  }, []);

  const updateField = (field: keyof SubscriptionSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const toNumber = (value: string, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    setSaving(true);
    try {
      const payload = {
        basePrice: toNumber(formData.basePrice),
        extraVialPrice: toNumber(formData.extraVialPrice),
        minVials: toNumber(formData.minVials),
        maxVials: toNumber(formData.maxVials),
        surchargePerLevel: toNumber(formData.surchargePerLevel),
        baseSurchargeTier: formData.baseSurchargeTier,
        annualDiscount: toNumber(formData.annualDiscount),
        refillDiscount: toNumber(formData.refillDiscount),
        capsuleDiscount: toNumber(formData.capsuleDiscount),
        vaultAccessFree: formData.vaultAccessFree,
        exchangesPerYear: toNumber(formData.exchangesPerYear),
        vialCollectionBox: formData.vialCollectionBox,
        whispererVialsPerMonth: toNumber(formData.whispererVialsPerMonth),
        whispererVialSize: toNumber(formData.whispererVialSize),
        billingTerms: formData.billingTerms,
        pauseEnabled: formData.pauseEnabled,
        skipEnabled: formData.skipEnabled,
        cancelEnabled: formData.cancelEnabled,
      };
      console.log('[Setup] Final Save Payload:', JSON.stringify(payload, null, 2));
      await api.subscriptionPricing.update(payload);
      toast.success('Subscription Pricing & Setup saved');

      // Check if we need to propagate
      if (
        formData.surchargePerLevel !== pristineData.surchargePerLevel || 
        formData.baseSurchargeTier !== pristineData.baseSurchargeTier
      ) {
        setPropagationTrigger('Surcharge Settings Update');
        setShowPropagation(true);
        setPristineData(formData);
      }
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const handleManualPropagate = async () => {
    try {
      await api.subscriptionPricing.propagate();
      setPropagationTrigger('Manual Recalculation');
      setShowPropagation(true);
    } catch {
      toast.error('Failed to start recalculation');
    }
  };

  const inputCls = 'mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30';
  const labelCls = 'text-xs uppercase tracking-wider text-muted-foreground font-medium';

  if (loading) return (
    <div>
      <PageHeader
        title="Subscription Pricing & Setup"
        subtitle="AuraKey subscription configuration — pricing, surcharges, perks, billing"
        breadcrumbs={[{ label: 'System Setup' }, { label: 'Subscription Pricing & Setup' }]}
      />
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Subscription Pricing & Setup"
        subtitle="AuraKey subscription configuration — pricing, surcharges, perks, billing"
        breadcrumbs={[{ label: 'System Setup' }, { label: 'Subscription Pricing & Setup' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={handleManualPropagate} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Recalculate All Prices
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save All Changes
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Base Subscription Pricing */}
        <SectionCard title="AuraKey Subscription — Base Pricing">
          <p className="text-xs text-muted-foreground mb-4">Core subscription pricing structure. Starts from BASE PRICE per month. Every extra vial adds a flat fee.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Base Price (AED/month)</label>
              <input type="number" step="0.01" disabled={saving} value={formData.basePrice} onChange={e => updateField('basePrice', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Extra Vial Price (AED)</label>
              <input type="number" step="0.01" disabled={saving} value={formData.extraVialPrice} onChange={e => updateField('extraVialPrice', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Min Vials / Month</label>
              <input type="number" min="1" max="10" disabled={saving} value={formData.minVials} onChange={e => updateField('minVials', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Max Vials / Month</label>
              <input type="number" min="1" max="10" disabled={saving} value={formData.maxVials} onChange={e => updateField('maxVials', e.target.value)} className={inputCls} />
            </div>
          </div>
        </SectionCard>

        {/* Premium Surcharge — SINGLE SOURCE OF TRUTH */}
        <SectionCard title="Premium Surcharge (S-Tiers)">
          <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-gold/5 border border-gold/20">
            <Info className="w-4 h-4 text-gold shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Single source of truth.</span> Surcharge tiers configured here apply across the entire system — subscription pricing, à la carte, and capsule surcharges. The Pricing Rules page references these values.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelCls}>Surcharge per S-Level (AED)</label>
              <input 
                key={`surcharge-${formData.surchargePerLevel}`}
                type="number" 
                step="1" 
                disabled={saving}
                value={formData.surchargePerLevel} 
                onChange={e => updateField('surchargePerLevel', e.target.value)} 
                className={inputCls} 
              />
            </div>
            <div>
              <label className={labelCls}>Base Surcharge Tier (covered in base)</label>
              <select disabled={saving} value={formData.baseSurchargeTier} onChange={e => updateField('baseSurchargeTier', e.target.value)} className={inputCls}>
                {['S0', 'S1', 'S2', 'S3', 'S4', 'S5'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 text-xs uppercase text-muted-foreground">Tier</th>
                <th className="text-right py-2 text-xs uppercase text-muted-foreground">Surcharge (AED)</th>
              </tr>
            </thead>
            <tbody>
              {['S0', 'S1', 'S2', 'S3', 'S4', 'S5'].map((tier, idx) => {
                const baseIdx = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'].indexOf(formData.baseSurchargeTier);
                const surcharge = idx <= baseIdx ? 0 : (idx - baseIdx) * Number(formData.surchargePerLevel || 0);
                return (
                  <tr key={tier} className="border-b border-border/30">
                    <td className="py-2 font-mono text-xs">{tier}</td>
                    <td className="py-2 text-right font-mono text-xs">
                      {surcharge === 0 ? <span className="text-emerald-500">Included</span> : <span>+{surcharge} AED</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SectionCard>

        {/* Subscriber Discounts */}
        <SectionCard title="Subscriber Discounts">
          <p className="text-xs text-muted-foreground mb-4">All active subscribers receive these discounts across the Maison Em ecosystem.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Annual Discount (paid in full)</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min="0" max="50" disabled={saving} value={formData.annualDiscount} onChange={e => updateField('annualDiscount', e.target.value)} className={inputCls} />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div>
              <label className={labelCls}>AuraKey Refill Discount</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min="0" max="50" disabled={saving} value={formData.refillDiscount} onChange={e => updateField('refillDiscount', e.target.value)} className={inputCls} />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div>
              <label className={labelCls}>AuraKey Capsule Discount</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min="0" max="50" disabled={saving} value={formData.capsuleDiscount} onChange={e => updateField('capsuleDiscount', e.target.value)} className={inputCls} />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Whisperer Vials */}
        <SectionCard title="The Whisperer Vials (House Selection)">
          <p className="text-xs text-muted-foreground mb-4">Monthly recurring orders include house-selected 2ml Whisperer vials as a calibration tool for the Taste Graph.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Whisperer Vials per Month</label>
              <input type="number" min="0" max="5" disabled={saving} value={formData.whispererVialsPerMonth} onChange={e => updateField('whispererVialsPerMonth', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Vial Size (ml)</label>
              <input type="number" min="1" max="5" disabled={saving} value={formData.whispererVialSize} onChange={e => updateField('whispererVialSize', e.target.value)} className={inputCls} />
            </div>
          </div>
        </SectionCard>

        {/* Subscriber Perks — now includes Vial Collection Box */}
        <SectionCard title="Subscriber Perks">
          <p className="text-xs text-muted-foreground mb-4">Perks included with every active AuraKey subscription.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <button disabled={saving} onClick={() => updateField('vaultAccessFree', !formData.vaultAccessFree)} className="text-muted-foreground hover:text-foreground disabled:opacity-50">
                {formData.vaultAccessFree ? <ToggleRight className="w-8 h-5 text-gold" /> : <ToggleLeft className="w-8 h-5" />}
              </button>
              <span className="text-sm">Complimentary Em.Vault Access</span>
            </div>
            <div className="flex items-center gap-3">
              <button disabled={saving} onClick={() => updateField('vialCollectionBox', !formData.vialCollectionBox)} className="text-muted-foreground hover:text-foreground disabled:opacity-50">
                {formData.vialCollectionBox ? <ToggleRight className="w-8 h-5 text-gold" /> : <ToggleLeft className="w-8 h-5" />}
              </button>
              <span className="text-sm">Vial Collection Box (First Order)</span>
            </div>
            <div>
              <label className={labelCls}>Vial Exchanges per Year</label>
              <input type="number" min="0" max="12" disabled={saving} value={formData.exchangesPerYear} onChange={e => updateField('exchangesPerYear', e.target.value)} className={inputCls} />
            </div>
          </div>
        </SectionCard>

        {/* Billing & Flexibility */}
        <SectionCard title="Billing & Flexibility">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Billing Terms</label>
              <div className="flex gap-3 mt-2">
                {['monthly', 'annual'].map(term => (
                  <label key={term} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={formData.billingTerms.includes(term)} onChange={e => {
                      if (e.target.checked) updateField('billingTerms', [...formData.billingTerms, term]);
                      else updateField('billingTerms', formData.billingTerms.filter(t => t !== term));
                    }} className="rounded border-input" />
                    <span className="capitalize">{term}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className={labelCls}>Subscriber Controls</label>
              <div className="flex flex-col gap-2 mt-2">
                {[
                  { label: 'Pause a month', state: formData.pauseEnabled, field: 'pauseEnabled' as const },
                  { label: 'Skip a month', state: formData.skipEnabled, field: 'skipEnabled' as const },
                  { label: 'Cancel anytime', state: formData.cancelEnabled, field: 'cancelEnabled' as const },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <button onClick={() => updateField(item.field, !item.state)} className="text-muted-foreground hover:text-foreground">
                      {item.state ? <ToggleRight className="w-7 h-4 text-gold" /> : <ToggleLeft className="w-7 h-4" />}
                    </button>
                    <span className="text-sm">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Annual: all applies T&C. Pause, Skip, Cancel available per billing term rules.</p>
        </SectionCard>

        {/* Save (bottom) */}
        <div className="flex justify-end pb-4">
          <Button onClick={handleSave} disabled={saving} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All Changes
          </Button>
        </div>
      </div>

      <PropagationOverlay
        open={showPropagation}
        onClose={() => setShowPropagation(false)}
        ruleName={propagationTrigger}
      />
    </div>
  );
}
