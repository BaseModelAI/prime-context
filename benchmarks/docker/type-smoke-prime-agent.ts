import type {
  ContextEntryRef,
  ContextPurpose,
  ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import type { Message } from "@earendil-works/pi-ai";

declare const pi: ExtensionAPI;

const purposes: ContextPurpose[] = ["provider", "compaction", "branch-summary", "refine"];
const entryRef: ContextEntryRef = { messageIndex: 0, entryId: "entry-0" };
void purposes;
void entryRef;

pi.on("context", async (event) => {
  const purpose: ContextPurpose = event.purpose;
  const refs: ContextEntryRef[] | undefined = event.entryRefs;
  void purpose;
  void refs;
  return { messages: event.messages, entryRefs: event.entryRefs };
});

pi.on("model_context", async (event) => {
  const purpose: ContextPurpose = event.purpose;
  const messages: Message[] = event.messages;
  const refs: ContextEntryRef[] | undefined = event.entryRefs;
  void purpose;
  void messages;
  void refs;
  return { messages: event.messages, entryRefs: event.entryRefs };
});

pi.on("turn_end", async (event) => ({
  messages: [
    {
      role: "custom",
      customType: `host-smoke-${event.turnIndex}`,
      content: [{ type: "text", text: event.toolExecution }],
      display: false,
      details: { source: "type-smoke" },
      timestamp: Date.now(),
    },
  ],
}));

// @ts-expect-error unsupported context purposes must not type-check.
const invalidPurpose: ContextPurpose = "ui";
void invalidPurpose;

// @ts-expect-error entryId is required for exact context refs.
const invalidRef: ContextEntryRef = { messageIndex: 0 };
void invalidRef;

const rawOnlyMessage = {
  role: "custom",
  customType: "raw-only",
  content: "raw",
  display: false,
  timestamp: Date.now(),
} as const;
// @ts-expect-error model_context results accept provider Message values, not raw CustomMessage values.
pi.on("model_context", async () => ({ messages: [rawOnlyMessage] }));

// @ts-expect-error agent_end handlers do not have a result surface.
pi.on("agent_end", async () => ({ arbitrary: true }));
