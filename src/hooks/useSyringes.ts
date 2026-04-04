import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useSyringes() {
  const queryClient = useQueryClient();

  const syringesQuery = useQuery({
    queryKey: ['syringes'],
    queryFn: async () => {
      const res = await api.master.syringes();
      return res.data;
    },
  });

  const createSyringe = useMutation({
    mutationFn: (data: any) => api.mutations.syringes.create(data),
    meta: { successMessage: 'Syringe created successfully' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syringes'] });
    },
  });

  const updateSyringe = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.mutations.syringes.update(id, data),
    meta: { successMessage: 'Syringe updated successfully' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syringes'] });
    },
  });

  const deleteSyringe = useMutation({
    mutationFn: (id: string) => api.mutations.syringes.delete(id),
    meta: { successMessage: 'Syringe deleted successfully' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syringes'] });
    },
  });

  return {
    syringesQuery,
    createSyringe,
    updateSyringe,
    deleteSyringe,
  };
}