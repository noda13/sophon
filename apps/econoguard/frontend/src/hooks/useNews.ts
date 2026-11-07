import { useQuery } from '@tanstack/react-query';
import { fetchNews } from '../services/api';

const NEWS_LIMIT = 50;

export function useNews() {
  return useQuery({
    queryKey: ['news'],
    queryFn: () => fetchNews(NEWS_LIMIT),
  });
}
