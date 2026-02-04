import { Command } from "@langchain/langgraph";
import type { MDDStateType } from "../state/index.js";

const LOG = (msg: string, ...args: unknown[]) => console.log(`[MDD:Executor] ${msg}`, ...args);

/**
 * Nodo Executor (patrón Planner–Executor): ejecuta el plan paso a paso.
 * Recibe mddPlan y mddPlanCurrentStep; invoca el nodo del paso actual y setea currentStepAllowedTools (4.3).
 * Cuando cada nodo termina, el grafo vuelve aquí (si executorControlled); avanzamos el paso o finalizamos.
 */
export function createMddExecutorNode() {
  return async (state: MDDStateType): Promise<Command> => {
    const plan = state.mddPlan;
    if (!plan?.length) {
      LOG("sin plan, volver al manager");
      return new Command({
        update: { executorControlled: false, mddPlanCurrentStep: undefined, mddPlan: undefined, currentStepAllowedTools: undefined, currentStepGoal: undefined },
        goto: "manager",
      });
    }

    const nextStep = (state.mddPlanCurrentStep ?? -1) + 1;
    if (nextStep >= plan.length) {
      LOG("plan completado steps=%s, volver al manager", plan.length);
      return new Command({
        update: { executorControlled: false, mddPlanCurrentStep: undefined, mddPlan: undefined, currentStepAllowedTools: undefined, currentStepGoal: undefined },
        goto: "manager",
      });
    }

    const step = plan[nextStep];
    LOG("ejecutar paso %s/%s node=%s required_tools=%s goal=%s", nextStep + 1, plan.length, step.node, step.required_tools?.length ?? "all", step.goal ? "yes" : "no");
    return new Command({
      update: {
        mddPlanCurrentStep: nextStep,
        currentStepAllowedTools: step.required_tools,
        currentStepGoal: step.goal,
      },
      goto: step.node,
    });
  };
}
