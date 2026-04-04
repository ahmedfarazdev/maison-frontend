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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const ACCESS_TOKEN_KEY = 'sb-access-token';
const REFRESH_TOKEN_KEY = 'sb-refresh-token';

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

type AuthResponse = {
  user: unknown;
  tokens: AuthTokens;
};

function storeTokens(tokens: AuthTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function mapUserProfile(input: any): User {
  const roles: string[] = Array.isArray(input?.roles)
    ? input.roles
    : [input?.role].filter(Boolean);

  return {
    id: String(input?.id || ''),
    email: String(input?.email || ''),
    fullName: String(input?.fullName ?? ''),
    avatarUrl: input?.avatarUrl ? String(input.avatarUrl) : undefined,
    role: (input?.role || roles[0] || 'user') as any,
    roles,
    permissions: Array.isArray(input?.permissions) ? input.permissions : [],
    createdAt: String(input?.createdAt || new Date().toISOString()),
  };
}

// Helper to get auth token (Supabase access token)
const getAuthHeaders = () => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY) || '';
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    return null;
  }

  const data = (await res.json().catch(() => null)) as AuthTokens | null;
  if (!data?.accessToken || !data?.refreshToken) {
    clearTokens();
    return null;
  }

  storeTokens(data);
  return data.accessToken;
}

async function apiRequest<T>(path: string, options: RequestInit = {}, allowRefresh = true): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(options.headers as Record<string, string>),
  };

  // Only add Content-Type: application/json if there is a body
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && allowRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest<T>(path, options, false);
    }

    clearTokens();
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error(`[API Error] ${options.method || 'GET'} ${path}:`, res.status, errorData);
    const message =
      errorData?.error?.message ||
      errorData?.message ||
      `API error: ${res.status}`;
    throw new Error(message);
  }

  // Handle 204 No Content or empty responses
  if (res.status === 204 || res.status === 205) {
    return {} as T;
  }

  return res.json();
}

