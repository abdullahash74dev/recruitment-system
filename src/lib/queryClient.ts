import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { logClientError } from "@/lib/errorLog";

/**
 * Exported as its own module (rather than declared inline in App.tsx) so
 * non-component code — ad-hoc singleton-cache hooks like useSiteSettings,
 * useDropdownOptions, useFieldConfig — can call queryClient.fetchQuery/
 * invalidateQueries directly without a circular import on App.tsx.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      logClientError({
        severity: "error",
        source: "query",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
        context: { queryKey: query.queryKey },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      logClientError({
        severity: "error",
        source: "mutation",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
        context: { mutationKey: mutation.options.mutationKey },
      });
    },
  }),
});
