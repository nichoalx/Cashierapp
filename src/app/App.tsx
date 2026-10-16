import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { router } from './routes';
import { AppProvider } from './store';
import { AuthProvider } from './AuthContext';

function ViewportSync() {
  useEffect(() => {
    const root = document.documentElement;

    const syncViewport = () => {
      const viewport = window.visualViewport;
      root.style.setProperty('--app-visual-height', `${viewport?.height ?? window.innerHeight}px`);
      root.style.setProperty('--app-visual-offset-top', `${viewport?.offsetTop ?? 0}px`);
    };

    syncViewport();
    window.visualViewport?.addEventListener('resize', syncViewport);
    window.visualViewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);

    return () => {
      window.visualViewport?.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
    };
  }, []);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ViewportSync />
      <Toaster
        position="top-center"
        richColors
        offset={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
        mobileOffset={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      />
      <AppProvider>
        <RouterProvider router={router} />
      </AppProvider>
    </AuthProvider>
  );
}
