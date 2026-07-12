export interface EvdBranding {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  highlightColor: string;
  bgColor: string;
  textColor: string;
  fontFamily: string;
  logoUrl?: string | null;
}

export interface EvdChartData {
  chartType: "bar" | "line" | "pie" | "doughnut" | "radar" | "scatter";
  title: string;
  labels: string[];
  datasets: Array<{
    label: string;
    values: number[];
    color: string;
  }>;
}

export interface EvdDiagramData {
  diagramType: "flowchart" | "sequence" | "class" | "er" | "gantt" | "state";
  code: string;
}

export interface EvdWireframeComponent {
  type: "navbar" | "sidebar" | "card" | "chart" | "table" | "form" | "modal" | "button" | "input" | "text" | "image";
  label: string;
  width?: string;
  height?: string;
  x?: number;
  y?: number;
}

export interface EvdWireframeData {
  screenName: string;
  components: EvdWireframeComponent[];
  layout?: "grid" | "flex" | "absolute";
  columns?: number;
}

export type EvdSlideType =
  | "title"
  | "executive_summary"
  | "problem_statement"
  | "solution_overview"
  | "market_analysis"
  | "data_chart"
  | "architecture_diagram"
  | "wireframe"
  | "timeline"
  | "financials"
  | "team"
  | "cta";

interface EvdSlideBase {
  id: string;
  type: EvdSlideType;
  order: number;
  title: string;
  speakerNotes?: string;
}

export interface EvdTitleSlide extends EvdSlideBase {
  type: "title";
  subtitle?: string;
}

export interface EvdExecutiveSummarySlide extends EvdSlideBase {
  type: "executive_summary";
  bullets: string[];
}

export interface EvdProblemStatementSlide extends EvdSlideBase {
  type: "problem_statement";
  problem: string;
  impact?: string;
}

export interface EvdSolutionOverviewSlide extends EvdSlideBase {
  type: "solution_overview";
  description: string;
  keyFeatures?: string[];
  differentiators?: string[];
}

export interface EvdMarketAnalysisSlide extends EvdSlideBase {
  type: "market_analysis";
  chartData?: EvdChartData;
  insights?: string[];
}

export interface EvdDataChartSlide extends EvdSlideBase {
  type: "data_chart";
  chartData?: EvdChartData;
}

export interface EvdArchitectureDiagramSlide extends EvdSlideBase {
  type: "architecture_diagram";
  diagramData?: EvdDiagramData;
}

export interface EvdWireframeSlide extends EvdSlideBase {
  type: "wireframe";
  wireframeData?: EvdWireframeData;
}

export interface EvdTimelineSlide extends EvdSlideBase {
  type: "timeline";
  milestones?: Array<{
    label: string;
    date?: string;
    description?: string;
  }>;
}

export interface EvdFinancialsSlide extends EvdSlideBase {
  type: "financials";
  chartData?: EvdChartData;
}

export interface EvdTeamSlide extends EvdSlideBase {
  type: "team";
  members?: Array<{
    name: string;
    role?: string;
    bio?: string;
  }>;
}

export interface EvdCtaSlide extends EvdSlideBase {
  type: "cta";
  description?: string;
  contactInfo?: string;
}

export type EvdSlide =
  | EvdTitleSlide
  | EvdExecutiveSummarySlide
  | EvdProblemStatementSlide
  | EvdSolutionOverviewSlide
  | EvdMarketAnalysisSlide
  | EvdDataChartSlide
  | EvdArchitectureDiagramSlide
  | EvdWireframeSlide
  | EvdTimelineSlide
  | EvdFinancialsSlide
  | EvdTeamSlide
  | EvdCtaSlide;

export interface EVDJSON {
  meta: {
    title: string;
    subtitle?: string;
    brand?: string;
    totalSlides?: number;
  };
  branding?: EvdBranding;
  slides: EvdSlide[];
}

export function parseEvdJson(raw: string | null | undefined): EVDJSON | null {
  if (!raw?.trim()) return null;
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned) as EVDJSON;
    if (parsed?.slides && Array.isArray(parsed.slides)) return parsed;
    return null;
  } catch {
    return null;
  }
}
