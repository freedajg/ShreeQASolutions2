import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { AuthProvider } from './lib/auth/AuthProvider';
import { QueryCacheGuard } from './lib/data/QueryCacheGuard';
import { createQueryClient } from './lib/data/queryClient';
import './index.css';

const queryClient = createQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <QueryCacheGuard />
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
