# Precedence, explanations, and JSON CLI

Final requirements:
- Routes have integer `priority`, default 0.
- Rank path matches by lowest locale-chain index, highest priority, most literal path segments, then earliest declaration.
- `explain(path, locale=None, values=None)` returns `locale_chain`, selected route ID, and best-first candidates. Each candidate has exactly `id`, `locale_rank`, `priority`, `literal_segments`, `order`, and `selected`.
- Include only path matches whose locale is in the chain. Raise `NoRoute` when none match.
- CLI: `python -m contentrouter.cli CONFIG.json PATH [--locale LOCALE] [--values JSON_OBJECT] [--explain]`.
- Print one compact sorted JSON line. Resolution keys are `route_id`, `text`, `params`, `locale`. Explain mode prints the explanation.
- Success exits 0; invalid input or no route prints a short stderr error and exits 2.