const apiGet = <T>(path: string) => apiRequest<T>(path, { method: 'GET' });
const apiPost = <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) });
const apiPut = <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) });
const apiPatch = <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
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
      const user = await apiGet<any>('/auth/me');
      return wrapOne<User>(mapUserProfile(user));
    },
    signIn: async (email: string, password: string) => {
      const result = await apiPost<AuthResponse>('/auth/sign-in', { email, password });
      storeTokens(result.tokens);
      return wrapOne<User>(mapUserProfile(result.user));
    },
    signOut: async () => {
      try {
        await apiRequest('/auth/sign-out', { method: 'POST' }, false);
      } finally {
        clearTokens();
      }
    },
  },
  master: {
    notes: {
      post: async (payload: any) => apiPost<any>('/notes', payload),
      list: async () => {
        try {
          const res = await apiGet<ApiListResponse<any>>('/notes');
          return res;
        } catch {
          return wrapList([]);
        }
      },
    },
    notesPerfumes: async () => wrapList([]),
    perfumes: async (): Promise<ApiListResponse<Perfume>> => {
      try {
        const response = await apiGet<any>('/perfumes');
        // The API returns { data: [...] } due to the standard response wrapper
        const items = Array.isArray(response) ? response : response.data || [];
        return wrapList(items.map(mapPerfume));
      } catch (e) {
        console.warn('[API] /perfumes fallback to mock', e);
        return wrapList(mock.mockPerfumes);
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
    auras: Object.assign(async () => {
      try {
        const rows = await apiGet<any[]>('/master-data/auras');
        return wrapList(rows);
      } catch (e) {
        return wrapList(mock.mockAuras);
      }
    }, {
      list: async () => wrapList([]),
      create: async (d: any) => wrapOne(d),
      delete: async (id: string) => wrapOne({ id }),
    }),
    filterTags: Object.assign(async () => wrapList([]), {
      list: async () => wrapList([]),
      create: async (d: any) => wrapOne(d),
    }),
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
          return wrapList([]);
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
      const rows = await apiGet<any[]>('/packaging-skus/list');
      return wrapList(rows.map(mapPackagingSku));
    },
    pricingRules: {
      list: async () => wrapList([]),
    },
    pricing: {
      list: async () => wrapList([]),
      update: async (id: string, d: any) => wrapOne(d),
      create: async (d: any) => wrapOne(d),
      delete: async (id: string) => wrapOne({ id }),
    },
    supplierBrands: {
      list: async () => wrapList([]),
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
    packaging: async (): Promise<ApiResponse<PackagingStock[]>> => {
      try {
        const rows = await apiGet<any[]>('/inventory/packaging');
        return wrapOne(rows);
      } catch (e) {
        return wrapOne([]);
      }
    },
    reconciliation: {
      list: async () => wrapList([]),
      create: async (d: any) => wrapOne(d),
      stats: async () => wrapOne({}),
    },
    alerts: {
      list: async () => wrapList([]),
    },
    syringes: {
      list: async () => wrapList([]),
    },
  },
  potm: {
    list: async () => wrapList([]),
    create: async (d: any) => wrapOne(d),
    update: async (id: string, d: any) => wrapOne(d),
    delete: async (id: string) => wrapOne({ id }),
  },
  capsules: {
    stats: async () => wrapOne({ totalDrops: 0, liveDrops: 0, totalSold: 0, totalRevenue: 0, sellThrough: 0 }),
    listDrops: async () => wrapList([]),
    createDrop: async (d: any) => wrapOne(d),
    deleteDrop: async (id: string) => wrapOne({ id }),
    updateDrop: async (id: string, d: any) => wrapOne(d),
    addItem: async (id: string, d: any) => wrapOne(d),
    removeItem: async (id: string, itemId: string) => wrapOne({ id, itemId }),
  },
  emVault: {
    stats: async () => wrapOne({ totalReleases: 0, liveReleases: 0, totalSold: 0, totalRevenue: 0, totalRequests: 0 }),
    listReleases: async () => wrapList([]),
    createRelease: async (d: any) => wrapOne(d),
    deleteRelease: async (id: string) => wrapOne({ id }),
    updateRelease: async (id: string, d: any) => wrapOne(d),
    addItem: async (id: string, d: any) => wrapOne(d),
    removeItem: async (id: string, itemId: string) => wrapOne({ id, itemId }),
    listAccessRequests: async () => wrapList([]),
    resolveAccessRequest: async (id: string, d: any) => wrapOne(d),
  },
  gifting: {
    list: async () => wrapList([]),
    stats: async () => wrapOne({}),
    corporate: async () => wrapList([]),
    giftCards: async () => wrapList([]),
    giftSubscriptions: async () => wrapList([]),
  },
  procurement: {
    purchaseOrders: {
      list: async () => wrapList([]),
      nextNumber: async () => wrapOne({ number: 'PO-001' }),
      create: async (d: any) => wrapOne(d),
      get: async (id: string) => wrapOne({}),
      updateStatus: async (id: string, s: string) => wrapOne({ id, s }),
      confirmDelivery: async (id: string) => wrapOne({ id }),
      attachments: async (id: string) => wrapList([]),
    },
    packagingPOs: {
      list: async () => wrapList([]),
      create: async (d: any) => wrapOne(d),
      get: async (id: string) => wrapOne({}),
      updateStatus: async (id: string, s: string) => wrapOne({ id, s }),
      confirmDelivery: async (id: string) => wrapOne({ id }),
      cancel: async (id: string) => wrapOne({ id }),
      recordPayment: async (id: string, d: any) => wrapOne(d),
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
    attachments: async (id: string) => wrapList([]),
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
    nextNumber: async (): Promise<number> => {
      try {
        const res = await apiGet<{ next: number }>('/purchase-orders/next-number');
        return res.next || Date.now();
      } catch {
        return Date.now();
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
      bulkUpdateStatus: async (ids: string[], status: string) => wrapOne({ ids, status }),
      bulkMarkPaid: async (ids: string[]) => wrapOne({ ids }),
      uploadInvoice: async (orderId: string, file: any) => wrapOne({ orderId }),
      approveInvoice: async (orderId: string) => wrapOne({ orderId }),
      receiveBulk: async (orderId: string) => wrapOne({ orderId }),
      extractInvoicePrices: async (orderId: string) => wrapOne({ orderId }),
      updateItemPrices: async (orderId: string, items: any[]) => wrapOne({ orderId }),
      confirmDelivery: async (orderId: string) => wrapOne({ orderId }),
      addAttachment: async (orderId: string, d: any) => wrapOne({ orderId }),
      deleteAttachment: async (orderId: string, attachmentId: string) => wrapOne({ orderId, attachmentId }),
      uploadDocument: async (orderId: string, d: any) => wrapOne({ orderId }),
      recordPayment: async (orderId: string, d: any) => wrapOne({ orderId }),
      cancel: async (orderId: string) => wrapOne({ orderId }),
      setDeliveryDate: async (orderId: string, date: string) => wrapOne({ orderId, date }),
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
      update: async (id: string, data: any) => apiPut(`/syringes/${id}`, data),
      delete: async (id: string) => apiDelete(`/syringes/${id}`),
    },
    locations: {
      create: async (data: any) => apiPost('/inventory/locations', data),
      update: async (id: string, data: any) => apiPut(`/inventory/locations/${id}`, data),
      clear: async (id: string) => apiPost(`/inventory/locations/${id}/clear`, {}),
      delete: async (id: string) => apiDelete(`/inventory/locations/${id}`),
    },
    tags: {
      create: async (data: any) => apiPost('/master-data/filter-tags', data),
      update: async (id: string, data: any) => apiPut(`/master-data/filter-tags/${id}`, data),
      delete: async (id: string) => apiDelete(`/master-data/filter-tags/${id}`),
    },
    purchaseOrders: {
      create: async (data: any) => apiPost('/purchase-orders', data),
      update: async (id: string, data: any) => apiPut(`/purchase-orders/${id}`, data),
      delete: async (id: string) => apiDelete(`/purchase-orders/${id}`),
      cancel: async (id: string, reason: string) => apiPost(`/purchase-orders/${id}/cancel`, { reason }),
      uploadInvoice: async (id: string, file: any) => Promise.resolve(),
      approveInvoice: async (id: string, payload: any) => Promise.resolve(),
      receiveBulk: async (id: string, payload: any) => Promise.resolve(),
    },
    subscriptionCycles: {
      update: async (id: string, d: any) => apiPut(`/subscription-cycles/${id}`, d),
      updateStatus: async (id: string, status: string) => Promise.resolve(),
    },
    packagingSkus: {
      create: (data: any) => apiPost('/packaging-skus', data),
      bulkCreate: (data: any[]) => apiPost('/packaging-skus/bulk', data),
      update: async (id: string, data: any) => apiPatch(`/packaging-skus/${encodeURIComponent(id)}`, data),
      delete: async (id: string) => apiDelete(`/packaging-skus/${encodeURIComponent(id)}`),
      getSuppliers: async (skuId: string) => {
        const rows = await apiGet<any[]>(`/packaging-sku-suppliers?skuId=${encodeURIComponent(skuId)}`);
        return rows || [];
      },
      linkSupplier: async (data: { skuId: string, supplierId: string, supplierName?: string, isPreferred?: boolean, lastUnitCost?: string | number }) => {
        return apiPost('/packaging-sku-suppliers', data);
      },
      unlinkSupplier: async (skuId: string, supplierId: string) => {
        return apiDelete(`/packaging-sku-suppliers?skuId=${encodeURIComponent(skuId)}&supplierId=${encodeURIComponent(supplierId)}`);
      }
    },
    packagingStock: {
      upsert: (data: any) => apiPost('/inventory/packaging/upsert', data),
      bulkUpsert: (data: any[]) => apiPost('/inventory/packaging/bulk-upsert', data),
    },
    taxonomies: {
      auras: {
        create: async (d: any) => apiPost('/master-data/auras', d),
        update: async (id: string, d: any) => apiPut(`/master-data/auras/${id}`, d),
        delete: async (id: string) => apiDelete(`/master-data/auras/${id}`),
      },
      families: {
        create: async (d: any) => apiPost('/master-data/families', d),
        update: async (id: string, d: any) => apiPut(`/master-data/families/${id}`, d),
        delete: async (id: string) => apiDelete(`/master-data/families/${id}`),
      },
      subFamilies: {
        create: async (d: any) => apiPost('/master-data/sub-families', d),
        update: async (id: string, d: any) => apiPut(`/master-data/sub-families/${id}`, d),
        delete: async (id: string) => apiDelete(`/master-data/sub-families/${id}`),
      },
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
