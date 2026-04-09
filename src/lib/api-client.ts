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
  DEFAULT_SURCHARGES,
  DEFAULT_SUB_HYPE_MULT,
  DEFAULT_ML_DISCOUNTS,
  DEFAULT_ALACARTE_MULT,
} from './pricing-engine';
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

export const API_BASE = import.meta.env.VITE_API_URL

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

async function apiRequestSilent<T>(path: string, options: RequestInit = {}, allowRefresh = true): Promise<T | null> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(options.headers as Record<string, string>),
  };

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
      return apiRequestSilent<T>(path, options, false);
    }

    clearTokens();
    return null;
  }

  if (res.status === 401) {
    return null;
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message =
      errorData?.error?.message ||
      errorData?.message ||
      `API error: ${res.status}`;
    throw new Error(message);
  }

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

const normalizeList = <T = any>(input: unknown): T[] => {
  if (Array.isArray(input)) return input as T[];
  const data = (input as { data?: T[] } | null)?.data;
  return Array.isArray(data) ? data : [];
};

const normalizeString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const normalizeArray = <T>(value: T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : [];

const DEFAULT_TWO_ML_TIERS = [
  { s_category: 'S0', price: 25 },
  { s_category: 'S1', price: 35 },
  { s_category: 'S2', price: 45 },
  { s_category: 'S3', price: 55 },
  { s_category: 'S4', price: 65 },
  { s_category: 'S5', price: 75 },
];

function mapAuraDefinition(row: any): AuraDefinition {
  return {
    aura_id: normalizeString(row?.auraId ?? row?.aura_id),
    name: normalizeString(row?.name),
    color: normalizeString(row?.color, 'Red') as AuraDefinition['color'],
    element: normalizeString(row?.element),
    keywords: normalizeArray<string>(row?.keywords),
    persona: normalizeString(row?.persona),
    tagline: normalizeString(row?.tagline),
    description: normalizeString(row?.description),
    core_drive: normalizeString(row?.coreDrive ?? row?.core_drive),
    balance_aura: normalizeString(row?.balanceAura ?? row?.balance_aura),
    color_hex: normalizeString(row?.colorHex ?? row?.color_hex, '#888888'),
  };
}

function mapFamily(row: any): Family {
  return {
    main_family_id: normalizeString(row?.familyId ?? row?.mainFamilyId ?? row?.main_family_id),
    name: normalizeString(row?.name),
    display_order: Number(row?.displayOrder ?? row?.display_order ?? 0),
    tagline: normalizeString(row?.tagline),
    description: normalizeString(row?.description),
    sub_families: normalizeArray<string>(row?.subFamilies ?? row?.sub_families),
  };
}

function mapSubFamily(row: any): SubFamily {
  return {
    sub_family_id: normalizeString(row?.subFamilyId ?? row?.sub_family_id),
    ff_code: normalizeString(row?.ffCode ?? row?.ff_code),
    main_family_id: normalizeString(row?.mainFamilyId ?? row?.main_family_id),
    main_family_name: normalizeString(row?.mainFamilyName ?? row?.main_family_name),
    name: normalizeString(row?.name),
    scent_dna: normalizeString(row?.scentDna ?? row?.scent_dna),
    ritual_name: normalizeString(row?.ritualName ?? row?.ritual_name),
    ritual_occasions: normalizeString(row?.ritualOccasions ?? row?.ritual_occasions),
    aura_name: normalizeString(row?.auraName ?? row?.aura_name),
    aura_color: normalizeString(row?.auraColor ?? row?.aura_color, 'Red') as SubFamily['aura_color'],
    description: normalizeString(row?.description),
    scent_story: normalizeString(row?.scentStory ?? row?.scent_story),
    key_notes: normalizeArray<string>(row?.keyNotes ?? row?.key_notes),
    mood_tags: normalizeArray<string>(row?.moodTags ?? row?.mood_tags),
    prominent_notes: normalizeString(row?.prominentNotes ?? row?.prominent_notes),
    display_order: row?.displayOrder ?? row?.display_order,
  };
}

const toAuraPayload = (input: any): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  const auraId = input?.auraId ?? input?.aura_id;
  if (auraId) payload.auraId = auraId;
  if (input?.name !== undefined) payload.name = input.name;
  if (input?.color !== undefined) payload.color = input.color;
  const colorHex = input?.colorHex ?? input?.color_hex;
  if (colorHex !== undefined) payload.colorHex = colorHex;
  if (input?.element !== undefined) payload.element = input.element;
  if (input?.keywords !== undefined) payload.keywords = input.keywords;
  if (input?.persona !== undefined) payload.persona = input.persona;
  if (input?.tagline !== undefined) payload.tagline = input.tagline;
  if (input?.description !== undefined) payload.description = input.description;
  const coreDrive = input?.coreDrive ?? input?.core_drive;
  if (coreDrive !== undefined) payload.coreDrive = coreDrive;
  const balanceAura = input?.balanceAura ?? input?.balance_aura;
  if (balanceAura !== undefined) payload.balanceAura = balanceAura;
  if (input?.active !== undefined) payload.active = input.active;
  return payload;
};

