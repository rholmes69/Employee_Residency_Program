import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { PageLoader } from './components/ui';
import Login from './pages/Login';
import Home from './pages/Home';
import ApplicationForm from './pages/ApplicationForm';
import SupervisorQueue from './pages/SupervisorQueue';
import ApplicationDetail from './pages/ApplicationDetail';
import ReviewList from './pages/ReviewList';
import Admin from './pages/Admin';

function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { me } = useAuth();
  return me && roles.includes(me.role) ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const { me, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!me) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="application" element={<ApplicationForm />} />
        <Route path="supervisor" element={<SupervisorQueue />} />
        <Route path="supervisor/:id" element={<ApplicationDetail />} />
        <Route
          path="review"
          element={
            <RequireRole roles={['REVIEWER', 'ADMIN']}>
              <ReviewList />
            </RequireRole>
          }
        />
        <Route
          path="review/:id"
          element={
            <RequireRole roles={['REVIEWER', 'ADMIN']}>
              <ApplicationDetail />
            </RequireRole>
          }
        />
        <Route
          path="admin/*"
          element={
            <RequireRole roles={['ADMIN']}>
              <Admin />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
