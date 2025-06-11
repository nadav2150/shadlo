import { useQuery } from '@tanstack/react-query';
import { fetchDashboardData } from '~/lib/api/dashboard';
import type { DashboardData } from '~/lib/api/dashboard';

// Query keys for React Query
export const dashboardKeys = {
  all: ['dashboard'] as const,
  data: ['dashboard', 'data'] as const,
};

// Hook for fetching all dashboard data
export function useDashboardData() {
  return useQuery({
    queryKey: dashboardKeys.data,
    queryFn: fetchDashboardData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    refetchOnWindowFocus: false,
  });
}

// Main hook for dashboard - simplified to use single endpoint
export function useDashboard() {
  return useDashboardData();
} 