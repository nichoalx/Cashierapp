import React, { useEffect } from 'react';
import { createBrowserRouter, Outlet, Navigate, useNavigate, useLocation } from 'react-router';
import { BottomNav } from './components/BottomNav';
import { useAuth } from './AuthContext';
import HomeScreen from './pages/HomeScreen';
import TransactionLogScreen from './pages/TransactionLogScreen';
import StockScreen from './pages/StockScreen';
import UserScreen from './pages/UserScreen';
import MembersScreen from './pages/MembersScreen';
import WelcomeScreen from './pages/WelcomeScreen';
import LoginScreen from './pages/LoginScreen';

function ProtectedRoot() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
}

function AppShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const splashShown = sessionStorage.getItem('ama_splash');
    if (!user && !splashShown && location.pathname !== '/splash' && location.pathname !== '/login') {
      sessionStorage.setItem('ama_splash', '1');
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
          { path: 'members', Component: MembersScreen },
        ],
      },
    ],
  },
]);