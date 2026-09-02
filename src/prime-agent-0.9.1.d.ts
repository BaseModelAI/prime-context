import "@earendil-works/pi-coding-agent";
import type { Message } from "@earendil-works/pi-ai";

type PrimeContextPurpose = "provider" | "budget" | "compaction" | "branch-summary" | "refine";
type PrimeContextToolExecutionMode = "parallel" | "sequential";

interface PrimeContextEntryRef {
  messageIndex: number;
  entryId: string;
}

interface PrimeContextModelContextEvent {
  type: "model_context";
  purpose: PrimeContextPurpose;
  messages: readonly Message[];
  entryRefs?: readonly PrimeContextEntryRef[];
}

interface PrimeContextModelContextEventResult {
  messages?: readonly Message[];
  entryRefs?: readonly PrimeContextEntryRef[];
  projectionIdentity?: string;
}

interface PrimeContextFinalizedToolExchange {
  sourceOrder: number;
  toolCallId: string;
  toolName: string;
  originalInput: unknown;
  executedInput?: unknown;
  result: import("@earendil-works/pi-coding-agent").TurnEndEvent["toolResults"][number];
}

interface PrimeContextUserBashEndEvent {
  type: "user_bash_end";
  entryId: string;
  command: string;
  output: string;
  isError: boolean;
  exitCode?: number | null;
  cancelled?: boolean;
  truncated?: boolean;
  fullOutputPath?: string;
  details?: unknown;
}

declare module "@earendil-works/pi-coding-agent" {
  interface ContextUsage {
    messageTokens?: number;
    systemTokens?: number;
    toolTokens?: number;
    totalTokens?: number;
    projectedMessageCount?: number;
  }

  interface ExtensionContext {
    setAutomaticRefinementEnabled(enabled: boolean | undefined): void;
  }

  interface TurnEndEvent {
    toolExecution: PrimeContextToolExecutionMode;
    exchanges: readonly PrimeContextFinalizedToolExchange[];
  }

  interface TurnEndEventResult {
    messages?: readonly Extract<TurnEndEvent["message"], { role: "custom" }>[];
  }

  interface ExtensionAPI {
    on(
      event: "turn_end",
      handler: ExtensionHandler<TurnEndEvent, TurnEndEventResult>,
    ): void;
    on(
      event: "user_bash_end",
      handler: ExtensionHandler<PrimeContextUserBashEndEvent>,
    ): void;
    on(
      event: "model_context",
      handler: ExtensionHandler<PrimeContextModelContextEvent, PrimeContextModelContextEventResult>,
    ): void;
  }
}