const toFamilyPayload = (input: any): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  const familyId = input?.familyId ?? input?.main_family_id ?? input?.mainFamilyId;
  if (familyId) payload.familyId = familyId;
  if (input?.name !== undefined) payload.name = input.name;
  const displayOrder = input?.displayOrder ?? input?.display_order;
  if (displayOrder !== undefined) payload.displayOrder = displayOrder;
  if (input?.tagline !== undefined) payload.tagline = input.tagline;
  if (input?.description !== undefined) payload.description = input.description;
  const subFamilies = input?.subFamilies ?? input?.sub_families;
  if (subFamilies !== undefined) payload.subFamilies = subFamilies;
  if (input?.active !== undefined) payload.active = input.active;
  return payload;
};

const toSubFamilyPayload = (input: any): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  const subFamilyId = input?.subFamilyId ?? input?.sub_family_id;
  if (subFamilyId) payload.subFamilyId = subFamilyId;
  const ffCode = input?.ffCode ?? input?.ff_code;
  if (ffCode) payload.ffCode = ffCode;
  const mainFamilyId = input?.mainFamilyId ?? input?.main_family_id;
  if (mainFamilyId) payload.mainFamilyId = mainFamilyId;
  const mainFamilyName = input?.mainFamilyName ?? input?.main_family_name;
  if (mainFamilyName !== undefined) payload.mainFamilyName = mainFamilyName;
  if (input?.name !== undefined) payload.name = input.name;
  const scentDna = input?.scentDna ?? input?.scent_dna;
  if (scentDna !== undefined) payload.scentDna = scentDna;
  const ritualName = input?.ritualName ?? input?.ritual_name;
  if (ritualName !== undefined) payload.ritualName = ritualName;
  const ritualOccasions = input?.ritualOccasions ?? input?.ritual_occasions;
  if (ritualOccasions !== undefined) payload.ritualOccasions = ritualOccasions;
  const auraName = input?.auraName ?? input?.aura_name;
  if (auraName !== undefined) payload.auraName = auraName;
  const auraColor = input?.auraColor ?? input?.aura_color;
  if (auraColor !== undefined) payload.auraColor = auraColor;
  if (input?.description !== undefined) payload.description = input.description;
  const scentStory = input?.scentStory ?? input?.scent_story;
  if (scentStory !== undefined) payload.scentStory = scentStory;
  const keyNotes = input?.keyNotes ?? input?.key_notes;
  if (keyNotes !== undefined) payload.keyNotes = keyNotes;
  const moodTags = input?.moodTags ?? input?.mood_tags;
  if (moodTags !== undefined) payload.moodTags = moodTags;
  if (input?.active !== undefined) payload.active = input.active;
  return payload;
};

const normalizeNote = (value: string) => value.trim().toLowerCase();

async function fetchPerfumesForNotes(): Promise<Perfume[]> {
  const res = await apiGet<any>('/perfumes');
  const items = normalizeList(res);
  return items.map(mapPerfume);
}

