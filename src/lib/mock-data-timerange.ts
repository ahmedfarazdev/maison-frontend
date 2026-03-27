// ============================================================
// Time-Range Aware Mock Data Generator
// Produces realistic variance in KPIs/pipeline/alerts per period
// ============================================================

import type {
  DashboardKPIs, PipelineStage, InventoryAlert, CriticalPerfume,
} from '@/types';

// Seed-based pseudo-random for deterministic results per range
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// Scale factor based on how many days the range covers
function daysBetween(from: string, to: string): number {
  const f = new Date(from).getTime();
  const t = new Date(to).getTime();
  return Math.max(1, Math.ceil((t - f) / (1000 * 60 * 60 * 24)));
}

export function generateKPIsForRange(from: string, to: string): DashboardKPIs {
  const days = daysBetween(from, to);
  const seed = hashString(`${from}-${to}-kpis`);
  const rand = seededRandom(seed);

  // Scale orders roughly by days, with some randomness
  const baseNew = Math.max(1, Math.round((3 * days / 1) * (0.7 + rand() * 0.6)));
  const baseInProgress = Math.max(1, Math.round((5 * days / 1) * (0.5 + rand() * 0.5)));
  const basePacked = Math.max(0, Math.round((2 * days / 1) * (0.6 + rand() * 0.8)));
  const baseShipped = Math.max(1, Math.round((8 * days / 1) * (0.5 + rand() * 0.6)));

  const subOrders = Math.max(4, Math.round(24 * (0.8 + rand() * 0.4)));

  const batchPending = Math.max(0, Math.round((2 * days / 1) * (0.4 + rand() * 0.6)));
  const batchActive = Math.max(0, Math.round((1 * days / 1) * (0.5 + rand() * 0.5)));
  const batchDone = Math.max(1, Math.round((4 * days / 1) * (0.6 + rand() * 0.8)));

  const pickup = Math.max(0, Math.round((3 * days / 1) * (0.3 + rand() * 0.7)));

  // Extended KPIs
  const fbPending = Math.max(0, Math.round((2 * days / 1) * (0.3 + rand() * 0.7)));
  const fbInProgress = Math.max(0, Math.round((1 * days / 1) * (0.4 + rand() * 0.6)));
  const fbPacked = Math.max(0, Math.round((1 * days / 1) * (0.3 + rand() * 0.5)));
  const fbShipped = Math.max(0, Math.round((2 * days / 1) * (0.4 + rand() * 0.6)));

  const revOneTime = Math.round((baseNew + baseInProgress + basePacked + baseShipped) * (85 + rand() * 60));
  const revSub = Math.round(subOrders * (35 + rand() * 40));
  const revFB = Math.round((fbPending + fbInProgress + fbPacked + fbShipped) * (280 + rand() * 200));

  const totalCustomers = Math.max(8, Math.round((12 * days) * (0.5 + rand() * 0.5)));
  const newCustomers = Math.max(1, Math.round(totalCustomers * (0.15 + rand() * 0.2)));

  return {
    one_time_orders: {
      new: baseNew,
      in_progress: baseInProgress,
      packed: basePacked,
      shipped: baseShipped,
    },
    subscription: {
      active_cycle_cutoff: '2025-02-14',
      days_left: 7,
      orders_count: subOrders,
    },
    decant_batches: {
      pending: batchPending,
      in_progress: batchActive,
      completed: batchDone,
    },
    shipping: {
      ready_for_pickup: pickup,
    },
    full_bottles: {
      pending: fbPending,
      in_progress: fbInProgress,
      packed: fbPacked,
      shipped: fbShipped,
    },
    revenue: {
      total_aed: revOneTime + revSub + revFB,
      subscription_aed: revSub,
      one_time_aed: revOneTime,
      full_bottle_aed: revFB,
    },
    customers: {
      total: totalCustomers,
      new_this_period: newCustomers,
      returning: totalCustomers - newCustomers,
    },
    inventory: {
      total_bottles: Math.max(10, Math.round(45 + rand() * 30)),
      total_ml: Math.max(200, Math.round(2800 + rand() * 1500)),
      low_stock_count: Math.max(0, Math.round(rand() * 5)),
    },
  };
}

export function generatePipelineForRange(from: string, to: string): PipelineStage[] {
  const days = daysBetween(from, to);
  const seed = hashString(`${from}-${to}-pipeline`);
  const rand = seededRandom(seed);

  return [
    { stage: 'Orders In', count: Math.max(1, Math.round((3 * days) * (0.6 + rand() * 0.8))) },
    { stage: 'Picked', count: Math.max(1, Math.round((5 * days) * (0.5 + rand() * 0.6))) },
    { stage: 'Prepped', count: Math.max(1, Math.round((4 * days) * (0.5 + rand() * 0.7))) },
    { stage: 'Decanted', count: Math.max(0, Math.round((2 * days) * (0.4 + rand() * 0.8))) },
    { stage: 'Packed', count: Math.max(0, Math.round((2 * days) * (0.5 + rand() * 0.6))) },
    { stage: 'Shipped', count: Math.max(1, Math.round((8 * days) * (0.4 + rand() * 0.7))) },
  ];
}

