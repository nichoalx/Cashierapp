import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface SoybeanProduct {
  id: string;
  name: string;
  fullName: string;
  price: number;
  color: string;
}

export interface PlasticSize {
  id: string;
  size: string;
  price: number;
}

export interface OtherProduct {
  id: string;
  name: string;
  fullName: string;
  price: number;
  color: string;
}

export interface TransactionItem {
  id: string;
  productId: string;
  productName: string;
  productShortName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  color: string;
  plasticSize?: string;
}

export interface Transaction {
  id: string;
  orderNumber: number;
  items: TransactionItem[];
  total: number;
  timestamp: Date;
  remarks?: string;
}

export interface StockItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  lowThreshold: number;
  criticalThreshold: number;
  type: 'soybean' | 'other';
  color: string;
}

interface AppContextType {
  soybeanProducts: SoybeanProduct[];
  plasticSizes: PlasticSize[];
  plasticBasePrice: number;
  otherProducts: OtherProduct[];
  transactions: Transaction[];
  stock: StockItem[];

  updateSoybeanPrice: (id: string, price: number) => void;
  addSoybeanProduct: (name: string, fullName: string, price: number) => void;
  removeSoybeanProduct: (id: string) => void;
  updateOtherPrice: (id: string, price: number) => void;
  updatePlasticBasePrice: (price: number) => void;
  addPlasticSize: (size: string) => void;
  removePlasticSize: (id: string) => void;
  addTransaction: (items: TransactionItem[], remarks?: string) => void;
  updateTransaction: (id: string, items: TransactionItem[]) => void;
  deleteTransaction: (id: string) => void;
  addStock: (productId: string, quantity: number) => void;
}

const AppContext = createContext<AppContextType | null>(null);

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

const INITIAL_SOYBEAN: SoybeanProduct[] = [
  { id: 'mrb', name: 'MRB', fullName: 'Mr. Bean', price: 10000, color: '#f5903d' },
  { id: 'sbs', name: 'SBS', fullName: 'SBS', price: 9500, color: '#4a90d9' },
  { id: 'bh', name: 'BH', fullName: 'Bola Hijau', price: 11000, color: '#52b96a' },
  { id: 'e', name: 'E', fullName: 'Eceran', price: 8500, color: '#9b6dff' },
];

const INITIAL_PLASTIC_SIZES: PlasticSize[] = [
  { id: 'p5x8', size: '5×8', price: 500 },
  { id: 'p10x12', size: '10×12', price: 1500 },
  { id: 'p12x20', size: '12×20', price: 2500 },
];

const INITIAL_OTHER: OtherProduct[] = [
  { id: 'tempe', name: 'T', fullName: 'Tempe', price: 2000, color: '#d4a017' },
  { id: 'dages', name: 'D', fullName: 'Dages', price: 1500, color: '#e05a6a' },
];

const INITIAL_STOCK: StockItem[] = [
  { productId: 'mrb', productName: 'Mr. Bean', quantity: 500, unit: 'kg', lowThreshold: 100, criticalThreshold: 30, type: 'soybean', color: '#f5903d' },
  { productId: 'sbs', productName: 'SBS', quantity: 300, unit: 'kg', lowThreshold: 80, criticalThreshold: 20, type: 'soybean', color: '#4a90d9' },
  { productId: 'bh', productName: 'Bola Hijau', quantity: 45, unit: 'kg', lowThreshold: 100, criticalThreshold: 30, type: 'soybean', color: '#52b96a' },
  { productId: 'e', productName: 'Eceran', quantity: 150, unit: 'kg', lowThreshold: 50, criticalThreshold: 15, type: 'soybean', color: '#9b6dff' },
  { productId: 'plastic', productName: 'Plastic', quantity: 850, unit: 'pcs', lowThreshold: 200, criticalThreshold: 50, type: 'other', color: '#38b2ac' },
  { productId: 'tempe', productName: 'Tempe', quantity: 120, unit: 'pcs', lowThreshold: 150, criticalThreshold: 50, type: 'other', color: '#d4a017' },
  { productId: 'dages', productName: 'Dages', quantity: 25, unit: 'pcs', lowThreshold: 80, criticalThreshold: 20, type: 'other', color: '#e05a6a' },
];

