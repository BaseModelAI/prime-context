import { ExtensionAPI, ToolResultEvent } from '@earendil-works/pi-coding-agent';

interface OutcomeSummary {
    status: "success" | "failure" | "unknown";
    testSummary: string | null;
    testTotal: number | null;
    failingTests: string[];
    exceptions: string[];
    sourceLocations: string[];
    exitStatuses: string[];
    commandFailures: string[];
    signature: string | null;
}

type IntentKind = "read" | "search" | "edit" | "test" | "build" | "lint" | "run" | "status" | "install" | "delegate" | "unknown";
type SuiteScope = "focused" | "package" | "broad";
interface SuiteIdentity {
    family: string;
    target: string;
    scope: SuiteScope;
}
interface ToolIntentFacts {
    [key: string]: number | string | string[] | undefined;
}
interface ToolIntent {
    exchangeId: string;
    toolCallId: string;
    toolName: string;
    kind: IntentKind;
    resources: string[];
    command?: string;
    effectiveCwd?: string;
    subjectKey: string;
    suite?: SuiteIdentity;
    mutatesWorkspace: boolean;
    modelInputBytes: number;
    executedInputBytes: number;
    facts?: ToolIntentFacts;
}

type PartSource = {
    kind: "text";
    text: string;
} | {
    kind: "path";
    path: string;
} | {
    kind: "bytes";
    bytes: Uint8Array;
};
type StreamPartSource = PartSource | {
    kind: "texts";
    texts: () => Iterable<string>;
};
interface SourceLineRecord {
    lineNumber: number;
    text: string;
}

interface BranchEntryLike {
    type: string;
    id?: string;
    parentId?: string | null;
    customType?: string;
    data?: unknown;
    message?: unknown;
    content?: unknown;
    display?: boolean;
    details?: unknown;
    timestamp?: string | number;
    firstKeptEntryId?: string;
    summary?: string;
    fromId?: string;
}

interface ContextMessageLike {
    role: string;
    content?: unknown;
    customType?: string;
    display?: boolean;
    details?: unknown;
    timestamp?: number;
    [key: string]: unknown;
}

declare const FIXED_EXCHANGE_VIEW_SCHEMA: "prime-context.fixed-exchange-view/v1";
declare const FIXED_EXCHANGE_VIEW_GENERATION: 0;
interface FixedExchangeLiteralResult {
    kind: "literal";
}
interface FixedExchangeCapsuleResult {
    kind: "capsule";
    text: string;
}
interface ProjectedImageRef {
    ref: string;
    mimeType: string;
    bytes: number;
    width?: number;
    height?: number;
}
interface DeltaDependency {
    baselineToolCallId: string;
    baselineEntryId?: string;
    contextEpoch: number;
}
interface FixedExchangeView {
    schema: typeof FIXED_EXCHANGE_VIEW_SCHEMA;
    generation: typeof FIXED_EXCHANGE_VIEW_GENERATION;
    exchangeId: string;
    toolCallId: string;
    callArguments?: Record<string, unknown>;
    result: FixedExchangeLiteralResult | FixedExchangeCapsuleResult;
    visibleBytes: number;
    images?: readonly ProjectedImageRef[];
    /** Provider/model identity that produced replay-protected call metadata. */
    replayOriginKey?: string;
    /** A repeat/delta is valid only while this exact baseline remains visible. */
    deltaDependency?: DeltaDependency;
}
interface ProjectionCandidateEntry<T extends ContextMessageLike = ContextMessageLike> {
    entryId: string;
    message: T;
}

type ObservationSource = "visible-tool-result" | "public-complete-output";
type ObservationPartKind = "call" | "call-field" | "result" | "diff" | "stdout" | "stderr" | "traceback" | "attachment" | "image";
interface ObservationPartInput {
    name: string;
    kind: ObservationPartKind;
    pointer?: string;
    mediaType?: string;
    text?: string;
    source?: StreamPartSource;
    binaryBase64?: string;
    width?: number;
    height?: number;
}
interface ResolvedArchiveText {
    text: string;
    source: ObservationSource;
    partSource?: StreamPartSource;
    textBytes?: number;
    lineCount?: number;
    large?: boolean;
    exactText?: string;
    capsuleText?: string;
    outcomeText?: string;
    representativeLines?: string[];
    head?: string[];
    tail?: string[];
    sourceRecords?: SourceLineRecord[];
    traceShapeCount?: number;
    traceShapeOverflow?: number;
    traceLineCount?: number;
    nonEmptyLineCount?: number;
    summaryLines?: string[];
}

