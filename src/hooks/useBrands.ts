import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Brand } from '@/types';
import { api } from '@/lib/api-client'; // Wait, let's just write raw fetch commands for full control

const API_BASE = import.meta.env.VITE_API_URL?.replace('/v1', '') || 'http://localhost:3001/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('sb-access-token') || '';
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

export const fetchBrands = async (): Promise<Brand[]> => {
  const res = await fetch(`${API_BASE}/brands`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch brands');
  const result = await res.json();
  
  // Map backend response array to frontend Brand format
  return (result || []).map((b: any) => ({
    id: b.id, // Database UUID
    brand_id: b.brandId,
    name: b.name,
    made_in: b.madeIn,
    notes: b.notes,
    logo_url: b.logoUrl,
    active: b.active,
    created_at: b.createdAt
  }));
};

export const createBrand = async (brand: Partial<Brand>): Promise<void> => {
  const payload = {
    brandId: brand.brand_id,
    name: brand.name,
    madeIn: brand.made_in,
    notes: brand.notes,
    logoUrl: brand.logo_url,
    active: brand.active ?? true,
  };
  
  const res = await fetch(`${API_BASE}/brands`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to create brand');
  }
};

export const updateBrand = async (id: string, brand: Partial<Brand>): Promise<void> => {
  const payload = {
    brandId: brand.brand_id,
    name: brand.name,
    madeIn: brand.made_in,
    notes: brand.notes,
    logoUrl: brand.logo_url,
    active: brand.active,
  };
  
  const res = await fetch(`${API_BASE}/brands/${id}`, {
    method: 'PATCH',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update brand');
};

export const deleteBrand = async (id: string): Promise<void> => {
  // Soft delete via patch to be safe, or direct delete if backend supports it.
  const res = await fetch(`${API_BASE}/brands/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete brand');
};

export function useBrands() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['brands'],
    queryFn: fetchBrands,
    staleTime: 5 * 60 * 1000,
  });

  const addBrand = useMutation({
    mutationFn: createBrand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
    meta: {
      successMessage: 'Brand added successfully',
    }
  });

  const editBrand = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Brand> }) => updateBrand(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
  });

  const removeBrand = useMutation({
    mutationFn: deleteBrand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
  });

  return {
    brands: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    addBrand,
    editBrand,
    removeBrand,
    refetch: query.refetch
  };
}
