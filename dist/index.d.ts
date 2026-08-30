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

declare const TASK_RUNTIME_SCHEMA: "prime-context.runtime/v2";
interface ValidationState {
    suite: SuiteIdentity;
    status: "success" | "failure";
    summary: string;
    total?: number;
    requirementsRevision: number;
    workspaceRevision: number;
    turnSequence: number;
}
interface ValidationGate {
    key: string;
    suiteFamily?: string;
    target?: string;
    source: "explicit-user-command" | "default-cumulative";
}
interface ActiveDiagnostic {
    id: string;
    summary: string;
    suiteFamily?: string;
    subjectKey?: string;
    source?: string;
    resources: string[];
    exchangeId?: string;
    workspaceRevision: number;
    state: "active" | "awaiting-rerun";
}
interface SubjectState {
    subjectKey: string;
    intentKind: IntentKind;
    intentKey: string;
    resources: string[];
    exchangeId?: string;
    outcomeStatus: OutcomeSummary["status"];
    workspaceRevision: number;
    turnSequence: number;
}
interface SteeringResource {
    path: string;
    userEntryId: string;
    requirementsRevision: number;
}
interface FoldState {
    generation: number;
    throughEntryId: string;
    retainedEntryIds: string[];
    renderedMessage: string;
}
interface TaskRuntimeV2 {
    schema: typeof TASK_RUNTIME_SCHEMA;
    taskKey: string;
    goalId?: string;
    objective?: string;
    objectiveVersion: number;
    requirementsRevision: number;
    requirementsLocked: boolean;
    workspaceRevision: number;
    turnSequence: number;
    validationGates: ValidationGate[];
    validations: ValidationState[];
    activeDiagnostics: ActiveDiagnostic[];
    modifiedResources: Array<{
        path: string;
        revision: number;
    }>;
    recentSubjects: SubjectState[];
    recentIntentKeys: string[];
    steeringDeltas: string[];
    steeringResources: SteeringResource[];
    lastProcessedUserEntryId?: string;
    fold?: FoldState;
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
}
interface FoldCandidateEntry<T extends ContextMessageLike = ContextMessageLike> {
    entryId: string;
    message: T;
}

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

declare const REQUIRED_HOOKS: Set<string>;
declare function requiredHooksLoaded(hooks: ReadonlySet<string>): boolean;
declare function shouldArchiveToolResult(toolName: string): boolean;
declare function typedObservationParts(event: ToolResultEvent): ObservationPartInput[];
declare function typedObservationPartsEqual(left: readonly ObservationPartInput[], right: readonly ObservationPartInput[]): boolean;
declare function branchProjectionEntries(branch: readonly BranchEntryLike[]): FoldCandidateEntry[];
/** Match host model ordering: current compaction summary, then retained/post-compaction entries. */
declare function providerModelBranchEntries(branch: readonly BranchEntryLike[]): readonly BranchEntryLike[];
/** Apply an immutable fold using raw chronological branch membership. Ambiguity fails open. */
declare function foldVisibleBranchEntries(branch: readonly BranchEntryLike[], fold: TaskRuntimeV2["fold"], taskKey?: string): readonly BranchEntryLike[];
declare function completeVisibleToolCallIds(branch: readonly BranchEntryLike[]): Set<string>;
declare function visibleFixedToolCallIds(branch: readonly BranchEntryLike[], fold: TaskRuntimeV2["fold"], taskKey?: string): Set<string>;
interface ForkVisibleImportSelection {
    visibleBranch: readonly BranchEntryLike[];
    completeToolCallIds: Set<string>;
    fixedRefs: string[];
    refs: string[];
}
declare function selectForkVisibleImports(branch: readonly BranchEntryLike[], fold: TaskRuntimeV2["fold"], taskKey: string | undefined, pinnedRefs: readonly string[], parentViews: readonly FixedExchangeView[]): ForkVisibleImportSelection;
declare function scopeFixedExchangeViews(views: readonly FixedExchangeView[], allowedToolCallIds: ReadonlySet<string>): FixedExchangeView[];
declare function selectForkImportRefs(pinnedRefs: readonly string[], fixedRefs: readonly string[], visibleRefs: readonly string[], _target?: number): string[];
declare function primeContext(pi: ExtensionAPI): void;

export { type ForkVisibleImportSelection, REQUIRED_HOOKS, branchProjectionEntries, completeVisibleToolCallIds, primeContext as default, foldVisibleBranchEntries, providerModelBranchEntries, requiredHooksLoaded, scopeFixedExchangeViews, selectForkImportRefs, selectForkVisibleImports, shouldArchiveToolResult, typedObservationParts, typedObservationPartsEqual, visibleFixedToolCallIds };
