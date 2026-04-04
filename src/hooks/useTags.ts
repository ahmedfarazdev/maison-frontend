import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useTags() {
  const queryClient = useQueryClient();

  const tagsQuery = useQuery({
    queryKey: ['filterTags'],
    queryFn: async () => {
      const res = await api.master.filterTags();
      return res.data;
    },
  });

  const createTag = useMutation({
    mutationFn: (data: any) => api.mutations.tags.create(data),
    meta: { successMessage: 'Tag created successfully' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filterTags'] });
    },
  });

  const updateTag = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.mutations.tags.update(id, data),
    meta: { successMessage: 'Tag updated successfully' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filterTags'] });
    },
  });

  const deleteTag = useMutation({
    mutationFn: (id: string) => api.mutations.tags.delete(id),
    meta: { successMessage: 'Tag deleted successfully' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filterTags'] });
    },
  });

  return {
    tagsQuery,
    createTag,
    updateTag,
    deleteTag,
  };
}