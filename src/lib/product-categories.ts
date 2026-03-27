// Shared End Product category configuration — single source of truth
import {
  Package, RotateCcw, Droplets, Sparkles, Layers, Box, Gift, Building2, CreditCard, Beaker, MoreHorizontal,
} from 'lucide-react';
import type { EndProductCategory } from '@/types';

export const categoryConfig: Record<EndProductCategory, { label: string; icon: React.ElementType; color: string }> = {
  first_time_subscription: { label: '1st Time Subscription', icon: Box, color: 'text-gold' },
  monthly_subscription: { label: 'Monthly Subscription', icon: RotateCcw, color: 'text-info' },
  single_aurakey: { label: 'Single AuraKEY', icon: Package, color: 'text-amber-600' },
  aurakey_refills: { label: 'AuraKEY Refills', icon: Droplets, color: 'text-blue-500' },
  capsule_themed_set: { label: 'Capsule: Themed Set', icon: Sparkles, color: 'text-purple-500' },
  capsule_house_chapter: { label: 'Capsule: House Chapter', icon: Layers, color: 'text-pink-500' },
  capsule_layering_set: { label: 'Capsule: Layering Set', icon: Layers, color: 'text-emerald-500' },
  capsule_scent_story: { label: 'Capsule: Scent Story', icon: Sparkles, color: 'text-violet-500' },
  whisperer_set: { label: 'Whisperer Vials Set', icon: Droplets, color: 'text-cyan-500' },
  gift_set_him: { label: 'Gift Set For Him', icon: Gift, color: 'text-blue-600' },
  gift_set_her: { label: 'Gift Set For Her', icon: Gift, color: 'text-rose-500' },
  gift_set_seasonal: { label: 'Gift Set Seasonal', icon: Gift, color: 'text-amber-500' },
  gift_subscription: { label: 'Gift Subscription', icon: Gift, color: 'text-success' },
  corporate_subscription: { label: 'Corporate Subscription', icon: Building2, color: 'text-slate-600' },
  gift_card: { label: 'Gift Card', icon: CreditCard, color: 'text-yellow-500' },
  one_time_decant: { label: 'One-Time Decant', icon: Beaker, color: 'text-teal-500' },
  other: { label: 'Other', icon: MoreHorizontal, color: 'text-gray-500' },
};
