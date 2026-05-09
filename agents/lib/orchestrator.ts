import { buildAgentContext } from "./compute";
import { runProductionAgent, type ProductionResult } from "./agents/production";
import { runQualityAgent,    type QualityResult    } from "./agents/quality";
import { runPlanningAgent,   type PlanningResult   } from "./agents/planning";

type AgentError = { error: string };

export interface OrchestratorResult {
  computed_at: string;
  shift_id: string;
  context_summary: {
    stations_count:  number;
    units_completed: number;
    hours_remaining: number;
  };
  agents: {
    production: ProductionResult | AgentError;
    quality:    QualityResult    | AgentError;
    planning:   PlanningResult   | AgentError;
  };
}

async function safeRun<T>(fn: () => Promise<T>): Promise<T | AgentError> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[orchestrator] agent error:", message);
    return { error: message };
  }
}

export async function runOrchestrator(shiftId: string): Promise<OrchestratorResult> {
  const context = await buildAgentContext(shiftId);

  const [production, quality, planning] = await Promise.all([
    safeRun(() => runProductionAgent(context)),
    safeRun(() => runQualityAgent(context)),
    safeRun(() => runPlanningAgent(context)),
  ]);

  return {
    computed_at: new Date().toISOString(),
    shift_id: shiftId,
    context_summary: {
      stations_count:  context.stations.length,
      units_completed: context.shift.units_completed_total,
      hours_remaining: context.shift.hours_remaining,
    },
    agents: { production, quality, planning },
  };
}