type TaskOutcome = "success" | "failure" | "unknown";

interface ModelToolCall {
    type: "toolCall";
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    thoughtSignature?: string;
    [key: string]: unknown;
}
interface ToolResultMessageLike {
    role: "toolResult";
    toolCallId: string;
    toolName?: string;
    content?: unknown;
    details?: unknown;
    isError?: boolean;
}
interface PendingOutcome {
    isError: boolean;
    outcome: OutcomeSummary;
}
interface PendingExchange {
    id: string;
    toolCallId: string;
    toolName: string;
    sourceOrder: number;
    rawCall?: ModelToolCall;
    persistedCall: boolean;
    modelInput: Record<string, unknown>;
    executedInput?: Record<string, unknown>;
    toolSchema?: unknown;
    cwd?: string;
    intent?: ToolIntent;
    outcome?: PendingOutcome;
    archiveSource?: ObservationSource;
    archiveParts?: ObservationPartInput[];
    resultText?: string;
    largeResult?: boolean;
    resultSummary?: ResolvedArchiveText;
    frozenResultPath?: string;
    frozenVisibleResultSource?: StreamPartSource;
    observedResultText?: string;
    observedResultPreview?: string;
    observedResultTail?: string;
    observedResultSamples?: string[];
    observedResultTruncated?: boolean;
    observedResultBytes?: number;
    observedResultDetails?: unknown;
    observedSemanticDetails?: unknown;
    observedFullOutputPath?: string;
    observedDetailsComparable?: boolean;
    observedResultIsError?: boolean;
    admittedCapsule?: string;
    rawResult?: ToolResultMessageLike;
    persistedResultChanged?: boolean;
    persistedCanonicalResultChanged?: boolean;
    persistedTextChanged?: boolean;
    persistedPathChanged?: boolean;
    replayProtected?: boolean;
    replayOriginKey?: string;
    completed: boolean;
}

declare const REQUIRED_HOOKS: Set<string>;
declare function requiredHooksLoaded(hooks: ReadonlySet<string>): boolean;
declare function shouldArchiveToolResult(toolName: string): boolean;
declare function shouldCommitExchangeArchive(exchange: Readonly<PendingExchange>, callArgumentByteLimit?: number): boolean;
declare function typedObservationParts(event: ToolResultEvent): ObservationPartInput[];
declare function typedObservationPartsEqual(left: readonly ObservationPartInput[], right: readonly ObservationPartInput[]): boolean;
declare function explicitUserTaskOutcome(text: string): TaskOutcome;
declare function branchProjectionEntries(branch: readonly BranchEntryLike[]): ProjectionCandidateEntry[];
/** Match host model ordering: current compaction summary, then retained/post-compaction entries. */
declare function providerModelBranchEntries(branch: readonly BranchEntryLike[]): readonly BranchEntryLike[];
declare function completeVisibleToolCallIds(branch: readonly BranchEntryLike[]): Set<string>;
declare function visibleFixedToolCallIds(branch: readonly BranchEntryLike[]): Set<string>;
interface ForkVisibleImportSelection {
    visibleBranch: readonly BranchEntryLike[];
    completeToolCallIds: Set<string>;
    fixedRefs: string[];
    refs: string[];
}
declare function selectForkVisibleImports(branch: readonly BranchEntryLike[], pinnedRefs: readonly string[], parentViews: readonly FixedExchangeView[]): ForkVisibleImportSelection;
declare function scopeFixedExchangeViews(views: readonly FixedExchangeView[], allowedToolCallIds: ReadonlySet<string>): FixedExchangeView[];
declare function selectForkImportRefs(pinnedRefs: readonly string[], fixedRefs: readonly string[], visibleRefs: readonly string[], _target?: number): string[];
declare function primeContext(pi: ExtensionAPI): void;

export { type ForkVisibleImportSelection, REQUIRED_HOOKS, branchProjectionEntries, completeVisibleToolCallIds, primeContext as default, explicitUserTaskOutcome, providerModelBranchEntries, requiredHooksLoaded, scopeFixedExchangeViews, selectForkImportRefs, selectForkVisibleImports, shouldArchiveToolResult, shouldCommitExchangeArchive, typedObservationParts, typedObservationPartsEqual, visibleFixedToolCallIds };
