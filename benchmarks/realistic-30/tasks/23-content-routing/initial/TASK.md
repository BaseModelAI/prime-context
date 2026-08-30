# Content Routing Engine

Implement the `contentrouter` package with only the Python standard library.

Initial API:
- `NoRoute(LookupError)`.
- Immutable `Resolution(route_id, text, params, locale="*")`.
- `ContentRouter.from_dict(config)` and `resolve(path, values=None)`.

Initial config has `routes` with `id`, `path`, and `text`.
- Paths contain literal segments or whole-segment captures such as `{slug}`.
- Captures match one nonempty segment.
- Render text with `string.Template.substitute` using captures, then caller values; caller values win.
- Route declaration order breaks otherwise equal matches.
- Reject duplicate IDs and malformed patterns with `ValueError`.

Run `python run_tests.py`. Edit only files under `contentrouter/`. Keep the active goal open for staged pivots.