const now = Date.now();
const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 't1', orderNumber: 1,
    items: [{ id: 'i1', productId: 'mrb', productName: 'Mr. Bean', productShortName: 'MRB', quantity: 25.5, unit: 'kg', unitPrice: 10000, total: 255000, color: '#f5903d' }],
    total: 255000, timestamp: new Date(now - 7200000),
  },
  {
    id: 't2', orderNumber: 2,
    items: [
      { id: 'i2', productId: 'sbs', productName: 'SBS', productShortName: 'SBS', quantity: 30, unit: 'kg', unitPrice: 9500, total: 285000, color: '#4a90d9' },
      { id: 'i3', productId: 'tempe', productName: 'Tempe', productShortName: 'T', quantity: 10, unit: 'pcs', unitPrice: 2000, total: 20000, color: '#d4a017' },
    ],
    total: 305000, timestamp: new Date(now - 5400000),
  },
  {
    id: 't3', orderNumber: 3,
    items: [{ id: 'i4', productId: 'bh', productName: 'Bola Hijau', productShortName: 'BH', quantity: 15, unit: 'kg', unitPrice: 11000, total: 165000, color: '#52b96a' }],
    total: 165000, timestamp: new Date(now - 3600000),
  },
  {
    id: 't4', orderNumber: 4,
    items: [{ id: 'i5', productId: 'plastic', productName: 'Plastic 10×12', productShortName: 'P', quantity: 5, unit: 'pcs', unitPrice: 1500, total: 7500, color: '#38b2ac', plasticSize: '10×12' }],
    total: 7500, timestamp: new Date(now - 1800000),
  },
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [soybeanProducts, setSoybeanProducts] = useState<SoybeanProduct[]>(INITIAL_SOYBEAN);
  const [plasticSizes, setPlasticSizes] = useState<PlasticSize[]>(INITIAL_PLASTIC_SIZES);
  const [plasticBasePrice, setPlasticBasePrice] = useState(INITIAL_PLASTIC_SIZES[0]?.price ?? 500);
  const [otherProducts, setOtherProducts] = useState<OtherProduct[]>(INITIAL_OTHER);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [stock, setStock] = useState<StockItem[]>(INITIAL_STOCK);
  const [orderCounter, setOrderCounter] = useState(5);

  const updateSoybeanPrice = useCallback((id: string, price: number) => {
    setSoybeanProducts(p => p.map(x => x.id === id ? { ...x, price } : x));
  }, []);

  const addSoybeanProduct = useCallback((name: string, fullName: string, price: number) => {
    const COLORS = ['#e84393', '#00bcd4', '#ff6b35', '#8bc34a', '#ff9800', '#673ab7'];
    const id = genId();
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    setSoybeanProducts(p => [...p, { id, name, fullName, price, color }]);
    setStock(s => [...s, { productId: id, productName: fullName, quantity: 0, unit: 'kg', lowThreshold: 50, criticalThreshold: 10, type: 'soybean', color }]);
  }, []);

  const removeSoybeanProduct = useCallback((id: string) => {
    setSoybeanProducts(p => p.filter(x => x.id !== id));
    setStock(s => s.filter(x => x.productId !== id));
  }, []);

  const updateOtherPrice = useCallback((id: string, price: number) => {
    setOtherProducts(p => p.map(x => x.id === id ? { ...x, price } : x));
  }, []);

  const updatePlasticBasePrice = useCallback((price: number) => {
    setPlasticBasePrice(price);
    setPlasticSizes(p => p.map(x => ({ ...x, price })));
  }, []);

  const addPlasticSize = useCallback((size: string) => {
    setPlasticSizes(p => [...p, { id: genId(), size, price: plasticBasePrice }]);
  }, [plasticBasePrice]);

  const removePlasticSize = useCallback((id: string) => {
    setPlasticSizes(p => p.filter(x => x.id !== id));
  }, []);

  const addTransaction = useCallback((items: TransactionItem[], remarks?: string) => {
    const total = items.reduce((s, i) => s + i.total, 0);
    const tx: Transaction = { id: genId(), orderNumber: orderCounter, items, total, timestamp: new Date(), remarks };
    setTransactions(p => [tx, ...p]);
    setOrderCounter(c => c + 1);
    // Decrement stock
    setStock(s => s.map(stockItem => {
      const consumed = items.filter(i => i.productId === stockItem.productId || (i.productId === 'plastic' && stockItem.productId === 'plastic'));
      if (consumed.length === 0) return stockItem;
      const totalQty = consumed.reduce((sum, i) => sum + i.quantity, 0);
      return { ...stockItem, quantity: Math.max(0, stockItem.quantity - totalQty) };
    }));
  }, [orderCounter]);

  const updateTransaction = useCallback((id: string, items: TransactionItem[]) => {
    const total = items.reduce((s, i) => s + i.total, 0);
    setTransactions(p => p.map(t => t.id === id ? { ...t, items, total } : t));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(p => p.filter(t => t.id !== id));
  }, []);

  const addStock = useCallback((productId: string, quantity: number) => {
    setStock(s => s.map(item => item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item));
  }, []);

  return (
    <AppContext.Provider value={{
      soybeanProducts, plasticSizes, plasticBasePrice, otherProducts, transactions, stock,
      updateSoybeanPrice, addSoybeanProduct, removeSoybeanProduct,
      updateOtherPrice, updatePlasticBasePrice, addPlasticSize, removePlasticSize,
      addTransaction, updateTransaction, deleteTransaction, addStock,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}

export function formatRupiah(amount: number): string {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(amount));
}