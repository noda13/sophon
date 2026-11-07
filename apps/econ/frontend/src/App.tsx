import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from './pages/DashboardPage';
import { UserProfileProvider } from './contexts/UserProfileContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 30 * 60 * 1000,
      staleTime: 60 * 1000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProfileProvider>
        <DashboardPage />
      </UserProfileProvider>
    </QueryClientProvider>
  );
}

export default App;
