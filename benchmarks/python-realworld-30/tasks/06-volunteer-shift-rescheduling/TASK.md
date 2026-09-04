# Volunteer Shift Rescheduling

Build a deterministic volunteer scheduler using only the Python standard library:

```bash
python -m solution.volunteer_schedule inputs --output output
```

The initial inputs are:

- `volunteers.csv`: `volunteer_id,skills,preferred_locations,max_shifts`. Skills and locations are semicolon-separated sets.
- `availability.csv`: `volunteer_id,start,end`. A volunteer is available only when one row fully contains the shift's half-open interval.
- `shifts.csv`: `shift_id,start,end,location,required_skill,seats`.
- `travel_times.csv`: `from_location,to_location,minutes`. Travel times are directional. An omitted same-location trip takes zero minutes.

Times are naive ISO 8601 local coordinator times. Assign only qualified volunteers. One volunteer cannot fill two seats of a shift, exceed `max_shifts`, overlap half-open shift intervals, or take consecutive shifts when the time between them is less than the listed travel time. In addition, assignments at different locations always require at least a 30-minute gap, even when the listed travel time is smaller.

Optimize the complete schedule lexicographically:

1. maximize filled required seats;
2. maximize filled seats whose assigned volunteer has the required skill (never use an unqualified volunteer merely to fill a seat);
3. maximize preference score, one point when the shift location is preferred;
4. minimize the spread between the largest and smallest assignment counts across all volunteers;
5. break remaining ties by the lexical sequence of volunteer IDs for seats ordered by `(shift_id, seat)`.

Write `output/schedule.csv` with header `shift_id,seat,volunteer_id`, sorted by shift ID then numeric seat. Write `output/unfilled.csv` with header `shift_id,seat,required_skill,reason` in the same order. Use reason `no_qualified_volunteer` when nobody qualified is available and `capacity_or_conflict` otherwise.

Write `output/summary.json` with integer fields `required_seats`, `filled_seats`, `required_skill_coverage`, `preference_score`, `assignment_count_spread`, and `changed_assignments`, plus an array `fairness_exceptions`. Use sorted JSON keys and a final LF newline. CSV files use UTF-8 and LF endings.

Before later-stage inputs exist, set `changed_assignments` to `0` and `fairness_exceptions` to `[]`. All task material is inside the current workspace, so do not inspect parent paths such as `..`.

The held-out edge has a shift requiring a skill that no available volunteer has. Leave the seat unfilled and never assign an unqualified volunteer.
