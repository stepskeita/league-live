"use client";

import { useEffect, useState } from "react";

/** Re-renders its caller every `intervalMs` — used only to keep a derived "elapsed minute" display fresh, nothing else depends on the return value. */
export function useNowTick(intervalMs = 30000): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
