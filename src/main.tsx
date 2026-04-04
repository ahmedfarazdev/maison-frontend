import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App";
import "./index.css";
import { UNAUTHED_ERR_MSG } from '@/shared/const';
import { getLoginUrl } from "./const";

const redirectToLoginIfUnauthorized = (error: any) => {
  if (typeof window === "undefined") return false;
  const isUnauthorized = error?.message === UNAUTHED_ERR_MSG || error?.status === 401;
  if (isUnauthorized) {
    window.location.href = getLoginUrl();
    return true;
  }
  return false;
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: any, query) => {
      const isHandled = redirectToLoginIfUnauthorized(error);
      if (!isHandled && query.meta?.errorMessage) {
        toast.error(
          typeof query.meta.errorMessage === 'string'
            ? query.meta.errorMessage
            : error?.message || "Failed to load data"
        );
      }
    }
  }),
  mutationCache: new MutationCache({
    onSuccess: (data, _variables, _context, mutation) => {
      if (mutation.meta?.successMessage) {
        toast.success(mutation.meta.successMessage as string);
      }
    },
    onError: (error: any, _variables, _context, mutation) => {
      const isHandled = redirectToLoginIfUnauthorized(error);
      if (!isHandled) {
        // Only show toast if the mutation hasn't opted out via meta.suppressError
        if (!mutation.meta?.suppressError) {
          toast.error(error?.message || "Operation failed", {
            description: mutation.meta?.errorMessage as string | undefined,
          });
        }
      }
    }
  }),
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
      retry: (failureCount, error: any) => {
        if (error?.message === UNAUTHED_ERR_MSG || error?.status === 401) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
