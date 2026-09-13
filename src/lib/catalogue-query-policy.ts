/**
 * Product catalogue data changes rarely and every checkout revalidates the
 * authoritative price and stock on the server. Keep catalogue responses warm
 * while a customer browses, without applying the same policy to account or
 * admin queries.
 */
export const CATALOGUE_QUERY_OPTIONS = {
  staleTime: 30 * 60 * 1000,
  gcTime: 2 * 60 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const;
