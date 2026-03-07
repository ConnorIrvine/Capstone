import React, { createContext, useContext, ReactNode } from 'react';
import { useBLE } from '../ble/useBLE';

type BLEContextValue = ReturnType<typeof useBLE>;

const BLEContext = createContext<BLEContextValue | null>(null);

export function BLEProvider({ children }: { children: ReactNode }) {
  const ble = useBLE();
  return <BLEContext.Provider value={ble}>{children}</BLEContext.Provider>;
}

export function useBLEContext(): BLEContextValue {
  const ctx = useContext(BLEContext);
  if (!ctx) throw new Error('useBLEContext must be used inside <BLEProvider>');
  return ctx;
}
