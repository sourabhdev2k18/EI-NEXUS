import { Suspense } from 'react';
import { AppRoutes } from './routes/AppRoutes.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';
import { Loader } from './components/ui/Loader.jsx';

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loader label="Loading EI-Nexus..." />}>
        <AppRoutes />
      </Suspense>
    </ErrorBoundary>
  );
}
