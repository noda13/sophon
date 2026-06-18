import { createHashRouter, RouterProvider, Outlet } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { DashboardPage } from './pages/DashboardPage';
import { DigestPage } from './pages/DigestPage';

function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

// Hash routing is intentional: GitHub Pages serves only static files with no
// server-side fallback, so BrowserRouter would 404 on direct deep-link access.
const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'digest', element: <DigestPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
