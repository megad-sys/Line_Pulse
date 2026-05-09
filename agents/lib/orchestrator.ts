import { buildAgentContext } from "./compute";
import { runBottleneckAgent, type BottleneckResult } from "./agents/bottleneck";
import { runQualityAgent,    type QualityResult    } from "./agents/quality";
import { runPlanningAgent,   type PlanningResult   } from "./agents/planning";
import { runShiftAgent,      type ShiftResult      } from "./agents/shift";

type AgentError = { error: string };

export interface OrchestratorResult {
  computed_at: string;
  shift_id: string;
  context_summary: {
    stations_count:    number;
    units_completed:   number;
    hours_remaining:   number;
  };
  agents: {
    bottleneck: BottleneckResult | AgentError;
    quality:    QualityResult    | AgentError;
    planning:   PlanningResult   | AgentError;
    shift:      ShiftResult      | AgentError;
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

  const [bottleneck, quality, planning, shift] = await Promise.all([
    safeRun(() => runBottleneckAgent(context)),
    safeRun(() => runQualityAgent(context)),
    safeRun(() => runPlanningAgent(context)),
    safeRun(() => runShiftAgent(context)),
  ]);

  return {
    computed_at: new Date().toISOString(),
    shift_id: shiftId,
    context_summary: {
      stations_count:  context.stations.length,
      units_completed: context.shift.units_completed_total,
      hours_remaining: context.shift.hours_remaining,
    },
    agents: { bottleneck, quality, planning, shift },
  };
}
