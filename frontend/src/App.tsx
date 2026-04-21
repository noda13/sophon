import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { RankingPage } from './pages/RankingPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout>
        <RankingPage />
      </AppLayout>
    </QueryClientProvider>
  );
}

export default App;
