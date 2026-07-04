import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

// Duplicate query-core versions (react-query re-exports its own) cause type
// friction; accept an untyped client here.
type AnyQueryClient = Parameters<typeof persistQueryClient>[0]["queryClient"];

export function installQueryPersistence(queryClient: AnyQueryClient) {
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
