import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ModelListPage } from './pages/models/ModelListPage';
import { CreateModelPage } from './pages/models/CreateModelPage';
import { ModelDetailPage } from './pages/models/ModelDetailPage';
import { AllocationListPage } from './pages/allocation/AllocationListPage';
import { AllocationCreatePage } from './pages/allocation/AllocationCreatePage';
import { AllocationDetailPage } from './pages/allocation/AllocationDetailPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="models" element={<ModelListPage />} />
        <Route path="models/new" element={<CreateModelPage />} />
        <Route path="models/:id" element={<ModelDetailPage />} />
        <Route path="allocation" element={<AllocationListPage />} />
        <Route path="allocation/new" element={<AllocationCreatePage />} />
        <Route path="allocation/:id" element={<AllocationDetailPage />} />
      </Route>
    </Routes>
  );
}
