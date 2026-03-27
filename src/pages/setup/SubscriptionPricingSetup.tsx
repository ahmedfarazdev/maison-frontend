// ============================================================
// Subscription Pricing & Setup — System Setup Module
// Moved from Settings. Single source of truth for subscription config.
// ============================================================

import { useState, useEffect } from 'react';
import { PageHeader, SectionCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  Save, Loader2, ToggleLeft, ToggleRight, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

export default function SubscriptionPricingSetup() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Base pricing
  const [basePrice, setBasePrice] = useState('149.99');
  const [extraVialPrice, setExtraVialPrice] = useState('75');
  const [minVials, setMinVials] = useState('1');
  const [maxVials, setMaxVials] = useState('4');

  // Surcharge tiers (S0-S5) — single source of truth (removed from Pricing Rules)
  const [surchargePerLevel, setSurchargePerLevel] = useState('25');
  const [baseSurchargeTier, setBaseSurchargeTier] = useState('S0');

  // Discounts
  const [annualDiscount, setAnnualDiscount] = useState('20');
  const [refillDiscount, setRefillDiscount] = useState('10');
  const [capsuleDiscount, setCapsuleDiscount] = useState('15');

  // Subscriber perks
  const [vaultAccessFree, setVaultAccessFree] = useState(true);
  const [exchangesPerYear, setExchangesPerYear] = useState('3');
  const [vialCollectionBox, setVialCollectionBox] = useState(true);

  // Whisperer vials
  const [whispererVialsPerMonth, setWhispererVialsPerMonth] = useState('2');
  const [whispererVialSize, setWhispererVialSize] = useState('1');

  // Billing terms
  const [billingTerms, setBillingTerms] = useState<string[]>(['monthly', 'annual']);
  const [pauseEnabled, setPauseEnabled] = useState(true);
  const [skipEnabled, setSkipEnabled] = useState(true);
  const [cancelEnabled, setCancelEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.settings.list();
        const s = Object.fromEntries(res.data.map((r: any) => [r.key, r.value]));
        if (s.sub_base_price) setBasePrice(s.sub_base_price);
        if (s.sub_extra_vial_price) setExtraVialPrice(s.sub_extra_vial_price);
        if (s.sub_min_vials) setMinVials(s.sub_min_vials);
        if (s.sub_max_vials) setMaxVials(s.sub_max_vials);
        if (s.sub_surcharge_per_level) setSurchargePerLevel(s.sub_surcharge_per_level);
        if (s.sub_base_surcharge_tier) setBaseSurchargeTier(s.sub_base_surcharge_tier);
        if (s.sub_annual_discount) setAnnualDiscount(s.sub_annual_discount);
        if (s.sub_refill_discount) setRefillDiscount(s.sub_refill_discount);
        if (s.sub_capsule_discount) setCapsuleDiscount(s.sub_capsule_discount);
        if (s.sub_vault_access_free) setVaultAccessFree(s.sub_vault_access_free === 'true');
        if (s.sub_exchanges_per_year) setExchangesPerYear(s.sub_exchanges_per_year);
        if (s.sub_vial_collection_box) setVialCollectionBox(s.sub_vial_collection_box === 'true');
        if (s.sub_whisperer_vials_per_month) setWhispererVialsPerMonth(s.sub_whisperer_vials_per_month);
        if (s.sub_whisperer_vial_size) setWhispererVialSize(s.sub_whisperer_vial_size);
        if (s.sub_billing_terms) setBillingTerms(JSON.parse(s.sub_billing_terms));
        if (s.sub_pause_enabled) setPauseEnabled(s.sub_pause_enabled === 'true');
        if (s.sub_skip_enabled) setSkipEnabled(s.sub_skip_enabled === 'true');
        if (s.sub_cancel_enabled) setCancelEnabled(s.sub_cancel_enabled === 'true');
      } catch { /* defaults */ }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const pairs: Record<string, string> = {
        sub_base_price: basePrice,
        sub_extra_vial_price: extraVialPrice,
        sub_min_vials: minVials,
        sub_max_vials: maxVials,
        sub_surcharge_per_level: surchargePerLevel,
        sub_base_surcharge_tier: baseSurchargeTier,
        sub_annual_discount: annualDiscount,
        sub_refill_discount: refillDiscount,
        sub_capsule_discount: capsuleDiscount,
        sub_vault_access_free: String(vaultAccessFree),
        sub_exchanges_per_year: exchangesPerYear,
        sub_vial_collection_box: String(vialCollectionBox),
        sub_whisperer_vials_per_month: whispererVialsPerMonth,
        sub_whisperer_vial_size: whispererVialSize,
        sub_billing_terms: JSON.stringify(billingTerms),
        sub_pause_enabled: String(pauseEnabled),
        sub_skip_enabled: String(skipEnabled),
        sub_cancel_enabled: String(cancelEnabled),
      };
      await api.mutations.settings.setBulk(Object.entries(pairs).map(([key, value]) => ({ key, value })));
      toast.success('Subscription Pricing & Setup saved');
    } catch { toast.error('Failed to save'); }
    setSaving(false);
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
          <Button onClick={handleSave} disabled={saving} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All Changes
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Base Subscription Pricing */}
        <SectionCard title="AuraKey Subscription — Base Pricing">
          <p className="text-xs text-muted-foreground mb-4">Core subscription pricing structure. Starts from BASE PRICE per month. Every extra vial adds a flat fee.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Base Price (AED/month)</label>
              <input type="number" step="0.01" value={basePrice} onChange={e => setBasePrice(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Extra Vial Price (AED)</label>
              <input type="number" step="0.01" value={extraVialPrice} onChange={e => setExtraVialPrice(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Min Vials / Month</label>
              <input type="number" min="1" max="10" value={minVials} onChange={e => setMinVials(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Max Vials / Month</label>
              <input type="number" min="1" max="10" value={maxVials} onChange={e => setMaxVials(e.target.value)} className={inputCls} />
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
              <input type="number" step="1" value={surchargePerLevel} onChange={e => setSurchargePerLevel(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Base Surcharge Tier (covered in base)</label>
              <select value={baseSurchargeTier} onChange={e => setBaseSurchargeTier(e.target.value)} className={inputCls}>
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
                const baseIdx = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'].indexOf(baseSurchargeTier);
                const surcharge = idx <= baseIdx ? 0 : (idx - baseIdx) * Number(surchargePerLevel);
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
                <input type="number" min="0" max="50" value={annualDiscount} onChange={e => setAnnualDiscount(e.target.value)} className={inputCls} />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div>
              <label className={labelCls}>AuraKey Refill Discount</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min="0" max="50" value={refillDiscount} onChange={e => setRefillDiscount(e.target.value)} className={inputCls} />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div>
              <label className={labelCls}>AuraKey Capsule Discount</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min="0" max="50" value={capsuleDiscount} onChange={e => setCapsuleDiscount(e.target.value)} className={inputCls} />
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
              <input type="number" min="0" max="5" value={whispererVialsPerMonth} onChange={e => setWhispererVialsPerMonth(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Vial Size (ml)</label>
              <input type="number" min="1" max="5" value={whispererVialSize} onChange={e => setWhispererVialSize(e.target.value)} className={inputCls} />
            </div>
          </div>
        </SectionCard>

        {/* Subscriber Perks — now includes Vial Collection Box */}
        <SectionCard title="Subscriber Perks">
          <p className="text-xs text-muted-foreground mb-4">Perks included with every active AuraKey subscription.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setVaultAccessFree(!vaultAccessFree)} className="text-muted-foreground hover:text-foreground">
                {vaultAccessFree ? <ToggleRight className="w-8 h-5 text-gold" /> : <ToggleLeft className="w-8 h-5" />}
              </button>
              <span className="text-sm">Complimentary Em.Vault Access</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setVialCollectionBox(!vialCollectionBox)} className="text-muted-foreground hover:text-foreground">
                {vialCollectionBox ? <ToggleRight className="w-8 h-5 text-gold" /> : <ToggleLeft className="w-8 h-5" />}
              </button>
              <span className="text-sm">Vial Collection Box (First Order)</span>
            </div>
            <div>
              <label className={labelCls}>Vial Exchanges per Year</label>
              <input type="number" min="0" max="12" value={exchangesPerYear} onChange={e => setExchangesPerYear(e.target.value)} className={inputCls} />
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
                    <input type="checkbox" checked={billingTerms.includes(term)} onChange={e => {
                      if (e.target.checked) setBillingTerms([...billingTerms, term]);
                      else setBillingTerms(billingTerms.filter(t => t !== term));
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
                  { label: 'Pause a month', state: pauseEnabled, setter: setPauseEnabled },
                  { label: 'Skip a month', state: skipEnabled, setter: setSkipEnabled },
                  { label: 'Cancel anytime', state: cancelEnabled, setter: setCancelEnabled },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <button onClick={() => item.setter(!item.state)} className="text-muted-foreground hover:text-foreground">
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
    </div>
  );
}
