import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useTaxonomies() {
  const queryClient = useQueryClient();

  const aurasQuery = useQuery({
    queryKey: ['auras'],
    queryFn: async () => {
      const res = await api.master.auras();
      return res.data;
    },
  });

  const familiesQuery = useQuery({
    queryKey: ['families'],
    queryFn: async () => {
      const res = await api.master.families();
      return res.data;
    },
  });

  const subFamiliesQuery = useQuery({
    queryKey: ['subFamilies'],
    queryFn: async () => {
      const res = await api.master.subFamilies();
      return res.data;
    },
  });

  const createAura = useMutation({
    mutationFn: (data: any) => api.mutations.taxonomies.auras.create(data),
    meta: { successMessage: 'Aura created successfully' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auras'] }),
  });

  const updateAura = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.mutations.taxonomies.auras.update(id, data),
    meta: { successMessage: 'Aura updated successfully' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auras'] }),
  });

  const deleteAura = useMutation({
    mutationFn: (id: string) => api.mutations.taxonomies.auras.delete(id),
    meta: { successMessage: 'Aura deleted successfully' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auras'] }),
  });

  const createFamily = useMutation({
    mutationFn: (data: any) => api.mutations.taxonomies.families.create(data),
    meta: { successMessage: 'Family created successfully' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['families'] }),
  });

  const updateFamily = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.mutations.taxonomies.families.update(id, data),
    meta: { successMessage: 'Family updated successfully' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['families'] }),
  });

  const deleteFamily = useMutation({
    mutationFn: (id: string) => api.mutations.taxonomies.families.delete(id),
    meta: { successMessage: 'Family deleted successfully' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['families'] }),
  });

  const createSubFamily = useMutation({
    mutationFn: (data: any) => api.mutations.taxonomies.subFamilies.create(data),
    meta: { successMessage: 'Sub-Family created successfully' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subFamilies'] }),
  });

  const updateSubFamily = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.mutations.taxonomies.subFamilies.update(id, data),
    meta: { successMessage: 'Sub-Family updated successfully' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subFamilies'] }),
  });

  const deleteSubFamily = useMutation({
    mutationFn: (id: string) => api.mutations.taxonomies.subFamilies.delete(id),
    meta: { successMessage: 'Sub-Family deleted successfully' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subFamilies'] }),
  });

  return {
    aurasQuery, familiesQuery, subFamiliesQuery,
    createAura, updateAura, deleteAura,
    createFamily, updateFamily, deleteFamily,
    createSubFamily, updateSubFamily, deleteSubFamily,
  };
}