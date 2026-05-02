"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface DemoModeCtx {
  isDemo: boolean;
  toggle: () => void;
}

const DemoModeContext = createContext<DemoModeCtx>({ isDemo: false, toggle: () => {} });

export function DemoModeProvider({
  children,
  defaultIsDemo,
}: {
  children: React.ReactNode;
  defaultIsDemo: boolean;
}) {
  const [isDemo, setIsDemo] = useState(defaultIsDemo);

  useEffect(() => {
    const stored = localStorage.getItem("factoryos-demo");
    if (stored !== null) setIsDemo(stored === "true");
    else if (defaultIsDemo) localStorage.setItem("factoryos-demo", "true");
  }, [defaultIsDemo]);

  const toggle = () => {
    setIsDemo((prev) => {
      const next = !prev;
      localStorage.setItem("factoryos-demo", String(next));
      return next;
    });
  };

  return (
    <DemoModeContext.Provider value={{ isDemo, toggle }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export const useDemoMode = () => useContext(DemoModeContext);
