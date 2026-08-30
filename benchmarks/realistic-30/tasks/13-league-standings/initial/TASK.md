# Correctable League Standings

Implement the `league_table` package using only the Python standard library.

Initial API:
- `League()` and immutable `TeamStanding(rank, team, played, won, drawn, lost, goals_for, goals_against, goal_difference, points)`.
- `record(match_id, home, away, home_goals, away_goals)` records one match.
- `table() -> tuple[TeamStanding, ...]`.

Initial behavior:
- Award 3 points for a win, 1 for a draw, and 0 for a loss.
- Sort by points, goal difference, goals for, then lexical team name.
- Ranks are sequential starting at 1.
- Reject duplicate match IDs, identical teams, negative/noninteger goals, or empty names.
- A failed record operation leaves the league unchanged.

Run `python run_tests.py`. Edit only files under `league_table/`. Keep the active goal open for staged pivots.
