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

export type EvdSlideType =
  | "title"
  | "problem_statement"
  | "solution_vision"
  | "current_vs_new"
  | "process_flow"
  | "automations"
  | "key_features"
  | "data_overview"
  | "integrations"
  | "security_access"
  | "rollout_plan"
  | "timeline"
  | "cta";

interface EvdSlideBase {
  id: string;
  type: EvdSlideType;
  order: number;
  title: string;
  speakerNotes?: string;
  /** Base64-encoded background image (added by Visual Stylist Agent). */
  backgroundB64?: string;
  /** Base64-encoded illustration (added by Visual Stylist Agent, selective). */
  illustrationB64?: string;
  /** Visual style applied by the stylist. */
  visualStyle?: "geometric" | "organic" | "minimal" | "data-driven";
}

export interface EvdTitleSlide extends EvdSlideBase {
  type: "title";
  subtitle?: string;
}

export interface EvdProblemStatementSlide extends EvdSlideBase {
  type: "problem_statement";
  painPoints?: string[];
  impact?: string;
  urgency?: string;
}

export interface EvdSolutionVisionSlide extends EvdSlideBase {
  type: "solution_vision";
  description?: string;
  keyOutcomes?: string[];
  targetUsers?: string[];
}

export interface EvdCurrentVsNewSlide extends EvdSlideBase {
  type: "current_vs_new";
  currentLabel?: string;
  currentSteps?: string[];
  newLabel?: string;
  newSteps?: string[];
  improvementSummary?: string;
}

export interface EvdProcessFlowSlide extends EvdSlideBase {
  type: "process_flow";
  steps?: Array<{
    label: string;
    description?: string;
    automated?: boolean;
  }>;
  diagramData?: EvdDiagramData;
}

export interface EvdAutomationsSlide extends EvdSlideBase {
  type: "automations";
  automations?: Array<{
    name: string;
    description?: string;
    timeSaved?: string;
  }>;
  chartData?: EvdChartData;
}

export interface EvdKeyFeaturesSlide extends EvdSlideBase {
  type: "key_features";
  features?: Array<{
    name: string;
    description?: string;
    benefit?: string;
  }>;
}

export interface EvdDataOverviewSlide extends EvdSlideBase {
  type: "data_overview";
  dataTypes?: Array<{
    name: string;
    description?: string;
    sensitivity?: "low" | "medium" | "high";
  }>;
  flows?: Array<{
    from: string;
    to: string;
    description?: string;
  }>;
}

export interface EvdIntegrationsSlide extends EvdSlideBase {
  type: "integrations";
  integrations?: Array<{
    name: string;
    purpose?: string;
    direction?: "inbound" | "outbound" | "bidirectional";
  }>;
}

export interface EvdSecurityAccessSlide extends EvdSlideBase {
  type: "security_access";
  roles?: Array<{
    name: string;
    permissions?: string[];
  }>;
  dataProtection?: string[];
}

export interface EvdRolloutPlanSlide extends EvdSlideBase {
  type: "rollout_plan";
  phases?: Array<{
    label: string;
    description?: string;
    duration?: string;
  }>;
  successCriteria?: string[];
}

export interface EvdTimelineSlide extends EvdSlideBase {
  type: "timeline";
  milestones?: Array<{
    label: string;
    date?: string;
    description?: string;
  }>;
}

export interface EvdCtaSlide extends EvdSlideBase {
  type: "cta";
  description?: string;
  contactInfo?: string;
}

export type EvdSlide =
  | EvdTitleSlide
  | EvdProblemStatementSlide
  | EvdSolutionVisionSlide
  | EvdCurrentVsNewSlide
  | EvdProcessFlowSlide
  | EvdAutomationsSlide
  | EvdKeyFeaturesSlide
  | EvdDataOverviewSlide
  | EvdIntegrationsSlide
  | EvdSecurityAccessSlide
  | EvdRolloutPlanSlide
  | EvdTimelineSlide
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
