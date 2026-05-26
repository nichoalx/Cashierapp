import { createBrowserRouter, Outlet, Navigate, useLocation } from 'react-router';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { BottomNav } from './components/BottomNav';
import { useAuth } from './AuthContext';
import { BouncingLoader } from './components/Loader';
import HomeScreen from './pages/HomeScreen';
import TransactionLogScreen from './pages/TransactionLogScreen';
import StockScreen from './pages/StockScreen';
import UserScreen from './pages/UserScreen';
import MembersScreen from './pages/MembersScreen';
import MemberDetailScreen from './pages/MemberDetailScreen';
import OrderDetailScreen from './pages/OrderDetailScreen';
import WelcomeScreen from './pages/WelcomeScreen';
import GoodMorningScreen from './pages/GoodMorningScreen';
import LoginScreen from './pages/LoginScreen';
import AppErrorScreen from './pages/AppErrorScreen';

function ProtectedRoot() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <BouncingLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <MotionConfig reducedMotion="user">
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#eef0f5', overflow: 'hidden', overscrollBehavior: 'none' }}>
        <AnimatePresence mode="sync" initial={true}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.01 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
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

// Show the splash once per browser/app load, similar to a native cold start.
let hasShownSplashThisLoad = false;

function AppShell() {
  const location = useLocation();

  if (location.pathname === '/splash') {
    hasShownSplashThisLoad = true;
  } else if (!hasShownSplashThisLoad) {
    hasShownSplashThisLoad = true;
    return <Navigate to="/splash" replace />;
  }

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      overflow: 'hidden',
      overscrollBehavior: 'none',
      background: '#dfe3ea',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
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

export const router = createBrowserRouter([
  {
    Component: AppShell,
    ErrorBoundary: AppErrorScreen,
    children: [
      { path: '/splash',   Component: WelcomeScreen },
      { path: '/morning',  Component: GoodMorningScreen },
      { path: '/login',    Component: LoginScreen },
      {
        path: '/',
        Component: ProtectedRoot,
        children: [
          { index: true, Component: HomeScreen },
          { path: 'log', Component: TransactionLogScreen },
          { path: 'stock', Component: StockScreen },
          { path: 'profile', Component: UserScreen },
          { path: 'members', Component: MembersScreen },
          { path: 'members/:memberId', Component: MemberDetailScreen },
          { path: 'order/:txId', Component: OrderDetailScreen },
        ],
      },
    ],
  },
]);
