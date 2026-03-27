import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { UNAUTHED_ERR_MSG } from '@/shared/const';
import { getLoginUrl } from "./const";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.message === UNAUTHED_ERR_MSG || error?.status === 401) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

const redirectToLoginIfUnauthorized = (error: any) => {
  if (typeof window === "undefined") return;
  const isUnauthorized = error?.message === UNAUTHED_ERR_MSG || error?.status === 401;
  if (isUnauthorized) {
    window.location.href = getLoginUrl();
  }
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.mutation.state.error);
  }
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
