import { useQuery } from '@tanstack/react-query';
import { fetchEntities, fetchAwsEntities, fetchGoogleEntities } from '~/lib/api/entities';
import type { LoaderData } from '~/routes/entities';

// Query keys for React Query
export const entitiesKeys = {
  all: ['entities'] as const,
  aws: ['entities', 'aws'] as const,
  google: ['entities', 'google'] as const,
  combined: ['entities', 'combined'] as const,
};

// Hook for fetching all entities (combined AWS and Google)
export function useEntities() {
  return useQuery({
    queryKey: entitiesKeys.combined,
    queryFn: fetchEntities,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    refetchOnWindowFocus: false,
  });
}

// Hook for fetching AWS entities only
export function useAwsEntities() {
  return useQuery({
    queryKey: entitiesKeys.aws,
    queryFn: fetchAwsEntities,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    refetchOnWindowFocus: false,
  });
}

// Hook for fetching Google entities only
export function useGoogleEntities() {
  return useQuery({
    queryKey: entitiesKeys.google,
    queryFn: fetchGoogleEntities,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    refetchOnWindowFocus: false,
  });
}

// Hook for getting combined entities data with loading states
export function useCombinedEntities() {
  const awsQuery = useAwsEntities();
  const googleQuery = useGoogleEntities();

  const isLoading = awsQuery.isLoading || googleQuery.isLoading;
  const isError = awsQuery.isError || googleQuery.isError;
  const error = awsQuery.error || googleQuery.error;

  // Combine the data
  const combinedData: LoaderData = {
    users: [
      ...(awsQuery.data?.users || []),
      ...(googleQuery.data?.users || []),
    ],
    roles: awsQuery.data?.roles || [],
    error: awsQuery.data?.error || googleQuery.data?.error || null,
    credentials: awsQuery.data?.credentials || null,
    googleCredentialsValid: googleQuery.isSuccess,
    hasGoogleRefreshToken: undefined, // This would need to be fetched separately
    refreshTokenValid: undefined, // This would need to be fetched separately
  };

  return {
    data: combinedData,
    isLoading,
    isError,
    error,
    isSuccess: awsQuery.isSuccess || googleQuery.isSuccess,
  };
} 