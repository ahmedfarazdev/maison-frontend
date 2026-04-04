import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useLocations() {
  const queryClient = useQueryClient();

  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.master.locations();
      return res.data;
    },
  });

  const createLocation = useMutation({
    mutationFn: (data: any) => api.mutations.locations.create(data),
    meta: { successMessage: 'Vault location created successfully' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });

  const updateLocation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.mutations.locations.update(id, data),
    meta: { successMessage: 'Vault location updated successfully' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });

  const clearLocation = useMutation({
    mutationFn: (id: string) => api.mutations.locations.clear(id),
    meta: { successMessage: 'Vault slot cleared successfully' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });

  const deleteLocation = useMutation({
    mutationFn: (id: string) => api.mutations.locations.delete(id),
    meta: { successMessage: 'Vault location deleted successfully' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });

  return {
    locationsQuery,
    createLocation,
    updateLocation,
    clearLocation,
    deleteLocation,
  };
}