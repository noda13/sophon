import { createFileRoute } from '@tanstack/react-router';
import { prefetchEconDashboard } from '../../features/econ/composables/useEconDashboard';
import { EconDashboardPage } from '../../features/econ/pages/EconDashboardPage';

export const Route = createFileRoute('/econ/')({
  // 失敗の表示は各 composable の error に任せるため、先読みは失敗しても遷移を止めない
  loader: ({ context: { queryClient } }) => prefetchEconDashboard(queryClient),
  component: EconDashboardPage,
});