// ---- Typed API methods ----
export const api = {
  auth: {
    meSilent: async () => {
      const user = await apiRequestSilent<any>('/auth/me', { method: 'GET' });
      if (!user) return wrapOne<User | null>(null);
      return wrapOne<User>(mapUserProfile(user));
    },
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
        const res = await apiGet<any>('/notes');
        const items = normalizeList(res);
        return wrapList(items);
      },
      create: async (d: any) => apiPost('/notes', d),
      update: async (id: string, d: any) => apiPut(`/notes/${id}`, d),
      delete: async (id: string) => apiDelete(`/notes/${id}`),
    },
    auras: async () => {
      const res = await apiGet<any>('/taxonomies/auras');
      const items = normalizeList(res);
      return wrapList(items.map(mapAuraDefinition));
    },
    families: async () => {
      const res = await apiGet<any>('/taxonomies/families');
      const items = normalizeList(res);
      return wrapList(items.map(mapFamily));
    },
    subFamilies: async () => {
      const res = await apiGet<any>('/taxonomies/sub-families');
      const items = normalizeList(res);
      return wrapList(items.map(mapSubFamily));
    },
    pricingRules: {
      surcharges: async () => {
        try {
          const rows = await apiGet<any[]>('/pricing-rules/surcharges');
          return rows.map((r) => ({
            from_price_per_ml: Number(r.fromPricePerMl ?? r.from_price_per_ml ?? 0),
            to_price_per_ml: r.toPricePerMl === null || r.toPricePerMl === undefined
              ? null
              : Number(r.toPricePerMl),
            s_category: r.sCategory ?? r.s_category,
            s_price: Number(r.sPrice ?? r.s_price ?? 0),
          }));
        } catch {
          return DEFAULT_SURCHARGES;
        }
      },
      subHypeMultipliers: async () => {
        try {
          const rows = await apiGet<any[]>('/pricing-rules/sub-hype-multipliers');
          return rows.map((r) => ({
            hype: r.hype,
            multiplier: Number(r.multiplier ?? 0),
          }));
        } catch {
          return DEFAULT_SUB_HYPE_MULT;
        }
      },
      mlDiscounts: async () => {
        try {
          const rows = await apiGet<any[]>('/pricing-rules/ml-discounts');
          return rows.map((r) => ({
            label: r.label,
            ml_size: Number(r.mlSize ?? r.ml_size ?? 0),
            discount_factor: Number(r.discountFactor ?? r.discount_factor ?? 0),
          }));
        } catch {
          return DEFAULT_ML_DISCOUNTS;
        }
      },
      alacarteMultipliers: async () => {
        try {
          const rows = await apiGet<any[]>('/pricing-rules/alacarte-multipliers');
          return rows.map((r) => ({
            hype: r.hype,
            multiplier: Number(r.multiplier ?? 0),
          }));
        } catch {
          return DEFAULT_ALACARTE_MULT;
        }
      },
      twoMlTiers: async () => {
        try {
          const rows = await apiGet<any[]>('/pricing-rules/two-ml-tiers');
          return rows.map((r) => ({
            s_category: r.sCategory ?? r.s_category,
            price: Number(r.price ?? 0),
          }));
        } catch {
          return DEFAULT_TWO_ML_TIERS;
        }
      },
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
    filterTags: async (category?: string) => {
      const res = await apiGet<any>('/taxonomies/filter-tags');
      const items = normalizeList(res);
      const filtered = category ? items.filter((tag) => tag.category === category) : items;
      return wrapList(filtered);
    }
  },

  // Aliases for components expecting root-level access
  notes: {
    list: async () => {
      const res = await apiGet<any>('/notes');
      const items = normalizeList(res);
      return wrapList(items);
    },
    create: async (d: any) => apiPost('/notes', d),
    update: async (id: string, d: any) => apiPut(`/notes/${id}`, d),
    delete: async (id: string) => apiDelete(`/notes/${id}`),
    perfumeCounts: async () => {
      const perfumes = await fetchPerfumesForNotes();
      const counts: Record<string, number> = {};
      for (const perfume of perfumes) {
        const seen = new Set<string>();
        const pools = [perfume.notes_top, perfume.notes_heart, perfume.notes_base];
        for (const pool of pools) {
          for (const note of pool) {
            const normalized = normalizeNote(note);
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);
            counts[normalized] = (counts[normalized] ?? 0) + 1;
          }
        }
      }
      return wrapOne(counts);
    },
    perfumesByNote: async (name: string) => {
      const perfumes = await fetchPerfumesForNotes();
      const target = normalizeNote(name);
      const matches = perfumes.flatMap((perfume) => {
        if (!target) return [];
        if (perfume.notes_top.some((note) => normalizeNote(note) === target)) {
          return [{ masterId: perfume.master_id, name: perfume.name, brand: perfume.brand, notePosition: 'top' }];
        }
        if (perfume.notes_heart.some((note) => normalizeNote(note) === target)) {
          return [{ masterId: perfume.master_id, name: perfume.name, brand: perfume.brand, notePosition: 'heart' }];
        }
        if (perfume.notes_base.some((note) => normalizeNote(note) === target)) {
          return [{ masterId: perfume.master_id, name: perfume.name, brand: perfume.brand, notePosition: 'base' }];
        }
        return [];
      });
      return wrapList(matches);
    },
    bulkImport: async (items: any[]) => {
      let imported = 0;
      for (const item of items) {
        await apiPost('/notes', item);
        imported += 1;
      }
      return wrapOne({ imported });
    },
  },
  auras: {
    list: async () => {
      const res = await apiGet<any>('/taxonomies/auras');
      const items = normalizeList(res);
      return wrapList(items.map(mapAuraDefinition));
    },
    create: async (d: any) => apiPost('/taxonomies/auras', toAuraPayload(d)),
    update: async (id: string, d: any) => apiPatch(`/taxonomies/auras/${id}`, toAuraPayload(d)),
    delete: async (id: string) => apiDelete(`/taxonomies/auras/${id}`),
  },
  families: {
    list: async () => {
      const res = await apiGet<any>('/taxonomies/families');
      const items = normalizeList(res);
      return wrapList(items.map(mapFamily));
    },
    create: async (d: any) => apiPost('/taxonomies/families', toFamilyPayload(d)),
    update: async (id: string, d: any) => apiPatch(`/taxonomies/families/${id}`, toFamilyPayload(d)),
    delete: async (id: string) => apiDelete(`/taxonomies/families/${id}`),
  },
  subFamilies: {
    list: async () => {
      const res = await apiGet<any>('/taxonomies/sub-families');
      const items = normalizeList(res);
      return wrapList(items.map(mapSubFamily));
    },
    create: async (d: any) => apiPost('/taxonomies/sub-families', toSubFamilyPayload(d)),
    update: async (id: string, d: any) => apiPatch(`/taxonomies/sub-families/${id}`, toSubFamilyPayload(d)),
    delete: async (id: string) => apiDelete(`/taxonomies/sub-families/${id}`),
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
    list: async () => {
      const res = await apiGet<any>('/taxonomies/filter-tags');
      const items = normalizeList(res);
      return wrapList(items);
    },
    create: async (d: any) => apiPost('/taxonomies/filter-tags', d),
    update: async (id: string, d: any) => apiPatch(`/taxonomies/filter-tags/${id}`, d),
    delete: async (id: string) => apiDelete(`/taxonomies/filter-tags/${id}`),
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
    list: async () => {
      try {
        const res = await apiGet<any>('/settings');
        const items = normalizeList(res);
        return wrapOne(items.map((item: any) => ({
          key: String(item.key),
          value: String(item.value),
          description: item.description ?? undefined,
        })));
      } catch {
        return wrapOne([]);
      }
    },
  },
  subscriptionPricing: {
    get: async () => {
      const res = await apiGet<any>('/subscription-pricing');
      return wrapOne(res);
    },
    update: async (payload: any) => {
      const res = await apiPut<any>('/subscription-pricing', payload);
      return wrapOne(res);
    },
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
      create: (d: any) => apiPost('/taxonomies/filter-tags', d),
      update: (id: string, d: any) => apiPatch(`/taxonomies/filter-tags/${id}`, d),
      delete: (id: string) => apiDelete(`/taxonomies/filter-tags/${id}`),
    },
    filterTags: {
      create: (d: any) => apiPost('/taxonomies/filter-tags', d),
      update: (id: string, d: any) => apiPatch(`/taxonomies/filter-tags/${id}`, d),
      delete: (id: string) => apiDelete(`/taxonomies/filter-tags/${id}`),
    },
    pricing: {
      saveSurcharges: (items: any[]) => apiPost('/pricing-rules/surcharges', items),
      saveSubHypeMultipliers: (items: any[]) => apiPost('/pricing-rules/sub-hype-multipliers', items),
      saveMlDiscounts: (items: any[]) => apiPost('/pricing-rules/ml-discounts', items),
      saveAlacarteMultipliers: (items: any[]) => apiPost('/pricing-rules/alacarte-multipliers', items),
      save2mlTiers: (items: any[]) => apiPost('/pricing-rules/two-ml-tiers', items),
    },
    taxonomies: {
      auras: {
        create: (d: any) => apiPost('/taxonomies/auras', toAuraPayload(d)),
        update: (id: string, d: any) => apiPatch(`/taxonomies/auras/${id}`, toAuraPayload(d)),
        delete: (id: string) => apiDelete(`/taxonomies/auras/${id}`),
      },
      families: {
        create: (d: any) => apiPost('/taxonomies/families', toFamilyPayload(d)),
        update: (id: string, d: any) => apiPatch(`/taxonomies/families/${id}`, toFamilyPayload(d)),
        delete: (id: string) => apiDelete(`/taxonomies/families/${id}`),
      },
      subFamilies: {
        create: (d: any) => apiPost('/taxonomies/sub-families', toSubFamilyPayload(d)),
        update: (id: string, d: any) => apiPatch(`/taxonomies/sub-families/${id}`, toSubFamilyPayload(d)),
        delete: (id: string) => apiDelete(`/taxonomies/sub-families/${id}`),
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

