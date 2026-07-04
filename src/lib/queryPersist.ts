import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

/**
 * Persist selected query cache to localStorage so the app boots with data
 * even when offline. Keys prefixed with "no-persist" are skipped.
 */
export function installQueryPersistence(queryClient: QueryClient) {
  if (typeof window === "undefined") return;
  try {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "cem.rq.cache.v1",
      throttleTime: 1000,
    });
    persistQueryClient({
      queryClient,
      persister,
      maxAge: 1000 * 60 * 60 * 24, // 24h
      dehydrateOptions: {
        shouldDehydrateQuery: (q) => {
          if (q.state.status !== "success") return false;
          const key = JSON.stringify(q.queryKey);
          return !key.includes("no-persist");
        },
      },
    });
  } catch (e) {
    console.warn("[query-persist] disabled:", e);
  }
}
