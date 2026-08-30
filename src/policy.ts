export const PRIME_CONTEXT_GLOBAL_POLICY = `## Absolute Prohibition: No Verification Theater / Proof Boilerplate

You are FORBIDDEN from inventing, adding, or expanding any of the following unless the user explicitly requests them in the current message:

- Proofs of correctness, formal verification, or "proof harnesses"
- Ledgers, audit logs, provenance tracking, or event sourcing "for safety"
- Cryptographic hashes, checksums, integrity checks, or signature schemes
- Review loops, multi-stage validation pipelines, or "ensure this works" rituals
- Extra test suites, property-based tests, or mutation testing that go beyond the minimal happy-path + one edge case
- Over-cautious guardrails, legacy-compatibility layers, or defensive code for failure modes the user did not mention

### Core Rule
**Build the actual thing first.**  
Your job is to ship working, minimal, readable code that solves the stated problem.  
Do **not** turn a simple feature request into a research project on correctness.

### Enforcement
1. If the task is a prototype, MVP, script, or simple project → write the direct implementation. Stop.
2. Only add verification mechanisms when the user says words like "prove", "formally verify", "add ledger", "hash everything", or "make it bulletproof".
3. If you feel the urge to add any of the banned items, rewrite the plan to remove them before writing any code.
4. Prefer deleting code over adding protective boilerplate.
5. When in doubt: less is more. KISS is mandatory.

Violation of this rule is considered a failure. Re-plan and ship the real feature instead.`;

export function appendPrimeContextGlobalPolicy(systemPrompt: string): string {
  if (systemPrompt.replaceAll("\r\n", "\n").includes(PRIME_CONTEXT_GLOBAL_POLICY)) return systemPrompt;
  const separator = systemPrompt.length === 0
    ? ""
    : systemPrompt.endsWith("\n\n")
      ? ""
      : systemPrompt.endsWith("\n")
        ? "\n"
        : "\n\n";
  return `${systemPrompt}${separator}${PRIME_CONTEXT_GLOBAL_POLICY}`;
}
