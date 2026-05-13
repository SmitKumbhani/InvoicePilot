"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const KILL_SWITCH_STORAGE_KEY = "invoice_app_kill_switch_enabled";
const RESTORE_STEP_TIMEOUT_MS = 8000;

type RestoreStep = "restore-click" | "restore-double-click";
const RESTORE_SEQUENCE: RestoreStep[] = ["restore-click", "restore-double-click"];

type KillSwitchContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
  pushRestoreStep: (step: RestoreStep) => void;
};

const KillSwitchContext = createContext<KillSwitchContextValue | null>(null);

export function KillSwitchProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [restoreIndex, setRestoreIndex] = useState(0);
  const [lastRestoreAt, setLastRestoreAt] = useState(0);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(KILL_SWITCH_STORAGE_KEY);
      if (storedValue === "1") {
        setEnabledState(true);
      }
    } catch {
      // Ignore storage access issues and default to disabled.
    }
  }, []);

  const setEnabled = (nextEnabled: boolean) => {
    setEnabledState(nextEnabled);
    if (!nextEnabled) {
      setRestoreIndex(0);
      setLastRestoreAt(0);
    }
    try {
      window.localStorage.setItem(KILL_SWITCH_STORAGE_KEY, nextEnabled ? "1" : "0");
    } catch {
      // Ignore storage access issues.
    }
  };

  const toggle = () => setEnabled(!enabled);

  const pushRestoreStep = (step: RestoreStep) => {
    if (!enabled) {
      return;
    }

    const now = Date.now();
    const hasTimedOut = restoreIndex > 0 && now - lastRestoreAt > RESTORE_STEP_TIMEOUT_MS;
    const activeIndex = hasTimedOut ? 0 : restoreIndex;

    if (step === RESTORE_SEQUENCE[activeIndex]) {
      const nextIndex = activeIndex + 1;
      if (nextIndex >= RESTORE_SEQUENCE.length) {
        setEnabled(false);
        return;
      }
      setRestoreIndex(nextIndex);
      setLastRestoreAt(now);
      return;
    }

    if (step === RESTORE_SEQUENCE[0]) {
      setRestoreIndex(1);
      setLastRestoreAt(now);
      return;
    }

    setRestoreIndex(0);
    setLastRestoreAt(0);
  };

  const value = useMemo(
    () => ({
      enabled,
      setEnabled,
      toggle,
      pushRestoreStep,
    }),
    [enabled, restoreIndex, lastRestoreAt]
  );

  return <KillSwitchContext.Provider value={value}>{children}</KillSwitchContext.Provider>;
}

export function useKillSwitch() {
  const context = useContext(KillSwitchContext);
  if (!context) {
    throw new Error("useKillSwitch must be used within KillSwitchProvider");
  }
  return context;
}
