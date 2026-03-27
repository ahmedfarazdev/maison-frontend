// ============================================================
// Operational Defaults — Moved from Settings → General tab
// Now lives under System Setup → Operational Defaults
// ============================================================

import { useState, useEffect } from 'react';
import { PageHeader, SectionCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { Save, Loader2, Settings2, Droplets, Package, Truck } from 'lucide-react';
import { toast } from 'sonner';

export default function OperationalDefaults() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Decanting defaults
  const [defaultVialSize, setDefaultVialSize] = useState('3');
  const [defaultSyringeSize, setDefaultSyringeSize] = useState('5');
  const [wastageAllowance, setWastageAllowance] = useState('5');

  // Packaging defaults
  const [defaultBoxType, setDefaultBoxType] = useState('standard');
  const [includeInfoCard, setIncludeInfoCard] = useState(true);
  const [includeSampleVial, setIncludeSampleVial] = useState(false);

  // Shipping defaults
  const [defaultShippingCompany, setDefaultShippingCompany] = useState('aramex');
  const [defaultShippingMethod, setDefaultShippingMethod] = useState('standard');
  const [autoGenerateLabel, setAutoGenerateLabel] = useState(true);

  // Load settings
  useEffect(() => {
    (async () => {
      try {
        const settings = await api.settings.list();
        const map = new Map(settings.map((s: any) => [s.key, s.value]));
        if (map.has('default_vial_size')) setDefaultVialSize(map.get('default_vial_size')!);
        if (map.has('default_syringe_size')) setDefaultSyringeSize(map.get('default_syringe_size')!);
        if (map.has('wastage_allowance')) setWastageAllowance(map.get('wastage_allowance')!);
        if (map.has('default_box_type')) setDefaultBoxType(map.get('default_box_type')!);
        if (map.has('include_info_card')) setIncludeInfoCard(map.get('include_info_card') === 'true');
        if (map.has('include_sample_vial')) setIncludeSampleVial(map.get('include_sample_vial') === 'true');
        if (map.has('default_shipping_company')) setDefaultShippingCompany(map.get('default_shipping_company')!);
        if (map.has('default_shipping_method')) setDefaultShippingMethod(map.get('default_shipping_method')!);
        if (map.has('auto_generate_label')) setAutoGenerateLabel(map.get('auto_generate_label') === 'true');
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
        { key: 'default_vial_size', value: defaultVialSize, description: 'Default vial size in ml' },
        { key: 'default_syringe_size', value: defaultSyringeSize, description: 'Default syringe size in ml' },
        { key: 'wastage_allowance', value: wastageAllowance, description: 'Wastage allowance percentage for decanting' },
        { key: 'default_box_type', value: defaultBoxType, description: 'Default packaging box type' },
        { key: 'include_info_card', value: String(includeInfoCard), description: 'Include info card in packaging by default' },
        { key: 'include_sample_vial', value: String(includeSampleVial), description: 'Include sample vial in packaging by default' },
        { key: 'default_shipping_company', value: defaultShippingCompany, description: 'Default shipping company' },
        { key: 'default_shipping_method', value: defaultShippingMethod, description: 'Default shipping method' },
        { key: 'auto_generate_label', value: String(autoGenerateLabel), description: 'Auto-generate shipping labels' },
      ]);
      toast.success('Operational defaults saved');
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
        title="Operational Defaults"
        subtitle="Default values for decanting, packaging, and shipping operations — applied automatically to new jobs"
      />

      {/* Decanting Defaults */}
      <SectionCard title="Decanting Defaults" subtitle="Standard values applied when creating new decanting tasks">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5" /> Default Vial Size (ml)
            </label>
            <select
              value={defaultVialSize}
              onChange={e => setDefaultVialSize(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            >
              <option value="2">2 ml</option>
              <option value="3">3 ml</option>
              <option value="5">5 ml</option>
              <option value="8">8 ml</option>
              <option value="10">10 ml</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Default Syringe Size (ml)</label>
            <select
              value={defaultSyringeSize}
              onChange={e => setDefaultSyringeSize(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            >
              <option value="3">3 ml</option>
              <option value="5">5 ml</option>
              <option value="10">10 ml</option>
              <option value="20">20 ml</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Wastage Allowance (%)</label>
            <input
              type="number"
              min={0}
              max={20}
              value={wastageAllowance}
              onChange={e => setWastageAllowance(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Extra ml allocated per decant to account for spillage</p>
          </div>
        </div>
      </SectionCard>

      {/* Packaging Defaults */}
      <SectionCard title="Packaging Defaults" subtitle="Standard packaging configuration for new fulfillment jobs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Default Box Type
            </label>
            <select
              value={defaultBoxType}
              onChange={e => setDefaultBoxType(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            >
              <option value="standard">Standard Box</option>
              <option value="premium">Premium Box</option>
              <option value="gift">Gift Box</option>
              <option value="capsule">Capsule Box</option>
            </select>
          </div>
          <div className="flex flex-col justify-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeInfoCard}
                onChange={e => setIncludeInfoCard(e.target.checked)}
                className="w-4 h-4 rounded border-input accent-gold"
              />
              <span className="text-sm">Include info card by default</span>
            </label>
            <p className="text-[11px] text-muted-foreground mt-1">Perfume notes card included in each box</p>
          </div>
          <div className="flex flex-col justify-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSampleVial}
                onChange={e => setIncludeSampleVial(e.target.checked)}
                className="w-4 h-4 rounded border-input accent-gold"
              />
              <span className="text-sm">Include sample vial by default</span>
            </label>
            <p className="text-[11px] text-muted-foreground mt-1">Bonus sample vial added to each order</p>
          </div>
        </div>
      </SectionCard>

      {/* Shipping Defaults */}
      <SectionCard title="Shipping Defaults" subtitle="Default shipping configuration for dispatch operations">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" /> Default Shipping Company
            </label>
            <select
              value={defaultShippingCompany}
              onChange={e => setDefaultShippingCompany(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            >
              <option value="aramex">Aramex</option>
              <option value="dhl">DHL</option>
              <option value="fedex">FedEx</option>
              <option value="emirates_post">Emirates Post</option>
              <option value="smsa">SMSA Express</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Default Shipping Method</label>
            <select
              value={defaultShippingMethod}
              onChange={e => setDefaultShippingMethod(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            >
              <option value="standard">Standard (2-3 days)</option>
              <option value="express">Express (next day)</option>
              <option value="same_day">Same Day</option>
            </select>
          </div>
          <div className="flex flex-col justify-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoGenerateLabel}
                onChange={e => setAutoGenerateLabel(e.target.checked)}
                className="w-4 h-4 rounded border-input accent-gold"
              />
              <span className="text-sm">Auto-generate shipping labels</span>
            </label>
            <p className="text-[11px] text-muted-foreground mt-1">Automatically create labels when orders reach shipping stage</p>
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
          Save Operational Defaults
        </Button>
      </div>
    </div>
  );
}
