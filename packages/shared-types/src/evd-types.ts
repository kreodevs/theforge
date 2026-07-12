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
  | "product_overview"
  | "user_flows"
  | "feature_deep_dive"
  | "data_chart"
  | "architecture_diagram"
  | "data_model"
  | "wireframe"
  | "integration_points"
  | "security_model"
  | "deployment_plan"
  | "timeline"
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

export interface EvdProductOverviewSlide extends EvdSlideBase {
  type: "product_overview";
  description: string;
  valueProposition?: string;
  targetUsers?: string[];
}

export interface EvdUserFlowsSlide extends EvdSlideBase {
  type: "user_flows";
  flows?: Array<{
    name: string;
    steps: string[];
    description?: string;
  }>;
}

export interface EvdFeatureDeepDiveSlide extends EvdSlideBase {
  type: "feature_deep_dive";
  featureName?: string;
  description?: string;
  benefits?: string[];
  howItWorks?: string;
}

export interface EvdDataChartSlide extends EvdSlideBase {
  type: "data_chart";
  chartData?: EvdChartData;
}

export interface EvdArchitectureDiagramSlide extends EvdSlideBase {
  type: "architecture_diagram";
  diagramData?: EvdDiagramData;
}

export interface EvdDataModelSlide extends EvdSlideBase {
  type: "data_model";
  entities?: Array<{
    name: string;
    fields: string[];
    description?: string;
  }>;
  diagramData?: EvdDiagramData;
}

export interface EvdWireframeSlide extends EvdSlideBase {
  type: "wireframe";
  wireframeData?: EvdWireframeData;
}

export interface EvdIntegrationPointsSlide extends EvdSlideBase {
  type: "integration_points";
  integrations?: Array<{
    name: string;
    type?: string;
    purpose?: string;
    provider?: string;
  }>;
}

export interface EvdSecurityModelSlide extends EvdSlideBase {
  type: "security_model";
  authMethod?: string;
  roles?: string[];
  dataProtection?: string[];
}

export interface EvdDeploymentPlanSlide extends EvdSlideBase {
  type: "deployment_plan";
  environment?: string;
  phases?: Array<{
    label: string;
    description?: string;
  }>;
  ciCd?: string;
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
  | EvdProductOverviewSlide
  | EvdUserFlowsSlide
  | EvdFeatureDeepDiveSlide
  | EvdDataChartSlide
  | EvdArchitectureDiagramSlide
  | EvdDataModelSlide
  | EvdWireframeSlide
  | EvdIntegrationPointsSlide
  | EvdSecurityModelSlide
  | EvdDeploymentPlanSlide
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
