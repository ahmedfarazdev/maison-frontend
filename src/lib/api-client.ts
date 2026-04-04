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

  // ---- Master Data (Root & Nested) ----
  master: {
    perfumes: async () => {
      try {
        const res = await apiGet<any>('/perfumes');
        const items = Array.isArray(res) ? res : res.data || [];
        return wrapList(items.map(mapPerfume));
      } catch {
        return wrapList(mock.mockPerfumes);
      }
    },
    notes: {
      list: async () => {
        try {
          const res = await apiGet<any>('/notes');
          return Array.isArray(res) ? wrapList(res) : res;
        } catch {
          return wrapList([]);
        }
      },
      create: async (d: any) => apiPost('/notes', d),
      update: async (id: string, d: any) => apiPut(`/notes/${id}`, d),
      delete: async (id: string) => apiDelete(`/notes/${id}`),
    },
    auras: {
      list: async () => wrapList([]),
      create: async (d: any) => wrapOne(d),
      update: async (id: string, d: any) => wrapOne(d),
      delete: async (id: string) => wrapOne({ id }),
    },
    families: {
      list: async () => wrapList([]),
      create: async (d: any) => wrapOne(d),
      update: async (id: string, d: any) => wrapOne(d),
      delete: async (id: string) => wrapOne({ id }),
    },
    subFamilies: {
      list: async () => wrapList([]),
      create: async (d: any) => wrapOne(d),
      update: async (id: string, d: any) => wrapOne(d),
      delete: async (id: string) => wrapOne({ id }),
    },
    locations: {
      list: async () => wrapList([]),
    },
    suppliers: {
      list: async () => wrapList([]),
    },
    syringes: {
      list: async () => wrapList([]),
    },
    pricing: {
      list: async () => wrapList([]),
    },
    supplierBrands: {
      list: async () => wrapList([]),
    },
    filterTags: {
      list: async () => wrapList([]),
    }
  },

  // Aliases for components expecting root-level access
  notes: {
    list: async () => {
      try {
        const res = await apiGet<any>('/notes');
        const items = Array.isArray(res) ? res : res.data || [];
        return wrapList(items);
      } catch {
        return wrapList([]);
      }
    },
    create: async (d: any) => apiPost('/notes', d),
    update: async (id: string, d: any) => apiPut(`/notes/${id}`, d),
    delete: async (id: string) => apiDelete(`/notes/${id}`),
    perfumeCounts: async () => wrapOne({}),
    perfumesByNote: async (name: string) => wrapList([]),
    bulkImport: async (d: any) => wrapOne({ imported: 0 }),
  },
  auras: {
    list: async () => wrapList([]),
    create: async (d: any) => wrapOne(d),
    update: async (id: string, d: any) => wrapOne(d),
    delete: async (id: string) => wrapOne({ id }),
  },
  families: {
    list: async () => wrapList([]),
    create: async (d: any) => wrapOne(d),
    update: async (id: string, d: any) => wrapOne(d),
    delete: async (id: string) => wrapOne({ id }),
  },
  subFamilies: {
    list: async () => wrapList([]),
    create: async (d: any) => wrapOne(d),
    update: async (id: string, d: any) => wrapOne(d),
    delete: async (id: string) => wrapOne({ id }),
  },
  locations: {
    list: async () => wrapList([]),
    create: async (d: any) => wrapOne(d),
    update: async (id: string, d: any) => wrapOne(d),
    delete: async (id: string) => wrapOne({ id }),
  },
  suppliers: {
    list: async () => wrapList([]),
    get: async (id: string) => wrapOne({ id }),
    create: async (d: any) => wrapOne(d),
    update: async (id: string, d: any) => wrapOne(d),
    delete: async (id: string) => wrapOne({ id }),
  },
  syringes: {
    list: async () => wrapList([]),
    create: async (d: any) => wrapOne(d),
    update: async (id: string, d: any) => wrapOne(d),
    delete: async (id: string) => wrapOne({ id }),
  },
  pricing: {
    list: async () => wrapList([]),
    update: async (id: string, d: any) => wrapOne(d),
  },
  filterTags: {
    list: async () => wrapList([]),
    create: async (d: any) => wrapOne(d),
    update: async (id: string, d: any) => wrapOne(d),
    delete: async (id: string) => wrapOne({ id }),
  },
  supplierBrands: {
    list: async () => wrapList([]),
    create: async (d: any) => wrapOne(d),
    delete: async (id: string) => wrapOne({ id }),
  },
  brands: {
    list: async () => wrapList([]),
    get: async (id: string) => wrapOne({ id }),
    create: async (d: any) => wrapOne(d),
    update: async (id: string, d: any) => wrapOne(d),
  },
  perfumes: {
    list: async (params?: any) => {
      try {
        const res = await apiGet<any>('/perfumes');
        const items = Array.isArray(res) ? res : res.data || [];
        return wrapList(items.map(mapPerfume));
      } catch {
        return wrapList(mock.mockPerfumes);
      }
    },
    get: async (id: string) => {
      const res = await apiGet<any>(`/perfumes/${id}`);
      return wrapOne(mapPerfume(res));
    },
    create: async (d: any) => apiPost('/perfumes', d),
    update: async (id: string, d: any) => apiPut(`/perfumes/${id}`, d),
    delete: async (id: string) => apiDelete(`/perfumes/${id}`),
  },

  // ---- Production & Inventory ----
  inventory: {
    bottles: {
      list: async () => wrapList([]),
      create: async (d: any) => wrapOne(d),
      update: async (id: string, d: any) => wrapOne(d),
      delete: async (id: string) => wrapOne({ id }),
    },
    syringes: {
      list: async () => wrapList([]),
      create: async (d: any) => wrapOne(d),
    },
    packaging: {
      list: async () => {
        try {
          const rows = await apiGet<any[]>('/inventory/packaging');
          return wrapOne(rows);
        } catch {
          return wrapOne([]);
        }
      },
    },
    decantBottles: {
      list: async () => wrapList([]),
      create: async (d: any) => wrapOne(d),
      update: async (id: string, d: any) => wrapOne(d),
    },
    reconciliation: {
      list: async () => wrapList([]),
      create: async (d: any) => wrapOne(d),
      stats: async () => wrapOne({ totalValue: 0, accuracy: 0 }),
      run: async (id: string) => wrapOne({ id }),
    },
    alerts: {
      list: async () => wrapList([]),
    }
  },
  reconciliation: {
    list: async () => wrapList([]),
    create: async (d: any) => wrapOne(d),
    stats: async () => wrapOne({ totalValue: 0, accuracy: 0 }),
    run: async (id: string) => wrapOne({ id }),
  },
  alerts: {
    list: async () => wrapList([]),
  },

  // ---- Procurement ----
  procurement: {
    purchaseOrders: {
      list: async () => wrapList([]),
      nextNumber: async () => wrapOne({ number: 'PO-001' }),
      create: async (d: any) => wrapOne(d),
      get: async (id: string) => wrapOne({ id }),
      updateStatus: async (id: string, s: string) => wrapOne({ id, status: s }),
      confirmDelivery: async (id: string) => wrapOne({ id }),
      attachments: async (id: string) => wrapList([]),
    },
    packagingPOs: {
      list: async () => wrapList([]),
      create: async (d: any) => wrapOne(d),
      get: async (id: string) => wrapOne({ id }),
      updateStatus: async (id: string, s: string) => wrapOne({ id, status: s }),
      confirmDelivery: async (id: string) => wrapOne({ id }),
      cancel: async (id: string) => wrapOne({ id }),
      recordPayment: async (id: string, d: any) => wrapOne(d),
    },
  },
  purchaseOrders: {
    list: async () => wrapList([]),
    get: async (id: string) => wrapOne({ id }),
    create: async (d: any) => wrapOne(d),
    update: async (id: string, d: any) => wrapOne(d),
    updateStatus: async (id: string, status: string) => wrapOne({ id, status }),
    confirmDelivery: async (id: string) => wrapOne({ id }),
    cancel: async (id: string) => wrapOne({ id }),
    attachments: async (id: string) => wrapList([]),
    stats: async () => wrapOne({ totalPOs: 0, pendingValue: 0 }),
    overduePOs: async () => wrapList([]),
    nextNumber: async () => Date.now(),
  },
  packagingPOs: {
    list: async () => wrapList([]),
    create: async (d: any) => wrapOne(d),
    get: async (id: string) => wrapOne({ id }),
    updateStatus: async (id: string, s: string) => wrapOne({ id, status: s }),
    confirmDelivery: async (id: string) => wrapOne({ id }),
    cancel: async (id: string) => wrapOne({ id }),
    recordPayment: async (id: string, d: any) => wrapOne(d),
  },

  // ---- Public / Capsules ----
  capsules: {
    listDrops: async () => wrapList([]),
    stats: async () => wrapOne({ totalDrops: 0, liveDrops: 0, totalSold: 0, totalRevenue: 0, sellThrough: 0, remainingAllocation: 0 }),
    createDrop: async (d: any) => wrapOne(d),
    updateDrop: async (id: string, d: any) => wrapOne(d),
    deleteDrop: async (id: string) => wrapOne({ id }),
    addItem: async (d: any) => wrapOne(d),
    removeItem: async (id: number) => wrapOne({ id }),
  },
  potm: {
    list: async () => wrapList([]),
    create: async (d: any) => wrapOne(d),
    update: async (id: string, d: any) => wrapOne(d),
    upsert: async (d: any) => wrapOne(d),
    delete: async (id: string, reason?: string) => wrapOne({ id, reason }),
  },
  emVault: {
    list: async () => wrapList([]),
    get: async (id: string) => wrapOne({ id }),
    stats: async () => wrapOne({ totalValue: 0, itemsCount: 0, lowStock: 0 }),
    listReleases: async () => wrapList([]),
    createRelease: async (d: any) => wrapOne(d),
    updateRelease: async (id: string, d: any) => wrapOne(d),
    deleteRelease: async (id: string) => wrapOne({ id }),
    addItem: async (id: string, d: any) => wrapOne(d),
    removeItem: async (id: string, itemId: string) => wrapOne({ id, itemId }),
  },
  emVaultAccess: {
    listRequests: async () => wrapList([]),
    resolveAccessRequest: async (id: string, payload: any, reason?: string) => wrapOne({ id, ...payload, reason }),
  },

  // ---- Gifting & Subscriptions ----
  gifting: {
    listInquiries: async () => wrapList([]),
    createInquiry: async (d: any) => wrapOne(d),
    updateInquiry: async (id: string, d: any) => wrapOne(d),
    listCards: async () => wrapList([]),
    createCard: async (d: any) => wrapOne(d),
    listSets: async () => wrapList([]),
    createSet: async (d: any) => wrapOne(d),
    updateSet: async (id: string, d: any) => wrapOne(d),
    deleteSet: async (id: string) => wrapOne({ id }),
    listSubscriptions: async () => wrapList([]),
    createSubscription: async (d: any) => wrapOne(d),
    stats: async () => wrapOne({ totalInquiries: 0, activeAccounts: 0, totalRevenue: 0 }),
  },
  subscriptions: {
    list: async () => wrapList([]),
    get: async (id: string) => wrapOne({ id }),
    update: async (id: string, d: any) => wrapOne(d),
    cancel: async (id: string) => wrapOne({ id }),
    cycles: async () => wrapList([]),
    forecast: async (cycleId: string) => wrapOne({}),
  },
  subscriptionCycles: {
    list: async () => wrapList([]),
    create: async (d: any) => wrapOne(d),
    generateJobs: async (d: any) => wrapOne(d),
    update: async (id: string, d: any) => apiPut(`/subscription-cycles/${id}`, d),
    updateStatus: async (id: string, status: string) => wrapOne({ id, status }),
  },

  // ---- Stations & Operations ----
  stations: {
    batchDecantItems: async () => {
      try {
        const rows = await apiGet<any[]>('/stations/batch-decant');
        return wrapList(rows);
      } catch {
        return wrapList(mock.mockBatchDecantItems);
      }
    },
    packagingPickProduction: async () => {
      try {
        const rows = await apiGet<any[]>('/stations/packaging-pick/production');
        return wrapList(rows);
      } catch {
        return wrapList(mock.mockPackagingPickProduction);
      }
    },
    packagingPickFulfillment: async () => {
      try {
        const rows = await apiGet<any[]>('/stations/packaging-pick/fulfillment');
        return wrapList(rows);
      } catch {
        return wrapList(mock.mockPackagingPickFulfillment);
      }
    },
    decantPickList: () => Promise.resolve(wrapOne(mock.mockDecantPickList)),
    syringePickList: () => Promise.resolve(wrapOne(mock.mockSyringePickList)),
    labelQueue: () => Promise.resolve(wrapOne(mock.mockLabelQueue)),
  },

  // ---- Ledger & History ----
  ledger: {
    bottle: async () => {
      try {
        const rows = await apiGet<any[]>('/ledger/bottle-events');
        return wrapList(rows.map(mapBottleLedgerEvent));
      } catch {
        return wrapList(mock.mockBottleLedger);
      }
    },
    decant: async () => {
      try {
        const rows = await apiGet<any[]>('/ledger/decant-events');
        return wrapList(rows.map(mapDecantLedgerEvent));
      } catch {
        return wrapList(mock.mockDecantLedger);
      }
    },
  },

  // ---- Dashboard & Utils ----
  dashboard: {
    kpis: async (params?: any) => wrapOne(mock.mockDashboardKPIs),
    alerts: async (params?: any) => wrapOne(mock.mockAlerts),
    recentActivity: async (limit = 10) => wrapList(mock.mockActivity),
    pipeline: async (params?: any) => wrapOne([]),
    criticalPerfumes: async (params?: any) => wrapOne([]),
  },
  settings: {
    list: async () => wrapOne(Object.entries(mock.mockSettings).map(([key, value]) => ({ key, value }))),
  },
  production: {
    stats: async () => wrapOne({}),
  },
  customers: {
    list: async () => wrapList([]),
  },

  // ---- Standard UI Patterns ----
  orders: {
    list: async () => wrapList([]),
  },
  jobs: {
    list: async () => wrapList([]),
  },

  // ---- Mutations ----
  mutations: {
    perfumes: {
      create: (d: any) => apiPost('/perfumes', d),
      update: (id: string, d: any) => apiPut(`/perfumes/${id}`, d),
      delete: (id: string) => apiDelete(`/perfumes/${id}`),
      bulkImport: async (d: any) => wrapOne({ imported: 0 }),
    },
    purchaseOrders: {
      create: (d: any) => apiPost('/purchase-orders', d),
      update: (id: string, d: any) => apiPut(`/purchase-orders/${id}`, d),
      delete: (id: string) => apiDelete(`/purchase-orders/${id}`),
      updateStatus: (id: string, status: string) => wrapOne({ id, status }),
      confirmDelivery: (id: string) => wrapOne({ id }),
      cancel: (id: string, reason?: string) => wrapOne({ id, reason }),
      recordPayment: (id: string, d: any) => wrapOne(d),
      addAttachment: (id: string, d: any) => wrapOne(d),
      deleteAttachment: (poId: string, attId: string) => wrapOne({ poId, attId }),
      uploadDocument: (poId: string, d: any) => wrapOne(d),
      setDeliveryDate: (poId: string, date: string) => wrapOne({ poId, date }),
      extractInvoicePrices: (poId: string, d: any) => wrapOne(d),
      updateItemPrices: (poId: string, d: any) => wrapOne(d),
      bulkUpdateStatus: (d: any) => wrapOne(d),
      bulkMarkPaid: (d: any) => wrapOne(d),
    },
    packagingPOs: {
      list: async () => wrapList([]),
      get: async (id: string) => wrapOne({ poId: id, items: [] }),
      create: (d: any) => apiPost('/procurement/packaging-pos', d),
      updateStatus: (id: string, status: string) => apiPatch(`/procurement/packaging-pos/${id}/status`, { status }),
      recordPayment: (id: string, d: any) => apiPost(`/procurement/packaging-pos/${id}/payment`, d),
      confirmDelivery: (id: string, items: any[]) => apiPost(`/procurement/packaging-pos/${id}/confirm`, { items }),
      cancel: (id: string, reason: string) => apiPost(`/procurement/packaging-pos/${id}/cancel`, { reason }),
    },
    reconciliation: {
      createSession: async (d: any) => apiPost<any>('/inventory/reconciliation', d),
      listSessions: async () => wrapList([]),
      getSession: async (id: string) => wrapOne({ sessionId: id, items: [] }),
      deleteSession: async (id: string) => apiDelete(`/inventory/reconciliation/${id}`),
      countItem: async (itemId: number, qty: number, notes?: string) => 
        apiPost(`/inventory/reconciliation/count`, { itemId, qty, notes }),
      finalizeSession: async (id: string, applyAdjustments: boolean) => 
        apiPost(`/inventory/reconciliation/${id}/finalize`, { applyAdjustments }),
    },
    orders: {
      updateStatus: (id: string, status: string) => apiPatch(`/orders/${id}/status`, { status }),
      addTracking: (id: string, tracking: string) => apiPost(`/orders/${id}/tracking`, { tracking }),
      addAttachment: (id: string, d: any) => apiPost(`/orders/${id}/attachments`, d),
      deleteAttachment: (id: string, attrId: string) => apiDelete(`/orders/${id}/attachments/${attrId}`),
    },
    bottles: {
      create: (d: any) => apiPost('/inventory/bottles', d),
      update: (id: string, d: any) => apiPut(`/inventory/bottles/${id}`, d),
      delete: (id: string) => apiDelete(`/inventory/bottles/${id}`),
    },
    decantBottles: {
      create: (d: any) => apiPost('/inventory/decant-bottles', d),
      update: (id: string, d: any) => apiPut(`/inventory/decant-bottles/${id}`, d),
    },
    syringes: {
      create: (d: any) => apiPost('/syringes', d),
      update: (id: string, d: any) => apiPut(`/syringes/${id}`, d),
      delete: (id: string) => apiDelete(`/syringes/${id}`),
    },
    locations: {
      create: (d: any) => apiPost('/inventory/locations', d),
      update: (id: string, d: any) => apiPut(`/inventory/locations/${id}`, d),
      clear: (id: string) => apiPost(`/inventory/locations/${id}/clear`, {}),
      delete: (id: string) => apiDelete(`/inventory/locations/${id}`),
    },
    tags: {
      create: (d: any) => apiPost('/master-data/filter-tags', d),
      update: (id: string, d: any) => apiPut(`/master-data/filter-tags/${id}`, d),
      delete: (id: string) => apiDelete(`/master-data/filter-tags/${id}`),
    },
    taxonomies: {
      auras: {
        create: (d: any) => apiPost('/master-data/auras', d),
        update: (id: string, d: any) => apiPut(`/master-data/auras/${id}`, d),
        delete: (id: string) => apiDelete(`/master-data/auras/${id}`),
      },
      families: {
        create: (d: any) => apiPost('/master-data/families', d),
        update: (id: string, d: any) => apiPut(`/master-data/families/${id}`, d),
        delete: (id: string) => apiDelete(`/Family/${id}`),
      },
      subFamilies: {
        create: (d: any) => apiPost('/master-data/sub-families', d),
        update: (id: string, d: any) => apiPut(`/master-data/sub-families/${id}`, d),
        delete: (id: string) => apiDelete(`/master-data/sub-families/${id}`),
      },
    },
    packagingSkus: {
      create: (d: any) => apiPost('/packaging-skus', d),
      update: (id: string, d: any) => apiPatch(`/packaging-skus/${encodeURIComponent(id)}`, d),
      delete: (id: string) => apiDelete(`/packaging-skus/${encodeURIComponent(id)}`),
      linkSupplier: (d: any) => apiPost('/packaging-sku-suppliers', d),
      unlinkSupplier: (skuId: string, supplierId: string) => apiDelete(`/packaging-sku-suppliers?skuId=${encodeURIComponent(skuId)}&supplierId=${encodeURIComponent(supplierId)}`),
    },
    packagingStock: {
      upsert: (d: any) => apiPost('/inventory/packaging/upsert', d),
      bulkUpsert: (d: any[]) => apiPost('/inventory/packaging/bulk-upsert', d),
    },
    settings: {
      setBulk: (d: any[]) => apiPost('/settings/bulk', d),
    },
    ledger: {
      createBottleEvent: (d: any) => apiPost('/ledger/bottle-events', d),
      createDecantEvent: (d: any) => apiPost('/ledger/decant-events', d),
    },
  },
};

