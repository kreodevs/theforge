/** EVD Design System — consulting-grade tokens for all renderers */

export interface EvdBranding {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  highlightColor?: string;
  bgColor?: string;
  textColor?: string;
  fontFamily?: string;
  logoUrl?: string | null;
}

export interface EvdDesignTheme {
  colors: {
    text: string;
    textLight: string;
    textMuted: string;
    bg: string;
    bgSubtle: string;
    bgDark: string;
    border: string;
    gridLine: string;
    brandPrimary: string;
    brandSecondary: string;
    brandAccent: string;
    highlight: string;
    positive: string;
    negative: string;
    neutral: string;
    white: string;
  };
  typography: {
    family: string;
    titleSize: number;
    subtitleSize: number;
    bodySize: number;
    captionSize: number;
    lineHeight: number;
  };
  spacing: {
    slideMargin: number;
    titleY: number;
    bodyY: number;
    footerY: number;
    sidebarWidth: number;
  };
}

const DEFAULTS: EvdBranding = {
  primaryColor: "#0F172A",
  secondaryColor: "#1E293B",
  accentColor: "#3B82F6",
  highlightColor: "#F59E0B",
  bgColor: "#FFFFFF",
  textColor: "#0F172A",
  fontFamily: "Inter",
};

export function buildTheme(branding?: EvdBranding | null): EvdDesignTheme {
  const b = { ...DEFAULTS, ...branding };
  return {
    colors: {
      text: b.textColor ?? "#0F172A",
      textLight: "#475569",
      textMuted: "#94A3B8",
      bg: b.bgColor ?? "#FFFFFF",
      bgSubtle: "#F8FAFC",
      bgDark: "#0F172A",
      border: "#E2E8F0",
      gridLine: "#F1F5F9",
      brandPrimary: b.primaryColor ?? DEFAULTS.primaryColor!,
      brandSecondary: b.secondaryColor ?? DEFAULTS.secondaryColor!,
      brandAccent: b.accentColor ?? DEFAULTS.accentColor!,
      highlight: b.highlightColor ?? DEFAULTS.highlightColor!,
      positive: "#10B981",
      negative: "#EF4444",
      neutral: "#64748B",
      white: "#FFFFFF",
    },
    typography: {
      family: b.fontFamily ?? "Inter",
      titleSize: 28,
      subtitleSize: 16,
      bodySize: 13,
      captionSize: 10,
      lineHeight: 1.4,
    },
    spacing: {
      slideMargin: 0.5,
      titleY: 0.3,
      bodyY: 1.4,
      footerY: 6.9,
      sidebarWidth: 2.8,
    },
  };
}

/** Palette array for echarts: primary, secondary, accent, highlight + neutral fallbacks */
export function chartPalette(theme: EvdDesignTheme): string[] {
  return [
    theme.colors.brandAccent,
    theme.colors.highlight,
    theme.colors.positive,
    theme.colors.brandPrimary,
    theme.colors.neutral,
    theme.colors.negative,
  ];
}

/** Generate a lighter variant of a hex color (for fills, backgrounds) */
export function lighten(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Darken a hex color */
export function darken(hex: string, factor: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - factor));
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - factor));
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - factor));
  return `rgb(${r},${g},${b})`;
}