export function generateAlertsForRange(from: string, to: string): InventoryAlert[] {
  const days = daysBetween(from, to);
  const seed = hashString(`${from}-${to}-alerts`);
  const rand = seededRandom(seed);

  const allAlerts: InventoryAlert[] = [
    { id: 'alert_01', type: 'low_ml', severity: 'critical', message: 'Tobacco Vanille (DEC-002) — only 18ml remaining', created_at: from },
    { id: 'alert_02', type: 'low_packaging', severity: 'warning', message: '5ml Labels (PKG-LBL-5ML) — only 8 sheets left', created_at: from },
    { id: 'alert_03', type: 'cutoff', severity: 'info', message: 'Subscription cutoff in 7 days (Feb 14)', created_at: from },
    { id: 'alert_04', type: 'stuck_order', severity: 'warning', message: 'ORD-2025-002 stuck in processing for 24h', created_at: from },
    { id: 'alert_05', type: 'low_packaging', severity: 'critical', message: '2ml Labels (PKG-LBL-2ML) — only 15 sheets left', created_at: from },
    { id: 'alert_06', type: 'low_ml', severity: 'warning', message: 'Aventus (DEC-003) — approaching threshold at 67ml', created_at: from },
    { id: 'alert_07', type: 'variance', severity: 'warning', message: 'Decant variance detected: Baccarat Rouge 540 batch B-007', created_at: from },
    { id: 'alert_08', type: 'missing_scan', severity: 'info', message: 'SB-005 missing exit scan from Station 2', created_at: from },
  ];

  // More days = more alerts visible
  const count = Math.min(allAlerts.length, Math.max(3, Math.round(3 + days * 0.5 * rand())));
  return allAlerts.slice(0, count);
}

export function generateCriticalPerfumesForRange(from: string, to: string): CriticalPerfume[] {
  const seed = hashString(`${from}-${to}-critical`);
  const rand = seededRandom(seed);

  return [
    { master_id: 'PF-002', name: 'Tobacco Vanille', brand: 'Tom Ford', current_ml: Math.round(10 + rand() * 20), threshold_ml: 30 },
    { master_id: 'PF-001', name: 'Baccarat Rouge 540', brand: 'MFK', current_ml: Math.round(30 + rand() * 25), threshold_ml: 50 },
    { master_id: 'PF-003', name: 'Aventus', brand: 'Creed', current_ml: Math.round(50 + rand() * 35), threshold_ml: 80 },
  ].filter(p => p.current_ml < p.threshold_ml);
}

// Compute comparison data for trend indicators
export function computeTrends(
  currentKPIs: DashboardKPIs,
  previousKPIs: DashboardKPIs,
): Record<string, { value: string; up: boolean } | undefined> {
  const currentOrders = currentKPIs.one_time_orders.new + currentKPIs.one_time_orders.in_progress;
  const prevOrders = previousKPIs.one_time_orders.new + previousKPIs.one_time_orders.in_progress;
  const ordersDelta = currentOrders - prevOrders;

  const currentBatches = currentKPIs.decant_batches.pending + currentKPIs.decant_batches.in_progress;
  const prevBatches = previousKPIs.decant_batches.pending + previousKPIs.decant_batches.in_progress;
  const batchesDelta = currentBatches - prevBatches;

  const pickupDelta = currentKPIs.shipping.ready_for_pickup - previousKPIs.shipping.ready_for_pickup;

  const subDelta = currentKPIs.subscription.orders_count - previousKPIs.subscription.orders_count;

  function fmt(delta: number, suffix: string = ''): { value: string; up: boolean } | undefined {
    if (delta === 0) return undefined;
    const pct = prevOrders > 0 ? Math.abs(Math.round((delta / Math.max(1, Math.abs(prevOrders))) * 100)) : 0;
    return {
      value: `${Math.abs(delta)}${suffix} vs prev period`,
      up: delta > 0,
    };
  }

  // Extended KPI trends
  const currentFB = (currentKPIs.full_bottles?.pending || 0) + (currentKPIs.full_bottles?.in_progress || 0);
  const prevFB = (previousKPIs.full_bottles?.pending || 0) + (previousKPIs.full_bottles?.in_progress || 0);
  const fbDelta = currentFB - prevFB;

  const currentRev = currentKPIs.revenue?.total_aed || 0;
  const prevRev = previousKPIs.revenue?.total_aed || 0;
  const revDelta = currentRev - prevRev;

  const currentCust = currentKPIs.customers?.total || 0;
  const prevCust = previousKPIs.customers?.total || 0;
  const custDelta = currentCust - prevCust;

  const currentInv = currentKPIs.inventory?.low_stock_count || 0;
  const prevInv = previousKPIs.inventory?.low_stock_count || 0;
  const invDelta = currentInv - prevInv;

  return {
    one_time_orders: ordersDelta !== 0 ? { value: `${Math.abs(ordersDelta)} vs prev period`, up: ordersDelta > 0 } : undefined,
    subscription_cycle: subDelta !== 0 ? { value: `${Math.abs(subDelta)} vs prev period`, up: subDelta > 0 } : undefined,
    full_bottles: fbDelta !== 0 ? { value: `${Math.abs(fbDelta)} vs prev period`, up: fbDelta > 0 } : undefined,
    decant_batches: batchesDelta !== 0 ? { value: `${Math.abs(batchesDelta)} vs prev period`, up: batchesDelta > 0 } : undefined,
    ready_for_pickup: pickupDelta !== 0 ? { value: `${Math.abs(pickupDelta)} vs prev period`, up: pickupDelta > 0 } : undefined,
    revenue: revDelta !== 0 ? { value: `${Math.abs(Math.round(revDelta / 1000))}K AED vs prev`, up: revDelta > 0 } : undefined,
    customers: custDelta !== 0 ? { value: `${Math.abs(custDelta)} vs prev period`, up: custDelta > 0 } : undefined,
    inventory_summary: invDelta !== 0 ? { value: `${Math.abs(invDelta)} low stock change`, up: invDelta < 0 } : undefined,
  };
}

// Get the "previous period" range for comparison
export function getPreviousPeriodRange(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const durationMs = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate.getTime() - 1); // 1ms before current from
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return {
    from: prevFrom.toISOString(),
    to: prevTo.toISOString(),
  };
}
