"use client";

import { createContext, useContext } from "react";

interface DemoModeCtx {
  isDemo: boolean;
  toggle: () => void;
}

const DemoModeContext = createContext<DemoModeCtx>({ isDemo: true, toggle: () => {} });

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  return (
    <DemoModeContext.Provider value={{ isDemo: true, toggle: () => {} }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export const useDemoMode = () => useContext(DemoModeContext);
