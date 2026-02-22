"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type TimerState = {
  endTime: number | null;
  label: string | null;
  done: string | null;
};

type TimerContextValue = TimerState & {
  startTimer: (minutes: number, label: string) => void;
  stopTimer: () => void;
};

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [endTime, setEndTime] = useState<number | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const startTimer = useCallback((minutes: number, timerLabel: string) => {
    setEndTime(Date.now() + minutes * 60 * 1000);
    setLabel(timerLabel);
    setDone(null);
  }, []);

  const stopTimer = useCallback(() => {
    setEndTime(null);
    setLabel(null);
    setDone(null);
  }, []);

  useEffect(() => {
    if (endTime == null) return;
    const id = setInterval(() => {
      const now = Date.now();
      if (now >= endTime) {
        setDone(label);
        setEndTime(null);
        setLabel(null);
      }
      setTick((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [endTime, label]);

  useEffect(() => {
    if (done == null) return;
    const t = setTimeout(() => setDone(null), 3000);
    return () => clearTimeout(t);
  }, [done]);

  const remainingSeconds =
    endTime != null ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) : 0;

  const value: TimerContextValue = {
    endTime,
    label,
    done,
    startTimer,
    stopTimer,
  };

  return (
    <TimerContext.Provider value={value}>
      {children}
      <TimerPill
        remainingSeconds={remainingSeconds}
        label={label}
        done={done}
        onStop={stopTimer}
      />
    </TimerContext.Provider>
  );
}

function TimerPill({
  remainingSeconds,
  label,
  done,
  onStop,
}: {
  remainingSeconds: number;
  label: string | null;
  done: string | null;
  onStop: () => void;
}) {
  const show = (remainingSeconds > 0 && label) || done;
  if (!show) return null;

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const display = done ? "Done!" : `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <div
      className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-2.5 shadow-lg ring-1 ring-border/40"
      style={{ fontFamily: "var(--font-accent)" }}
    >
      {done ? (
        <>
          <span className="text-sm font-semibold text-terracotta">{display}</span>
          {done && <span className="text-xs text-warm-gray">{done}</span>}
        </>
      ) : (
        <>
          <span className="tabular-nums text-sm font-semibold text-espresso">
            {display}
          </span>
          {label && (
            <span className="max-w-[120px] truncate text-xs text-warm-gray">
              {label}
            </span>
          )}
          <button
            type="button"
            onClick={onStop}
            className="rounded border border-border/60 px-2 py-1 text-xs font-medium text-warm-gray transition-colors hover:border-terracotta/40 hover:text-terracotta"
          >
            Stop
          </button>
        </>
      )}
    </div>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}
