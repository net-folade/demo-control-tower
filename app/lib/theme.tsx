"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark";

export type ChartColors = {
  surface: string;
  grid: string;
  axis: string;
  tick: string;
  tickStrong: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipLabel: string;
  tooltipItem: string;
  cursor: string;
  barCursor: string;
  gradientStop: string;
  borderSubtle: string;
  accent: {
    emerald: string;
    amber: string;
    cyan: string;
    violet: string;
    rose: string;
    blue: string;
  };
};

const DARK: ChartColors = {
  surface: "#0a0a0a",
  grid: "#262626",
  axis: "#404040",
  tick: "#737373",
  tickStrong: "#a3a3a3",
  tooltipBg: "#0a0a0a",
  tooltipBorder: "#262626",
  tooltipLabel: "#a3a3a3",
  tooltipItem: "#e5e5e5",
  cursor: "#404040",
  barCursor: "#171717",
  gradientStop: "#0a0a0a",
  borderSubtle: "#262626",
  accent: {
    emerald: "#34d399",
    amber: "#fbbf24",
    cyan: "#22d3ee",
    violet: "#a78bfa",
    rose: "#fb7185",
    blue: "#60a5fa",
  },
};

const LIGHT: ChartColors = {
  surface: "#ffffff",
  grid: "#e5e5e5",
  axis: "#a3a3a3",
  tick: "#525252",
  tickStrong: "#171717",
  tooltipBg: "#ffffff",
  tooltipBorder: "#d4d4d4",
  tooltipLabel: "#525252",
  tooltipItem: "#171717",
  cursor: "#a3a3a3",
  barCursor: "#f5f5f5",
  gradientStop: "#ffffff",
  borderSubtle: "#e5e5e5",
  accent: {
    emerald: "#059669",
    amber: "#b45309",
    cyan: "#0e7490",
    violet: "#6d28d9",
    rose: "#be123c",
    blue: "#1d4ed8",
  },
};

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
  colors: ChartColors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readInitialTheme());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.style.colorScheme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(
    () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggle,
      colors: theme === "light" ? LIGHT : DARK,
    }),
    [theme, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Hook called outside provider — fall back to dark so charts still render.
    return { theme: "dark", setTheme: () => {}, toggle: () => {}, colors: DARK };
  }
  return ctx;
}

export function useChartColors(): ChartColors {
  return useTheme().colors;
}

/** Inline script injected pre-paint to avoid FOUC. */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('theme');var t=s==='light'||s==='dark'?s:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(t);r.style.colorScheme=t;}catch(e){}})();`;
