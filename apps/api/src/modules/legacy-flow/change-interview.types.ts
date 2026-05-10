/**
 * @fileoverview Tipos para el ChangeInterviewService.
 * Define ChangeScope, InterviewState, AffectedRoute, etc.
 */

export type InterviewStatus =
  | "in_progress"       // Conversación activa
  | "pending_confirmation" // AI propuso scope, esperando confirmación
  | "confirmed"         // Usuario confirmó
  | "cancelled";        // Usuario canceló

export interface InterviewMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface InterviewState {
  sessionId: string;
  projectId: string;
  stageId?: string;
  description: string;
  messages: InterviewMessage[];
  status: InterviewStatus;
  navigationMapSnapshot: string | null;
  relevantRoutes: AffectedRoute[];
  affectedComponents: string[];
  changeScope: ChangeScope | null;
}

export interface NavigationMapSummary {
  routes: {
    url: string;
    screenName: string;
    componentPath: string;
    forms: number;
    endpoints: number;
    subComponents: number;
  }[];
  sharedComponents: {
    name: string;
    path: string;
    usedInRoutes: string[];
  }[];
  framework: string;
  apiClient?: {
    name: string;
    baseUrl: string;
    method: string;
  };
}

export interface AffectedRoute {
  url: string;
  screen: string;
  components: string[];
  changeType: "add_field" | "modify_field" | "new_form" | "new_route" | "other";
  matchScore?: number;
}

export interface AffectedEndpoint {
  method: string;
  path: string;
  changeType: "add" | "modify" | "remove";
}

export interface NewFieldSpec {
  component: string;
  form: string;
  field: string;
  type: string;
  validation?: string;
  afterField?: string;
}

export interface ChangeScope {
  confirmed: boolean;
  description: string;
  affectedRoutes: {
    url: string;
    screen: string;
    components: string[];
    changeType: string;
  }[];
  affectedEndpoints: {
    method: string;
    path: string;
    changeType: string;
  }[];
  newFields?: NewFieldSpec[];
  sharedComponentsImpacted: string[];
  userConfirmation: boolean;
}
