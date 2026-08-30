import "@earendil-works/pi-coding-agent";
import type { Message } from "@earendil-works/pi-ai";

type PrimeContextPurpose = "provider" | "compaction" | "branch-summary" | "refine";

interface PrimeContextEntryRef {
  messageIndex: number;
  entryId: string;
}

interface PrimeContextModelContextEvent {
  type: "model_context";
  purpose: PrimeContextPurpose;
  messages: Message[];
  entryRefs?: PrimeContextEntryRef[];
}

interface PrimeContextModelContextEventResult {
  messages?: Message[];
  entryRefs?: PrimeContextEntryRef[];
}

declare module "@earendil-works/pi-coding-agent" {
  interface TurnEndEvent {
    toolExecution: "parallel" | "sequential";
  }

  interface TurnEndEventResult {
    messages?: Extract<TurnEndEvent["message"], { role: "custom" }>[];
  }

  interface ExtensionAPI {
    on(
      event: "turn_end",
      handler: ExtensionHandler<TurnEndEvent, TurnEndEventResult>,
    ): void;
    on(
      event: "model_context",
      handler: ExtensionHandler<PrimeContextModelContextEvent, PrimeContextModelContextEventResult>,
    ): void;
  }
}
