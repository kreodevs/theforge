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
    bg: string;
    bgSubtle: string;
    border: string;
    gridLine: string;
    brandPrimary: string;
    brandSecondary: string;
    brandAccent: string;
    highlight: string;
    positive: string;
    negative: string;
    neutral: string;
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
  };
}

const DEFAULTS: EvdBranding = {
  primaryColor: "#1a1a2e",
  secondaryColor: "#16213e",
  accentColor: "#0f3460",
  highlightColor: "#e94560",
  bgColor: "#ffffff",
  textColor: "#1a1a2e",
  fontFamily: "Inter",
};

export function buildTheme(branding?: EvdBranding | null): EvdDesignTheme {
  const b = { ...DEFAULTS, ...branding };
  return {
    colors: {
      text: b.textColor ?? "#1a1a2e",
      textLight: "#6B7280",
      bg: b.bgColor ?? "#ffffff",
      bgSubtle: "#F9FAFB",
      border: "#E5E7EB",
      gridLine: "#F3F4F6",
      brandPrimary: b.primaryColor ?? DEFAULTS.primaryColor!,
      brandSecondary: b.secondaryColor ?? DEFAULTS.secondaryColor!,
      brandAccent: b.accentColor ?? DEFAULTS.accentColor!,
      highlight: b.highlightColor ?? DEFAULTS.highlightColor!,
      positive: "#059669",
      negative: "#DC2626",
      neutral: "#6B7280",
    },
    typography: {
      family: b.fontFamily ?? "Inter",
      titleSize: 24,
      subtitleSize: 14,
      bodySize: 12,
      captionSize: 9,
      lineHeight: 1.3,
    },
    spacing: {
      slideMargin: 0.5,
      titleY: 0.3,
      bodyY: 1.2,
      footerY: 6.9,
    },
  };
}

/** Palette array for echarts: primary, secondary, accent, highlight + neutral fallbacks */
export function chartPalette(theme: EvdDesignTheme): string[] {
  return [
    theme.colors.brandPrimary,
    theme.colors.brandSecondary,
    theme.colors.brandAccent,
    theme.colors.highlight,
    theme.colors.positive,
    theme.colors.neutral,
  ];
}
