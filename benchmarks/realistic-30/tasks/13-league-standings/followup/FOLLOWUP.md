# Corrections and historical tables

Final requirements:
- `apply(event)` appends an event with a unique strictly increasing positive integer `seq`.
- A `record` event has `type="record"` and a `match` containing `id`, `home`, `away`, `home_goals`, and `away_goals`.
- A `correct` event names `target` and supplies a complete replacement `match`; its ID must equal the target.
- A `void` event names an active `target`.
- Corrections and voids must reference an active match established at a lower sequence.
- Invalid events are atomic and raise `ValueError`.
- `table(as_of=None)` replays through the requested inclusive sequence; omitted means latest.
- Existing `record(...)` delegates to an automatically sequenced record event.
- Historical queries do not mutate current state.
