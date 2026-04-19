import React from 'react';
import { createBrowserRouter, Outlet } from 'react-router';
import { BottomNav } from './components/BottomNav';
import HomeScreen from './pages/HomeScreen';
import TransactionLogScreen from './pages/TransactionLogScreen';
import StockScreen from './pages/StockScreen';

function Root() {
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
        <BottomNav />
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true, Component: HomeScreen },
      { path: 'log', Component: TransactionLogScreen },
      { path: 'stock', Component: StockScreen },
    ],
  },
]);