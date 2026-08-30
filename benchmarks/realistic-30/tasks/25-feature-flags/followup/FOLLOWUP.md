# Tenant overrides, explanations, and CLI

Add final behavior:
- `tenant_overrides` maps tenant strings to booleans and has highest priority.
- Final priority: tenant override, first target, rollout, default.
- `explain(config,key,context=None)` returns one exact JSON-safe shape:
  - tenant: `{"flag":key,"value":v,"reason":"tenant_override","tenant":tenant}`
  - target: `{"flag":key,"value":v,"reason":"target","rule_index":index}`
  - rollout: `{"flag":key,"value":v,"reason":"rollout","bucket":n,"percentage":pct}`
  - default: `{"flag":key,"value":v,"reason":"default"}`
- `evaluate` must equal `explain(...)["value"]`.
- CLI: `python -m featureflags.cli CONFIG.json FLAG [--context JSON] [--explain]`.
- Print one JSON value and newline; success returns zero.
