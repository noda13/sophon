import { useSearchParams } from 'react-router-dom';
import Header from '../components/layout/Header';
import CategoryHeatmap from '../components/dashboard/CategoryHeatmap';
import IssueFeed from '../components/dashboard/IssueFeed';
import TopIdeasPanel from '../components/dashboard/TopIdeasPanel';
import { useMeta } from '../hooks/useIssues';
import { formatDate } from '../lib/formatters';

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') ?? undefined;
  const { data: meta } = useMeta();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {meta?.lastUpdated && (
          <section className="mb-4 flex items-center justify-end">
            <span className="text-xs text-gray-500">
              最終更新: {formatDate(meta.lastUpdated)}
            </span>
          </section>
        )}

        <div className="mb-6">
          <CategoryHeatmap />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <IssueFeed category={category} />
          </div>
          <div>
            <TopIdeasPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
