import { useQuery } from '@tanstack/react-query';
import {
  fetchIssues,
  fetchIssue,
  fetchIdeas,
  fetchIdeaById,
  fetchCategorySummary,
  fetchMeta,
} from '../services/api';

const STALE_TIME = 60_000;
const REFETCH_INTERVAL = 300_000;

interface UseIssuesParams {
  category?: string;
  limit?: number;
  sourceType?: string;
}

export function useIssues(params?: UseIssuesParams) {
  return useQuery({
    queryKey: ['issues', params],
    queryFn: () => fetchIssues(params),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useIssue(id: number) {
  return useQuery({
    queryKey: ['issues', id],
    queryFn: () => fetchIssue(id),
    staleTime: STALE_TIME,
    refetchIntervalInBackground: false,
    enabled: id > 0,
  });
}

interface UseIdeasParams {
  category?: string;
  difficulty?: string;
  limit?: number;
}

export function useIdeas(params?: UseIdeasParams) {
  return useQuery({
    queryKey: ['ideas', params],
    queryFn: () => fetchIdeas(params),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useIdeaById(id: number) {
  return useQuery({
    queryKey: ['ideas', id],
    queryFn: () => fetchIdeaById(id),
    staleTime: STALE_TIME,
    refetchIntervalInBackground: false,
    enabled: id > 0,
  });
}

export function useCategorySummary() {
  return useQuery({
    queryKey: ['category-summary'],
    queryFn: fetchCategorySummary,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: fetchMeta,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}
