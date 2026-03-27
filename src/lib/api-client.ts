import type {
  ApiResponse, ApiListResponse, Perfume, AuraDefinition, Family, SubFamily,
  VaultLocation, Supplier, Syringe, PackagingSKU, SealedBottle, DecantBottle,
  PackagingStock, Order, Job, SubscriptionCycle, PrintJob, DashboardKPIs,
  InventoryAlert, CriticalPerfume,
  User, BottleLedgerEvent, DecantLedgerEvent, ActivityEvent,
  BatchDecantItem, PackagingPickItem, PipelineStage,
} from '@/types';
import * as mock from './mock-data';
import {
  generateKPIsForRange, generatePipelineForRange,
  generateAlertsForRange, generateCriticalPerfumesForRange,
} from './mock-data-timerange';
import {
  mapPerfume, mapBrand, mapSupplier, mapSyringe, mapPackagingSku,
  mapVaultLocation, mapInventoryBottle, mapDecantBottle, mapOrder,
  mapJob, mapBottleLedgerEvent, mapDecantLedgerEvent, mapSubscriptionCycle,
  mapPrintJob, mapAlert,
} from './data-mappers';

// ============================================================
// Maison Em OS — REST API Client
// Replaces tRPC with standard fetch calls to Fastify backend
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

// Helper to get auth token (placeholder for Supabase/JWT integration)
const getAuthHeaders = () => {
  const token = localStorage.getItem('sb-access-token') || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error(`[API Error] ${options.method || 'GET'} ${path}:`, res.status, errorData);
    throw new Error(errorData.message || `API error: ${res.status}`);
  }

  return res.json();
}

const apiGet = <T>(path: string) => apiRequest<T>(path, { method: 'GET' });
const apiPost = <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) });
const apiPut = <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) });
const apiDelete = <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' });

// Helper to wrap results in the ApiListResponse format pages expect
function wrapList<T>(data: T[]): ApiListResponse<T> {
  return { data, meta: { total: data.length, page: 1, per_page: 50 } };
}

function wrapOne<T>(data: T): ApiResponse<T> {
  return { data };
}

