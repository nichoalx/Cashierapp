import React, { useEffect } from 'react';
import { createBrowserRouter, Outlet, Navigate, useNavigate, useLocation } from 'react-router';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { BottomNav } from './components/BottomNav';
import { useAuth } from './AuthContext';
import HomeScreen from './pages/HomeScreen';
import TransactionLogScreen from './pages/TransactionLogScreen';
import StockScreen from './pages/StockScreen';
import UserScreen from './pages/UserScreen';
import MembersScreen from './pages/MembersScreen';
import WelcomeScreen from './pages/WelcomeScreen';
import LoginScreen from './pages/LoginScreen';
import AppErrorScreen from './pages/AppErrorScreen';

function ProtectedRoot() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <MotionConfig reducedMotion="user">
      <div style={{ flex: 1, position: 'relative', background: '#eef0f5' }}>
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
        <BottomNav />
      </div>
    </MotionConfig>
  );
}

const SPLASH_KEY = 'ama_splash_shown';

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem(SPLASH_KEY);
    if (!alreadyShown && location.pathname !== '/splash') {
      sessionStorage.setItem(SPLASH_KEY, '1');
      navigate('/splash', { replace: true });
    }
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      background: '#dfe3ea',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        maxWidth: 430,
        display: 'flex',
        flexDirection: 'column',
        background: '#eef0f5',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 0 60px rgba(0,0,0,0.12)',
      }}>
        <Outlet />
      </div>
    </div>
  );
}

function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? '/' : '/login'} replace />;
}

export const router = createBrowserRouter([
  {
    Component: AppShell,
    ErrorBoundary: AppErrorScreen,
    children: [
      { path: '/splash', Component: WelcomeScreen },
      { path: '/login', Component: LoginScreen },
      {
        path: '/',
        Component: ProtectedRoot,
        children: [
          { index: true, Component: HomeScreen },
          { path: 'log', Component: TransactionLogScreen },
          { path: 'stock', Component: StockScreen },
          { path: 'profile', Component: UserScreen },
          { path: 'members', Component: MembersScreen }
        ],
      },
    ],
  },
]);