// ---- Typed API methods ----
export const api = {
  auth: {
    me: async () => {
      try {
        const user = await apiGet<any>('/auth/me');
        return wrapOne<User>(user);
      } catch {
        return wrapOne(mock.mockUser);
      }
    },
  },
  master: {
    perfumes: async (): Promise<ApiListResponse<Perfume>> => {
      try {
        const rows = await apiGet<any[]>('/perfumes');
        return wrapList(rows.map(mapPerfume));
      } catch (e) {
        console.warn('[API] /perfumes fallback to mock', e);
        return wrapList(mock.mockPerfumes);
      }
    },
    auras: async () => {
      try {
        const rows = await apiGet<any[]>('/master-data/auras');
        return wrapList(rows);
      } catch (e) {
        return wrapList(mock.mockAuras);
      }
    },
    families: async () => {
      try {
        const rows = await apiGet<any[]>('/master-data/families');
        return wrapList(rows);
      } catch (e) {
        return wrapList(mock.mockFamilies);
      }
    },
    subFamilies: async () => {
      try {
        const rows = await apiGet<any[]>('/master-data/sub-families');
        return wrapList(rows);
      } catch (e) {
        return wrapList(mock.mockSubFamilies);
      }
    },
    locations: async (): Promise<ApiListResponse<VaultLocation>> => {
      try {
        const rows = await apiGet<any[]>('/inventory/locations');
        return wrapList(rows.map(mapVaultLocation));
      } catch (e) {
        return wrapList(mock.mockLocations);
      }
    },
    suppliers: async (): Promise<ApiListResponse<Supplier>> => {
      try {
        const rows = await apiGet<any[]>('/suppliers');
        return wrapList(rows.map((row) => mapSupplier(row)));
      } catch (e) {
        return wrapList(mock.mockSuppliers);
      }
    },
    syringes: async (): Promise<ApiListResponse<Syringe>> => {
      try {
        const rows = await apiGet<any[]>('/syringes');
        return wrapList(rows.map(mapSyringe));
      } catch (e) {
        return wrapList(mock.mockSyringes);
      }
    },
    packagingSKUs: async (): Promise<ApiListResponse<PackagingSKU>> => {
      try {
        const rows = await apiGet<any[]>('/packaging/skus');
        return wrapList(rows.map(mapPackagingSku));
      } catch (e) {
        return wrapList(mock.mockPackagingSKUs);
      }
    },
    brands: async () => {
      try {
        const rows = await apiGet<any[]>('/brands');
        return wrapList(rows.map(mapBrand));
      } catch (e) {
        return wrapList([]);
      }
    },
  },
  inventory: {
    sealedBottles: async (): Promise<ApiListResponse<SealedBottle>> => {
      try {
        const rows = await apiGet<any[]>('/inventory/bottles');
        return wrapList(rows.map(mapInventoryBottle));
      } catch (e) {
        return wrapList(mock.mockSealedBottles);
      }
    },
    decantBottles: async (): Promise<ApiListResponse<DecantBottle>> => {
      try {
        const rows = await apiGet<any[]>('/inventory/decant-bottles');
        return wrapList(rows.map(mapDecantBottle));
      } catch (e) {
        return wrapList(mock.mockDecantBottles);
      }
    },
  },
  orders: {
    list: async (): Promise<ApiListResponse<Order>> => {
      try {
        const rows = await apiGet<any[]>('/orders');
        return wrapList(rows.map(mapOrder));
      } catch (e) {
        return wrapList(mock.mockOrders);
      }
    },
  },
  jobs: {
    list: async (): Promise<ApiListResponse<Job>> => {
      try {
        const rows = await apiGet<any[]>('/jobs');
        return wrapList(rows.map(mapJob));
      } catch (e) {
        return wrapList(mock.mockJobs);
      }
    },
  },
  dashboard: {
    kpis: async (params?: { from: string; to: string }): Promise<ApiResponse<DashboardKPIs>> => {
      try {
        const query = params ? `?from=${params.from}&to=${params.to}` : '';
        const data = await apiGet<DashboardKPIs>(`/dashboard/kpis${query}`);
        return wrapOne(data);
      } catch (e) {
        return wrapOne(params?.from ? generateKPIsForRange(params.from, params.to) : mock.mockDashboardKPIs);
      }
    },
    alerts: async (params?: { from: string; to: string }): Promise<ApiResponse<InventoryAlert[]>> => {
      try {
        const query = params ? `?from=${params.from}&to=${params.to}` : '';
        const rows = await apiGet<any[]>(`/dashboard/alerts${query}`);
        return wrapOne(rows.map(mapAlert));
      } catch (e) {
        return wrapOne(params?.from ? generateAlertsForRange(params.from, params.to) : mock.mockAlerts);
      }
    },
    recentActivity: async (limit = 10): Promise<ApiListResponse<ActivityEvent>> => {
      try {
        const rows = await apiGet<any[]>(`/dashboard/activity?limit=${limit}`);
        return wrapList(rows);
      } catch (e) {
        return wrapList(mock.mockActivity);
      }
    },
    pipeline: async (params?: { from: string; to: string }): Promise<ApiResponse<PipelineStage[]>> => {
      try {
        const query = params ? `?from=${params.from}&to=${params.to}` : '';
        const data = await apiGet<PipelineStage[]>(`/dashboard/pipeline${query}`);
        return wrapOne(data);
      } catch (e) {
        return wrapOne(params?.from ? generatePipelineForRange(params.from, params.to) : []);
      }
    },
    criticalPerfumes: async (params?: { from: string; to: string }): Promise<ApiResponse<CriticalPerfume[]>> => {
      try {
        const query = params ? `?from=${params.from}&to=${params.to}` : '';
        const rows = await apiGet<any[]>(`/dashboard/critical-perfumes${query}`);
        return wrapOne(rows);
      } catch (e) {
        return wrapOne(params?.from ? generateCriticalPerfumesForRange(params.from, params.to) : []);
      }
    },
  },
  subscriptions: {
    cycles: async (): Promise<ApiListResponse<SubscriptionCycle>> => {
      try {
        const rows = await apiGet<any[]>('/subscriptions/cycles');
        return wrapList(rows.map(mapSubscriptionCycle));
      } catch (e) {
        return wrapList(mock.mockCycles);
      }
    },
    forecast: async (cycleId: string): Promise<ApiResponse<any>> => {
      try {
        const data = await apiGet<any>(`/subscriptions/cycles/${cycleId}/forecast`);
        return wrapOne(data);
      } catch (e) {
        return wrapOne({});
      }
    },
  },
  stations: {
    batchDecantItems: async (): Promise<ApiListResponse<BatchDecantItem>> => {
      try {
        const rows = await apiGet<any[]>('/stations/batch-decant');
        return wrapList(rows);
      } catch (e) {
        return wrapList(mock.mockBatchDecantItems);
      }
    },
    packagingPickProduction: async (): Promise<ApiListResponse<PackagingPickItem>> => {
      try {
        const rows = await apiGet<any[]>('/stations/packaging-pick/production');
        return wrapList(rows);
      } catch (e) {
        return wrapList(mock.mockPackagingPickProduction);
      }
    },
    packagingPickFulfillment: async (): Promise<ApiListResponse<PackagingPickItem>> => {
      try {
        const rows = await apiGet<any[]>('/stations/packaging-pick/fulfillment');
        return wrapList(rows);
      } catch (e) {
        return wrapList(mock.mockPackagingPickFulfillment);
      }
    },
    decantPickList: () => Promise.resolve(wrapOne(mock.mockDecantPickList)),
    syringePickList: () => Promise.resolve(wrapOne(mock.mockSyringePickList)),
    labelQueue: () => Promise.resolve(wrapOne(mock.mockLabelQueue)),
  },
  settings: {
    list: async (): Promise<ApiResponse<{ key: string; value: string }[]>> => {
      try {
        const data = await apiGet<Record<string, any>>('/settings');
        const array = Object.entries(data).map(([key, value]) => ({ key, value: String(value) }));
        return wrapOne(array);
      } catch (e) {
        const array = Object.entries(mock.mockSettings).map(([key, value]) => ({ key, value }));
        return wrapOne(array);
      }
    },
  },
  customers: {
    list: async (): Promise<ApiListResponse<any>> => {
      try {
        const rows = await apiGet<any[]>('/customers');
        return wrapList(rows);
      } catch (e) {
        return wrapList([]);
      }
    },
  },
  production: {
    stats: async (): Promise<ApiResponse<any>> => {
      try {
        const data = await apiGet<any>('/production/stats');
        return wrapOne(data);
      } catch (e) {
        return wrapOne({});
      }
    },
  },
  purchaseOrders: {
    list: async (): Promise<ApiListResponse<any>> => {
      try {
        const rows = await apiGet<any[]>('/purchase-orders');
        return wrapList(rows);
      } catch (e) {
        return wrapList([]);
      }
    },
    stats: async (): Promise<ApiResponse<any>> => {
      try {
        const data = await apiGet<any>('/purchase-orders/stats');
        return wrapOne(data);
      } catch (e) {
        return wrapOne({});
      }
    },
    overduePOs: async (): Promise<ApiListResponse<any>> => {
      try {
        const rows = await apiGet<any[]>('/purchase-orders/overdue');
        return wrapList(rows);
      } catch (e) {
        return wrapList([]);
      }
    },
  },
  mutations: {
    perfumes: {
      create: (data: any) => apiPost('/perfumes', data),
      update: (id: string, data: any) => apiPut(`/perfumes/${id}`, data),
      delete: (id: string) => apiDelete(`/perfumes/${id}`),
    },
    orders: {
      create: (data: any) => apiPost('/orders', data),
      update: (id: string, data: any) => apiPut(`/orders/${id}`, data),
      delete: (id: string) => apiDelete(`/orders/${id}`),
    },
    bottles: {
      create: (data: any) => apiPost('/inventory/bottles', data),
      update: (id: string, data: any) => apiPut(`/inventory/bottles/${id}`, data),
    },
    decantBottles: {
      create: (data: any) => apiPost('/inventory/decant-bottles', data),
    },
    ledger: {
      createBottleEvent: (data: any) => apiPost('/ledger/bottle-events', data),
      createDecantEvent: (data: any) => apiPost('/ledger/decant-events', data),
    },
    settings: {
      setBulk: (data: { key: string; value: any; description?: string }[]) => apiPost('/settings/bulk', data),
    },
    syringes: {
      create: (data: any) => apiPost('/syringes', data),
    },
    packagingPOs: {
      list: () => Promise.resolve(wrapList([])), // Placeholder
    },
  },
  ledger: {
    bottle: async (): Promise<ApiListResponse<BottleLedgerEvent>> => {
      try {
        const rows = await apiGet<any[]>('/ledger/bottle-events');
        return wrapList(rows.map(mapBottleLedgerEvent));
      } catch (e) {
        return wrapList(mock.mockBottleLedger);
      }
    },
    decant: async (): Promise<ApiListResponse<DecantLedgerEvent>> => {
      try {
        const rows = await apiGet<any[]>('/ledger/decant-events');
        return wrapList(rows.map(mapDecantLedgerEvent));
      } catch (e) {
        return wrapList(mock.mockDecantLedger);
      }
    },
  },
};
