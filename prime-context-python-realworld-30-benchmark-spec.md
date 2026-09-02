# Python Real-World 30 Benchmark Specification

**Purpose:** define 30 hermetic, real-workflow programming scenarios for comparing agent harness variants on completion, elapsed time, model and tool cost, token use, prompt-cache reuse, compaction continuity, and recovery from difficult intermediate states.

**Implementation target:** a coding agent should create the complete benchmark corpus and one lean runner from this document. The scenarios are programming tasks, not harness unit tests. Every solution must be achievable with Python 3.12 and the Python standard library alone.

---

## 1. Benchmark principles

1. **Correctness dominates efficiency.** A cheaper failed run is not a win. Compare cost, time, calls, and tokens only for task pairs where both variants strictly pass.
2. **Use actual work.** Each task produces a useful script, report, database, transformed dataset, or repaired application. Do not add artificial goal objects, exact completion phrases, ceremonial plans, or stages whose only purpose is to make the transcript longer.
3. **Keep judging small and direct.** Each task has one main fixture and one specified edge fixture. One `judge.py` performs the checks. Do not add fuzzers, property suites, mutation tests, proof machinery, review agents, or layers of meta-validation.
4. **No hidden requirements.** The edge behavior is stated in the task. The edge fixture itself is withheld from the solving agent, but it exercises only that stated behavior.
5. **Hermetic execution.** No internet, no package installation, no cloud service, and no dependency outside the standard library. Local loopback HTTP servers are allowed where the scenario calls for one.
6. **Natural context pressure.** Small tasks stay small. Long tasks become long because of realistic data volume, codebase size, follow-up requirements, and evidence gathering—not by injecting filler text.
7. **Stable fixtures.** All dates, rates, policies, and expected behavior are fixed in the corpus. Do not depend on the current date, locale, exchange rates, or live timezone data beyond the IANA timezone database installed in the benchmark image.
8. **Observable progress comes from artifacts.** A plan or explanation without runnable work earns no progress. Progress is inferred from imports, commands, outputs, and semantic checks.

---

## 2. Runtime and solution constraints

- Python version: **3.12.x**.
- Allowed imports: Python standard library only.
- No `pip`, vendored third-party packages, external binaries, network access outside `127.0.0.1`, or calls to language-specific package managers.
- The shell may be used only to launch Python or inspect files. Every required transformation, server, parser, database operation, and report generator must be implemented in Python.
- Text files use UTF-8 and LF endings unless the source format explicitly requires CRLF, such as generated iCalendar output.
- Monetary arithmetic uses `decimal.Decimal`; binary floating point is not accepted for final currency values.
- Outputs must be deterministic. Sort rows and object keys where the task specifies ordering. Do not include wall-clock timestamps in deliverables unless the fixture supplies the timestamp.
- Inputs are mounted read-only. Repair tasks expose an editable application directory; all other writes go under `solution/`, `output/`, or a task-specific state path named below.
- A final assistant response may summarize the work, but correctness never depends on exact wording.

---

## 3. Corpus layout

Create the suite at:

```text
benchmarks/python-realworld-30/
  README.md
  tasks.json
  run.py
  benchlib.py
  tasks/
    01-expense-reconciliation/
      scenario.json
      TASK.md
      seed.py
      visible/
      stages/
      judge.py
    ...
    30-helpdesk-upgrade/
```

### 3.1 Per-task files

- `TASK.md`: the complete user-visible requirements for the initial stage.
- `scenario.json`: machine-readable metadata, prompt text, stage order, compaction schedule, timeout, editable paths, and judge command.
- `seed.py`: creates a deterministic fresh workspace. Use `random.Random(20260831 + task_id)` for filler data and explicit hand-authored anchor records for the important cases.
- `visible/`: small static source files or broken application code copied at setup.
- `stages/<stage-name>/`: files introduced by later user messages. Empty for single-stage tasks.
- `judge.py`: kept outside the agent workspace. It runs the final solution against the main fixture and one edge fixture and prints one JSON object.

Do not commit generated multi-megabyte fixtures. Generate them during setup from the fixed seed.

### 3.2 `scenario.json` shape

Use this schema:

```json
{
  "schema": "prime-context.python-realworld-task/v1",
  "id": 1,
  "slug": "expense-reconciliation",
  "title": "Household Expense Reconciliation",
  "pressure": "N",
  "timeout_seconds": 600,
  "editable_paths": ["solution/", "output/"],
  "initial_prompt": "Read TASK.md and complete the requested workflow using only the Python standard library.",
  "stages": [
    {
      "id": "initial",
      "inject": "visible/",
      "message": "Read TASK.md and complete the requested workflow using only the Python standard library.",
      "compact_after": false
    }
  ],
  "judge_command": ["python", "judge.py", "--workspace", "{workspace}"]
}
```

Later stages add `inject`, `message`, and `compact_after`. The runner copies stage files, makes new inputs read-only, and sends the message after the previous assistant turn is idle.

---

## 4. Context-pressure classes

The corpus has four deliberately different interaction profiles.

| Class | Count | Interaction shape | Runner compaction behavior | Timeout |
|---|---:|---|---|---:|
| **N — narrow** | 8 | One user request, focused implementation | Never request compaction | 600 s |
| **L — light continuation** | 10 | Initial delivery plus one realistic follow-up | Never request compaction; natural compaction is allowed | 900 s |
| **M — sustained** | 8 | Three stages with changed data or policy | Request one compaction after stage 1 is answered, then continue | 1,200 s |
| **H — long workflow** | 4 | Four or five stages over large evidence or code | Request two compactions at the stated natural boundaries | 1,800 s |

A requested compaction is part of the interaction protocol, not a pass criterion. Record whether it succeeded and whether the agent retained earlier requirements. Do not force additional compactions to hit a target count.

---

## 5. Runner behavior

Implement one runner, not a runner per task.

1. Create a fresh temporary workspace and run the task's `seed.py`.
2. Copy or generate the initial visible workspace. Make input directories read-only; leave only declared paths editable.
3. Start the selected agent variant with the same provider, model, reasoning setting, environment, and timeout used for its paired comparison.
4. Send the initial prompt.
5. For staged tasks, wait for a no-tool assistant turn and an idle process. If `compact_after` is true for the completed stage, request one compaction and wait for the lifecycle event. Then inject the next files and send the next user message.
6. Do not reject an early “done” response when later stages remain; treat the next stage as an ordinary user follow-up and continue.
7. After the final idle assistant response or timeout, stop the agent, then run `judge.py` outside the measured agent wall time.
8. Preserve the transcript, tool events, provider usage, compaction events, final workspace, and judge result.
9. Do not retry runs in the primary aggregate. A separate diagnostic rerun may be retained, but it must not replace the original result.

The runner must not reveal `judge.py`, edge fixtures, or expected outputs to the solving agent.

---

## 6. Judge contract and qualitative progress

Each `judge.py` executes the supplied solution in a clean copy of the **main fixture** and once against the single **edge fixture**. It prints:

```json
{
  "status": "pass",
  "progress_level": 5,
  "main_checks_passed": 5,
  "main_checks_total": 5,
  "edge_check_passed": true,
  "notes": []
}
```

Use this common progress scale:

| Level | Meaning |
|---:|---|
| 0 | No relevant runnable artifact exists. |
| 1 | The required module or application imports/starts and exposes the requested command or endpoint. |
| 2 | The main workflow completes and required output files or responses are structurally parseable. |
| 3 | The core transformation is substantially correct, but one or more stated business rules or follow-up requirements are missing. |
| 4 | Every main-fixture semantic check passes. |
| 5 | The main fixture and the one specified edge fixture pass. This is the only strict-pass state. |

The per-task sections below define the actual main checks and edge check. Keep each judge readable and direct. Prefer checking final records, totals, state transitions, and endpoint behavior over inspecting implementation style.

---

## 7. Metrics and comparison

Record at least:

- strict pass/fail and progress level;
- agent wall time and lifecycle wall time;
- main-model calls;
- auxiliary-model calls by kind, when exposed;
- tool calls and tool-result bytes shown to the model;
- compaction requests, completions, and failures;
- provider input, output, cache-read, and cache-write tokens;
- total reported API cost;
- peak provider-bound token estimate, when exposed by the harness;
- final response token count;
- judge time separately from agent time.

Report results by task, pressure class, and whole corpus. Efficiency comparisons use only matched strict-pass pairs. Also report:

```text
prompt_cache_reuse = cache_read_tokens /
  (uncached_input_tokens + cache_read_tokens + cache_write_tokens)
```

Use that formula only when the host exports uncached input separately. When a provider reports cached tokens inside its total input field, retain the provider fields and do not manufacture a derived ratio by double-counting them.

Do not turn auxiliary-call count, compaction count, or visible bytes into pass criteria. They are explanatory measurements. A useful extra call can be a net win; an unnecessary call on a narrow task is overhead.

### 7.1 Lean comparison modes

The required release comparison is two arms:

1. current reference harness;
2. candidate harness with its intended defaults.

Give every primary task run a fresh agent home and empty task-derived learning state. Do not carry automatically learned procedures from one task into another in the primary regression comparison. A frozen-skill or online-learning experiment may reuse the same corpus, but it must be a separately named run with its extra model cost and task order reported.

When a regression needs attribution, rerun only the affected scenarios with the relevant candidate feature disabled. Do not multiply the full corpus into a large ablation matrix by default.

---

## 8. Coverage matrix

| ID | Scenario | Class | Stages | Primary standard-library areas | Main harness stressors |
|---:|---|:---:|---:|---|---|
| 01 | Household expense reconciliation | N | 1 | `csv`, `json`, `decimal`, Unicode | zero-call fast path, exact values |
| 02 | Calendar merge and conflict report | L | 2 | `datetime`, `zoneinfo`, text parsing | continuation, timezone facts |
| 03 | Mailbox thread cleanup | L | 2 | `mailbox`, `email`, MIME | large structured observations |
| 04 | Invoice and payment matching | N | 1 | `csv`, XML, `decimal` | exact allocation state |
| 05 | Inventory reorder and transfer plan | L | 2 | `csv`, `json`, `statistics` | changed policy, compact task state |
| 06 | Volunteer shift rescheduling | M | 3 | backtracking, `datetime` | one compaction, plan continuity |
| 07 | Utility anomaly report | N | 1 | `statistics`, HTML generation | zero-call data analysis |
| 08 | Travel itinerary repair | L | 2 | `datetime`, `zoneinfo`, JSON | changed facts, exact times |
| 09 | Support SLA event analysis | N | 1 | streaming JSONL, `datetime` | huge input, avoid raw reads |
| 10 | Local supplier catalog crawler | N | 1 | `urllib`, `html.parser` | tool economy, retry behavior |
| 11 | SQLite CRM migration | L | 2 | `sqlite3`, CSV | code repair, persistent state |
| 12 | Webhook receiver and replay | M | 3 | `http.server`, `urllib`, `sqlite3` | repeat results, stall recovery opportunity |
| 13 | Cross-service incident timeline | H | 4 | `gzip`, regex, CSV, streaming | two compactions, large evidence |
| 14 | Layered configuration upgrade | N | 1 | `configparser`, `tomllib`, JSON | zero-call parsing, error clarity |
| 15 | Backup restore planner | N | 1 | `tarfile`, `zipfile`, `pathlib` | binary metadata, exact paths |
| 16 | Markdown knowledge-base repair | L | 2 | `pathlib`, regex, Unicode | repository navigation, deltas |
| 17 | Contract clause index and comparison | M | 3 | text indexing, regex, line anchors | one compaction, semantic compression opportunity |
| 18 | Research-note search and deduplication | L | 2 | `sqlite3`, `collections`, Unicode | large corpus, reusable index |
| 19 | Sensor resampling and gap report | N | 1 | `gzip`, `csv`, streaming statistics | very large input, fast path |
| 20 | Time-of-use energy billing | M | 3 | `decimal`, `datetime`, `zoneinfo` | one compaction, exact policy retention |
| 21 | WAV interview cleanup and chapters | L | 2 | `wave`, `struct`, `array` | binary output, follow-up format |
| 22 | Timesheet and payroll correction | M | 3 | `decimal`, `datetime`, `zoneinfo` | one compaction, changed rules |
| 23 | Procurement three-way match | M | 3 | `csv`, JSON, XML, `decimal` | one compaction, incremental corrections |
| 24 | Multi-warehouse order fulfillment | M | 3 | search, `itertools`, `decimal` | one compaction, preserve shipped state |
| 25 | Library circulation reconstruction | L | 2 | streaming CSV, `datetime`, text output | corrected history, large input |
| 26 | School meal allergen and stock plan | L | 2 | graph traversal, JSON, CSV | changed ingredients, concise state |
| 27 | Clinic appointment rescheduling | H | 4 | constraint search, `datetime` | two compactions, broad task scout opportunity |
| 28 | Permit intake and status pipeline | H | 4 | mixed formats, `sqlite3`, templates | two compactions, large code/data workspace |
| 29 | Legacy budgeting CLI repair | M | 3 | package repair, `sqlite3`, CSV | one compaction, hidden interaction bug |
| 30 | Helpdesk service upgrade | H | 5 | HTTP, SQLite, mbox, business time | two compactions, broad codebase and large results |

The stressor column is descriptive. It must not force the candidate harness to take a particular action.

---

# 9. Scenario specifications

The fixture descriptions, private anchor truths, and judge checks in this section are for the benchmark implementer. Copy the user task and stated behavior into `TASK.md`; do not expose private expected values or the generated edge fixture. The edge rule itself must be visible in `TASK.md`, so the judge never tests an unstated behavior.

For staged scenarios, the final main-fixture judge includes every injected stage file and every requirement introduced by the follow-up messages.

## 01 — Household Expense Reconciliation

**Profile:** N; one stage; 600 seconds.

**Visible fixture:**

- `inputs/bank.csv`: 160 checking-account rows with `transaction_id,posted_date,description,amount,currency`. Negative amounts are spending. Positive amounts are refunds or income.
- `inputs/receipts.json`: 105 receipt objects with `receipt_id,merchant,paid_date,total,currency`.
- `inputs/categories.csv`: ordered `pattern,category` rows. Matching is case-insensitive substring matching after Unicode NFKC normalization and whitespace collapse. First match wins.
- Anchor cases include a refund, a bank transfer, two same-value purchases on adjacent dates, an unmatched cash receipt, and merchant punctuation differences.

**User task:** build `solution/reconcile.py` and make this command work:

```bash
python -m solution.reconcile \
  --bank inputs/bank.csv \
  --receipts inputs/receipts.json \
  --categories inputs/categories.csv \
  --output output
```

**Required behavior:**

1. Use `Decimal` for all money.
2. Categorize every bank row. Unmatched descriptions use `Uncategorized`.
3. A receipt may match one debit transaction when currency and absolute amount are equal, dates differ by at most two days, and either normalized merchant string contains the other.
4. Resolve multiple candidates by smallest date difference, then lexical `receipt_id`. A receipt can be used once.
5. Category `Transfer` is excluded from spending totals. Refunds reduce the corresponding category total when their description matches a category; otherwise use `Refund`.
6. Produce:
   - `output/reconciliation.csv` with every bank row plus `category,matched_receipt_id,status`;
   - `output/monthly_summary.json` keyed by month and category;
   - `output/unmatched_receipts.csv`.

**Progress landmarks:** runnable CLI; parseable outputs; mostly correct matching and balanced totals; all exact rules; edge pass.

**Main correctness checks:** row count/order preserved; anchor matches selected correctly; no receipt reused; monthly totals equal categorized bank amounts after transfer exclusion; unmatched receipt set exact.

**Edge fixture:** two receipts have the same amount and date, but only one merchant contains the normalized bank merchant. The merchant-compatible receipt must win even though its ID sorts later.

---

## 02 — Calendar Merge and Conflict Report

**Profile:** L; two stages; 900 seconds; no requested compaction.

**Initial fixture:** three `.ics` files containing 90 `VEVENT` records. The supported subset includes unfolded/folded lines, `UID`, `SEQUENCE`, `STATUS`, `DTSTART`, `DTEND`, `SUMMARY`, `LOCATION`, UTC timestamps, `TZID` timestamps, and all-day `VALUE=DATE` events. Each calendar supplies `X-WR-TIMEZONE`; use it for all-day boundaries and for local timestamps that omit `TZID`. Fixtures avoid ambiguous local timestamps.

**Stage 1 task:** implement:

```bash
python -m solution.calendar_merge inputs/calendars output/merged.ics output/conflicts.csv
```

For duplicate `UID`s, keep the highest `SEQUENCE`; a highest-sequence `STATUS:CANCELLED` removes the event. Emit canonical events in UTC order. Two timed events conflict when their half-open UTC intervals overlap; touching endpoints do not. An all-day event occupies the complete local calendar day in its declared timezone. `conflicts.csv` contains unique ordered UID pairs.

**Stage 2 message:**

> A fourth calendar, `inputs/late_changes.ics`, has arrived with cancellations, one higher-sequence room change, and one event spanning a daylight-saving transition. Merge it into the same outputs without changing the command.

The runner injects the file after the first response.

**Progress landmarks:** parser/CLI exists; valid merged ICS; deduplication and basic conflicts correct; late changes incorporated; edge pass.

**Main correctness checks:** unfolding and property parsing; highest-sequence/cancellation behavior; UTC ordering and CRLF output; exact conflict pairs before and after late changes; all-day handling.

**Edge fixture:** a folded `SUMMARY` line and two events where one ends exactly when the other begins. The summary must unfold, and the pair must not be reported as a conflict.

---

## 03 — Mailbox Thread Cleanup

**Profile:** L; two stages; 900 seconds.

**Initial fixture:** `inputs/current.mbox` with 180 messages across 42 threads. It contains plain text, multipart messages, RFC 2047 subjects, repeated `Message-ID`s, list mail, attachments, and ordinary replies.

**Stage 1 task:** implement:

```bash
python -m solution.mailbox_clean inputs/current.mbox --output output
```

Produce:

- `output/cleaned.mbox`: one copy of each `Message-ID`, keeping the copy with the latest valid `Date`; messages without an ID remain distinct;
- `output/threads.csv`: `thread_id,subject,participants,first_date,last_date,message_count`;
- `output/unsubscribe.csv`: sender domain and parsed HTTP/mailto targets from `List-Unsubscribe`.

Thread messages using `References`, then `In-Reply-To`, then their own ID. Decode headers with replacement for unknown characters. For body inspection prefer `text/plain`, ignore attachment payloads, and strip repeated `Re:`, `Fwd:`, and `Fw:` prefixes from the display subject only.

**Stage 2 message:**

> Please include `inputs/archive.mbox` as a second input. It contains forwarded duplicates and several messages with missing or invalid dates. Add positional input support for multiple mbox files. Unknown dates should remain blank in CSV and sort after known dates within a thread.

**Progress landmarks:** command imports; one mailbox exported; thread counts mostly correct; archive merge and date rules correct; edge pass.

**Main correctness checks:** deduplication winner; thread roots/counts; MIME/header decoding; attachment exclusion; multiple-mailbox merge and deterministic ordering.

**Edge fixture:** a multipart message has an unknown declared charset but valid bytes plus a large binary attachment. The text must decode with replacement, and attachment bytes must not appear in any CSV output.

---

## 04 — Invoice and Payment Matching

**Profile:** N; one stage; 600 seconds.

**Fixture:**

- `inputs/invoices.csv`: 120 invoices with `invoice_id,customer_id,issued_date,due_date,amount,currency`.
- `inputs/payments.xml`: payments with `payment_id,customer_id,date,amount,currency,memo`.
- `inputs/credits.json`: invoice-specific or customer-level credits.
- Anchor cases cover one payment split across invoices, several payments combined on one invoice, a credit plus cash, an explicit invoice ID in a memo, and an overpayment.

**Task:** implement:

```bash
python -m solution.invoice_match inputs --output output
```

Apply invoice-specific credits first. Apply customer-level credits and payments to open invoices by oldest due date, then invoice ID. A memo token exactly equal to an invoice ID takes precedence when customer and currency agree. Never drive an invoice balance below zero; excess becomes unapplied.

Produce `invoice_status.csv`, `applications.csv`, and `exceptions.csv`. All monetary fields use two decimal places.

**Progress landmarks:** runnable import; outputs parse; most allocations correct; exact application order and totals; edge pass.

**Main correctness checks:** every application conserves source amount; explicit memo precedence; oldest-due allocation; correct final balances; exact unapplied items.

**Edge fixture:** a payment references a closed invoice and exceeds the customer's remaining open balance. It must skip the closed invoice, finish open balances, and report the remainder as unapplied.

---

## 05 — Inventory Reorder and Transfer Plan

**Profile:** L; two stages; 900 seconds.

**Initial fixture:** products, per-warehouse stock, 56 days of demand, open purchase orders, suppliers, and warehouse-to-warehouse shipping costs. Files are CSV or JSON and contain 80 SKUs across three warehouses.

**Stage 1 task:** implement:

```bash
python -m solution.reorder inputs --as-of 2025-06-01 --output output
```

For each SKU/warehouse, forecast daily demand as the arithmetic mean of the last 28 complete days. Target stock is demand for `lead_days + safety_days`. Subtract on-hand and open-PO quantity arriving on or before the lead-date boundary. Round purchase quantities up to whole units and then to case packs. Supplier minimums are expressed in aggregate cases. When a nonzero supplier order is below its minimum, add cases one at a time to the SKU with the largest remaining uncovered target quantity, breaking ties by SKU, until the minimum is met. Produce `reorder.csv` and `supplier_orders.json`.

**Stage 2 message:**

> A supplier blackout and a transfer option were added in `inputs/constraints.json` and `inputs/transfer_costs.csv`. Before buying, move stock from a warehouse whose projected stock remains above its own safety stock. Choose transfers by lowest cost, then donor warehouse name. Blackout arrivals move to the first permitted date. Add `output/transfers.csv` and update purchase orders.

**Progress landmarks:** forecast works; purchase plan generated; case packs/minimums correct; transfers/blackouts incorporated; edge pass.

**Main correctness checks:** forecast windows; target and open-PO math; case-pack/minimum behavior; transfer conservation and donor safety; arrival-date shift.

**Edge fixture:** a new SKU has stock but no demand history. Its forecast is zero and it must not create a purchase or transfer.

---

## 06 — Volunteer Shift Rescheduling

**Profile:** M; three stages; 1,200 seconds; request one compaction after stage 1.

**Fixture:** 24 volunteers, 36 shifts, availability windows, required skills, preferred locations, maximum shift counts, and travel-time constraints.

**Stage 1 task:** implement a deterministic scheduler:

```bash
python -m solution.volunteer_schedule inputs --output output
```

A volunteer cannot overlap shifts and needs a 30-minute gap between different locations. Optimize lexicographically: maximize filled required seats; maximize required-skill coverage; maximize preference score; minimize assignment-count spread; then lexical volunteer IDs. Produce `schedule.csv`, `unfilled.csv`, and `summary.json`.

**Stage 2 message after compaction:**

> `inputs/callout.json` marks two volunteers unavailable. Reschedule only what is necessary. After coverage, minimize the number of changed assignments before preference and fairness.

**Stage 3 message:**

> The coordinator added a fairness rule in `inputs/fairness.json`: among volunteers eligible for at least four remaining shifts, final assignment counts may differ by at most one unless that would reduce required-skill coverage. Regenerate the final files and list any fairness exception in `summary.json`.

**Progress landmarks:** schedule emitted; legal coverage; callout handled with limited churn; fairness and prior constraints retained; edge pass.

**Main correctness checks:** no overlap/travel/max violations; optimal filled seats on fixture; callout volunteers absent; changed-assignment count minimal among equal-coverage solutions; fairness rule or justified exception.

**Edge fixture:** one shift requires a skill no available volunteer has. It must remain in `unfilled.csv`; the scheduler must not assign an unqualified volunteer.

---

## 07 — Utility Consumption Anomaly Report

**Profile:** N; one stage; 600 seconds.

**Fixture:** `inputs/monthly_usage.csv` contains 30 months for 50 meters with occasional missing months and injected spikes. Columns are `meter_id,month,kwh`.

**Task:** implement:

```bash
python -m solution.utility_anomalies inputs/monthly_usage.csv --output output
```

For each meter, after six prior non-missing observations exist, compare the current value with the median of the preceding six observations. Compute MAD as the median absolute deviation from that median. Flag when:

```text
abs(value - median) > max(3 * MAD, 0.25 * median)
```

Define severity as `abs(value - median) / median` when the median is positive, otherwise zero. A missing calendar month is a gap, not a zero. Produce `anomalies.csv` sorted by descending severity then meter/month, `gaps.csv`, and a self-contained `report.html` with summary counts and a table of the largest anomalies. No JavaScript is needed.

**Progress landmarks:** command runs; CSVs/HTML exist; gaps and anomaly direction correct; all thresholds/totals exact; edge pass.

**Main correctness checks:** rolling-window selection; MAD calculation; missing-month detection; exact anomaly rows/severity sorting; HTML contains escaped meter IDs and summary values.

**Edge fixture:** six identical baseline values make MAD zero, followed by a 30% increase. The 25% branch must flag it.

---

## 08 — Travel Itinerary Repair

**Profile:** L; two stages; 900 seconds.

**Initial fixture:** `inputs/itinerary.json`, `inputs/airports.csv`, and `inputs/connection_rules.json` describe flights, trains, hotels, and activities in several time zones.

**Stage 1 task:** implement:

```bash
python -m solution.itinerary_check inputs --output output
```

Normalize every segment to UTC while retaining local display times. Detect overlapping segments, insufficient connections, airport changes, duplicate bookings, and nights without lodging. Connection intervals are half-open. Produce `timeline.csv` and `issues.json`.

**Stage 2 message:**

> `inputs/updates.json` contains revised and cancelled segments, and `inputs/alternatives.csv` contains replacement choices. Apply the highest revision per segment. For each broken connection caused by the update, choose the earliest-arriving alternative that satisfies the connection rules; break ties by price then alternative ID. Add `output/rebook.csv` and regenerate the timeline and issues.

**Progress landmarks:** timezone normalization; initial issues accurate; revisions/cancellations merged; deterministic rebooking; edge pass.

**Main correctness checks:** UTC/local conversion; overlap and connection thresholds; highest revision; exact alternative choice; final issue set.

**Edge fixture:** one hotel checkout ends at exactly the departure timestamp of a local train. Those half-open intervals do not overlap.

---

## 09 — Support SLA Event Analysis

**Profile:** N; one stage; 600 seconds.

**Fixture:** a 200,000-line `inputs/events.jsonl` with ticket events: `created`, `agent_reply`, `bot_reply`, `waiting_customer`, `customer_reply`, `resolved`, and `reopened`. Events are mostly time ordered but interleaved across tickets. Targets by priority are in `inputs/sla.json`.

**Task:** implement:

```bash
python -m solution.sla_report inputs/events.jsonl inputs/sla.json --output output
```

First response is the first non-bot agent reply after creation. Resolution time runs from creation to the last resolution, excluding complete intervals from `waiting_customer` to the next `customer_reply`. A reopen invalidates earlier final resolution. Produce `tickets.csv` and `summary.json`, including breach counts by priority. Process the input without loading the entire file text as one string.

**Progress landmarks:** streaming command; outputs parse; ticket state mostly correct; all durations/breaches exact; edge pass.

**Main correctness checks:** bot exclusion; waiting-time subtraction; reopened ticket handling; priority targets; exact aggregate breach counts.

**Edge fixture:** events for one ticket are out of order and include a duplicate event ID. Order by timestamp and ignore the duplicate ID.

---

## 10 — Local Supplier Catalog Crawler

**Profile:** N; one stage; 600 seconds.

**Fixture:** the runner starts `inputs/catalog_server.py` on loopback and writes its base URL to `inputs/base_url.txt`. It serves 40 paginated HTML pages, one transient `429` response with `Retry-After: 1`, duplicate SKUs with revisions, relative links, and HTML entities.

**Task:** implement:

```bash
python -m solution.catalog_sync --base-url-file inputs/base_url.txt --output output/catalog.csv
```

Use `urllib.request` and `html.parser`. Follow only same-origin pagination links. Retry a `429` once after the stated delay. Parse `sku,name,price,currency,stock,revision`; retain the highest numeric revision per SKU. Emit rows sorted by SKU. Do not scrape scripts or make concurrent requests.

**Progress landmarks:** crawler reaches server; rows parse; pagination/revisions correct; retry and origin restriction correct; edge pass.

**Main correctness checks:** visits every catalog page once except the one retry; exact SKU set; entity decoding; highest revision; deterministic CSV.

**Edge fixture:** the next link is relative and contains an encoded ampersand. It must resolve correctly without leaving the origin.

---

## 11 — SQLite CRM Migration

**Profile:** L; two stages; 900 seconds.

**Initial fixture:** editable `crm/` package and `workspace/crm.db` at schema version 1. The old `contacts` table stores name, email, phone, and notes in one row. Some emails differ only by case and surrounding spaces.

**Stage 1 task:** repair or implement:

```bash
python -m crm.migrate workspace/crm.db
```

Schema version 2 keeps `contacts(id,display_name,notes)` and adds `contact_methods(contact_id,kind,value,normalized_value,is_primary)`. Normalize emails with trim plus `casefold`; normalize phones to digits with an optional leading `+`. Merge duplicate-email contacts into the lowest ID and concatenate distinct notes in ID order. Set `PRAGMA user_version=2`. Running the migration again must make no further change.

**Stage 2 message:**

> Add `python -m crm.import_contacts workspace/crm.db inputs/new_contacts.csv output/import_report.json`. Update an existing contact when normalized email matches; otherwise insert. The report must list inserted IDs, updated IDs, and rows skipped for missing both email and phone.

**Progress landmarks:** package starts; migration completes; data/duplicates correct; import works and rerun is stable; edge pass.

**Main correctness checks:** schema and user version; preserved IDs/data; case-insensitive merge; second migration no-op; import report and resulting methods.

**Edge fixture:** three old contacts share the same normalized email and two have identical notes. Keep the lowest ID and include each distinct note once.

---

## 12 — Webhook Receiver and Replay

**Profile:** M; three stages; 1,200 seconds; request one compaction after stage 1.

**Fixture:** editable `webhook_app/` package with a partially working `http.server` service, SQLite schema, and a local sink server used by the judge.

**Stage 1 task:** make these interfaces work:

```bash
python -m webhook_app serve --db workspace/webhooks.db --port 0
python -m webhook_app worker --db workspace/webhooks.db --sink-url-file inputs/sink_url.txt --now 2025-07-01T12:00:00Z
```

`POST /events` accepts a JSON object and returns `202` with a local numeric ID. The worker sends pending events to the sink. A non-2xx response schedules retries at 1, 2, and 4 minutes; after the fourth failed delivery, status is `failed`. `GET /events/<id>` returns stored status.

**Stage 2 message after compaction:**

> Persist all retry state across service restarts and add `python -m webhook_app replay --db ... --failed`. Replay starts a new delivery cycle at cycle attempt zero while preserving the prior total-attempt count for reporting.

**Stage 3 message:**

> Add idempotency using the `X-Event-ID` request header. Reposting an existing external ID must return `200` with the original local ID and must not enqueue a second delivery.

**Progress landmarks:** server starts; happy-path delivery; retry/restart/replay; idempotency while retaining earlier behavior; edge pass.

**Main correctness checks:** HTTP status/body; persisted event state; exact retry schedule and terminal state; replay behavior; duplicate external ID delivery count.

**Edge fixture:** invalid JSON must return `400` and create no database row.

---

## 13 — Cross-Service Incident Timeline

**Profile:** H; four stages; 1,800 seconds; request compactions after stages 1 and 3.

**Initial fixture:** about 1.5 million lines across plain and gzip-compressed access, application, deployment, and database logs. The logs contain many unrelated errors. Relevant records share request IDs and release IDs. Input clocks have initially unknown offsets.

**Stage 1 task:** implement:

```bash
python -m solution.incident inputs/logs --window-start 2025-04-17T14:00:00Z --window-end 2025-04-17T14:30:00Z --output output
```

Produce `timeline.csv` with normalized raw timestamps, service, severity, request/release ID, event code, and source file/line; and `incident_report.md` with the observed failure sequence and three exact source anchors. At this stage, report the best evidence without inventing clock corrections.

**Stage 2 message after the first compaction:**

> A delayed database log batch was recovered as `inputs/logs/db-extra.log.gz`. Re-run the analysis and update the report. Distinguish the earliest causal event from the first user-visible failure.

**Stage 3 message:**

> `inputs/clock_offsets.json` now gives service clock offsets in milliseconds. Normalize the timeline to UTC, preserve each raw timestamp, and update every source anchor. The known incident is tied to a deployment release; name the release and the schema operation that caused the failures.

**Stage 4 message after the second compaction:**

> Repair `monitor/monitor.py`. It receives log lines on stdin and must emit one JSON alert when the same causal pattern appears within a 90-second window. Keep the batch timeline outputs as well.

**Private fixture truth; do not copy into `TASK.md`:** release `2025.04.17.3` executes a schema change that removes `customer_status`; application queries against that column then cause the first user-visible 500s. The monitor pattern is a deployment event containing that schema operation followed within 90 seconds by an application `UndefinedColumn` event for the same column. Its alert JSON contains release ID, column, causal timestamp, first application-error timestamp, and the distinct affected request count in the window.

**Progress landmarks:** scalable log parser; correlated preliminary timeline; corrected root cause and offsets; streaming monitor plus final exact evidence; edge pass.

**Main correctness checks:** gzip/plain streaming; correlation and source lines; causal event before first 500; offset-corrected ordering and exact release/schema operation; monitor emits one bounded alert for the pattern.

**Edge fixture:** the same request ID is reused the next day. Records more than 15 minutes apart must not be joined into one request chain.

---

## 14 — Layered Configuration Upgrade

**Profile:** N; one stage; 600 seconds.

**Fixture:** `defaults.ini`, `site.toml`, `user.json`, `runtime.json`, and `key_migrations.csv` describe a layered application configuration.

**Task:** implement:

```bash
python -m solution.config_upgrade inputs --output output/config.json --report output/report.txt
```

Precedence is defaults < site < user < runtime. Recursively merge objects; later lists replace earlier lists; JSON `null` deletes a key. Apply old-to-new key migrations before merging each layer. Resolve `${dotted.key}` substitutions anywhere inside string values after the final merge. Convert referenced scalar values with `str`; referenced objects or lists are invalid substitutions. Unknown keys are retained but listed in the report. Values under keys ending `_secret` appear as `***` in the report but remain unchanged in `config.json`.

**Progress landmarks:** parsers work; merged output exists; precedence/migrations/interpolation correct; reporting and error behavior correct; edge pass.

**Main correctness checks:** cross-format parsing; deep merge and deletion; migration precedence; substitution values; report redaction and warnings.

**Edge fixture:** two substitutions form a cycle. Exit with status 2, name the cycle on stderr, and do not write a partial config.

---

## 15 — Backup Restore Planner

**Profile:** N; one stage; 600 seconds.

**Fixture:** three tar/zip snapshots, member mtimes, and `inputs/restore_request.json` with requested regular-file paths plus a cutoff timestamp. The main fixture contains only safe relative member names.

**Task:** implement:

```bash
python -m solution.restore_plan inputs --output output
```

Inspect archives without first extracting them. For each requested path, choose the newest regular-file version whose member timestamp is not after the cutoff. Produce `restore_plan.csv`, extract chosen files under `output/restored/`, and write `warnings.csv` for requested paths that have no eligible version. Never extract an absolute path or a path that escapes `output/restored`.

**Progress landmarks:** archive inspection; plan parses; version choice/extraction correct; warnings complete; edge pass.

**Main correctness checks:** tar and zip support; cutoff selection; exact extracted bytes; deterministic plan order; missing-path warning rows.

**Edge fixture:** the only member matching a requested path is stored as `../requested.txt`. Report it as unsafe and do not create a file outside or inside the restore root for that member.

---

## 16 — Markdown Knowledge-Base Repair

**Profile:** L; two stages; 900 seconds.

**Initial fixture:** 250 Markdown files, nested directories, local assets, relative links, anchors, code fences, and `inputs/redirects.json`. Some links are broken but have one unambiguous redirect.

**Stage 1 task:** implement:

```bash
python -m solution.kb_repair inputs/kb --redirects inputs/redirects.json --output output
```

Copy the knowledge base to `output/kb`, repair only unambiguous relative document/asset links and anchors, leave external URLs alone, and do not alter text inside fenced code blocks. Generate `output/link_report.csv` and `output/index.json` containing titles, headings, and outgoing local links.

Use this anchor rule: Unicode NFKC, casefold, remove punctuation except spaces/hyphens, turn whitespace into `-`, collapse repeated hyphens, and append `-1`, `-2`, ... to duplicate headings within a file.

**Stage 2 message:**

> `inputs/renames.csv` lists documents moved by the content team. Apply the renames in the output copy, update links to the new locations, and keep redirects working for old link targets.

**Progress landmarks:** scanner/copy works; link report/index exist; repairs avoid code fences; renames and anchors correct; edge pass.

**Main correctness checks:** exact repaired/unresolved link sets; path resolution; duplicate-anchor rule; rename propagation; no edits in fenced code.

**Edge fixture:** a line resembling a Markdown link appears inside a fenced code block. It must remain byte-identical.

---

## 17 — Contract Clause Index and Comparison

**Profile:** M; three stages; 1,200 seconds; request one compaction after stage 1.

**Fixture:** 120 plain-text vendor agreements with form-feed page breaks and stable line numbers. Each relevant clause begins with a heading from `inputs/clause_aliases.json`; its body runs until the next recognized heading or form feed. Supported body forms are explicitly limited to: `renews for N months` or `does not automatically renew`; `notice ... N days`; `governed by the laws of JURISDICTION`; `liability ... $AMOUNT` or `N months of fees`; and `retain ... N days`. Normalize outputs respectively to `yes`/`no`, integer days, the jurisdiction text, `usd:AMOUNT` or `fees_months:N`, and integer days. The corpus is large enough that reading every file into the conversation is wasteful.

**Stage 1 task:** implement:

```bash
python -m solution.clause_index inputs/contracts --output output
```

Extract `auto_renewal`, `termination_notice_days`, `governing_law`, `liability_cap`, and `data_retention_days`. Produce `clauses.csv` with `contract_id,clause_type,normalized_value,start_line,end_line,excerpt` and `missing.csv`. Excerpts must come from the cited lines.

**Stage 2 message after compaction:**

> `inputs/review_set.csv` names 18 contracts under renewal review. Generate `output/comparison.md` grouping conflicting renewal windows, liability caps, and governing-law states, with source line ranges for each statement.

**Stage 3 message:**

> Some newly added agreements in `inputs/contracts-late/` have headings wrapped across two lines. Include that directory and update the parser without weakening the line citations.

**Progress landmarks:** extraction pipeline; correct values/anchors; review comparison; wrapped-heading support while retaining prior rules; edge pass.

**Main correctness checks:** normalized clause values; exact source ranges/excerpts; missing clauses; review-set conflict groups; late-directory parsing.

**Edge fixture:** a heading is split across two lines immediately before a clause body. It must be recognized, and the citation must start at the first heading line.

---

## 18 — Research-Note Search and Deduplication

**Profile:** L; two stages; 900 seconds.

**Initial fixture:** 8,000 Markdown notes with a simple metadata block (`Title:`, `Tags:`, `Created:`), Unicode text, and repeated or near-repeated bodies.

**Stage 1 task:** implement:

```bash
python -m solution.notes_index build inputs/notes workspace/notes.db output/duplicates.csv
python -m solution.notes_index search workspace/notes.db "query terms" --limit 10
```

Tokenize with Unicode NFKC plus `casefold`, maximal letter/digit runs, and stop words from `inputs/stopwords.txt`. For each unique query term, let `count` be body occurrences plus twice the title occurrences, `tf = 1 + ln(count)` when count is positive, and `idf = ln((N + 1) / (df + 1)) + 1`. The document score is the sum of `tf * idf`; omit zero-score notes and break ties by note path. Mark duplicates when normalized bodies are exact or token-set Jaccard similarity is at least 0.92. `duplicates.csv` uses the lexical first path as canonical.

**Stage 2 message:**

> `inputs/notes-new/` contains 600 new and edited notes. Add an `update` command that refreshes changed paths, removes deleted paths listed in `inputs/deleted.txt`, and preserves deterministic search results.

**Progress landmarks:** database builds; search returns sensible results; duplicate groups exact; incremental update/deletion correct; edge pass.

**Main correctness checks:** tokenization and ranking; deterministic ties; duplicate canonicalization; update inserts/changes/deletes; unchanged query results remain stable.

**Edge fixture:** two visually equivalent note bodies use composed versus decomposed Unicode. Normalization must make them exact duplicates.

---

## 19 — Sensor Resampling and Gap Report

**Profile:** N; one stage; 600 seconds.

**Fixture:** `inputs/readings.csv.gz` contains about 1.2 million interleaved rows for 30 sensors with `timestamp,sensor_id,value,status`; `inputs/sensors.json` marks each sensor as `gauge` or `counter`.

**Task:** implement:

```bash
python -m solution.sensor_resample inputs/readings.csv.gz inputs/sensors.json --output output
```

Use five-minute UTC half-open buckets. Ignore `status=BAD`. For gauge sensors output count, min, max, and arithmetic mean. For counters, compare consecutive good readings per sensor. Assign each non-negative delta to the bucket containing the later reading. A decrease contributes no delta, starts a new counter run, and is listed in `resets.csv`. Report gaps longer than 15 minutes between good readings in `gaps.csv`. Write `resampled.csv.gz` sorted by bucket then sensor.

**Progress landmarks:** streaming gzip parser; output parse; bucket math/reset handling mostly correct; exact selected rows/gaps; edge pass.

**Main correctness checks:** bucket boundaries; BAD exclusion; gauge aggregates; counter reset math; exact gap intervals and sort order.

**Edge fixture:** a bucket contains only BAD readings. It must not appear in resampled output, while surrounding good readings may still form a gap.

---

## 20 — Time-of-Use Energy Billing

**Profile:** M; three stages; 1,200 seconds; request one compaction after stage 1.

**Fixture:** 15-minute interval readings with explicit UTC offsets, customer/timezone metadata, tariff effective periods, weekday/weekend/holiday bands, demand charges, and taxes.

**Stage 1 task:** implement:

```bash
python -m solution.energy_bill inputs --period 2025-10 --output output
```

Assign each interval to a local tariff band using its supplied offset and customer timezone. Sum kWh with `Decimal`, compute energy charges, the monthly demand charge from the largest qualifying kW interval, then tax. Produce `bills.csv` and `bill_detail.csv` with exact rate references.

**Stage 2 message after compaction:**

> `inputs/tariff_correction.json` changes one rate retroactively from 2025-10-15. Produce `output/adjustments.csv` containing only old total, corrected total, and delta per affected customer, while updating the final bills.

**Stage 3 message:**

> Add `output/explanations/<customer>.txt` showing interval counts and subtotal by tariff band, demand charge, tax, prior total, and correction delta. Keep exact rate IDs and cents.

**Progress landmarks:** initial bills; band/demand calculations exact; retroactive deltas; explanations retain all prior facts; edge pass.

**Main correctness checks:** local-band assignment across DST; Decimal totals; demand maximum; effective-date correction; explanation subtotals reconcile to bills.

**Edge fixture:** one interval has negative kWh from a documented meter correction. It reduces energy quantity and charge but is excluded from demand-maximum selection.

---

## 21 — WAV Interview Cleanup and Chapters

**Profile:** L; two stages; 900 seconds.

**Initial fixture:** a mono 16-bit PCM WAV recording, transcript CSV with timed utterances, and chapter constraints.

**Stage 1 task:** implement:

```bash
python -m solution.audio_chapters inputs/interview.wav inputs/transcript.csv --output output
```

Read PCM frames with `wave` and standard binary tools. Silence is at least 1.2 seconds where every sample's absolute value is below 500. Trim leading and trailing silence. Choose the midpoint of the silence interval nearest the 10-minute target among silences occurring 8 to 12 minutes after the previous boundary; break equal-distance ties toward the earlier cut. If none exists, cut at exactly 12 minutes on a frame boundary. Shift transcript timestamps by the trimmed leading duration and clip utterances to the retained audio. `speaker_time.csv` sums clipped `end-start` duration per speaker. Write `clean.wav`, `chapters/NN.wav`, `chapters.json`, and `speaker_time.csv`. Do not re-encode or change sample rate/sample width/channel count.

**Stage 2 message:**

> A stereo 16-bit recording and transcript were added. Accept either mono or stereo. A frame is silent only when both channels are below the threshold. Produce a separate output directory for each input named by WAV stem.

**Progress landmarks:** WAV parsed; valid trimmed output; chapter timing/transcript totals correct; stereo follow-up works; edge pass.

**Main correctness checks:** frame/sample math; trim points; boundary choice; chapter WAV headers/data lengths; per-speaker duration totals.

**Edge fixture:** an all-silence WAV must produce a valid zero-frame `clean.wav`, an empty chapter list, and zero speaker durations without crashing.

---

## 22 — Timesheet and Payroll Correction

**Profile:** M; three stages; 1,200 seconds; request one compaction after stage 1.

**Fixture:** punch records with explicit offsets, employee pay rates and groups, holidays, and company rules. All policies are synthetic and stated in `TASK.md`.

**Stage 1 task:** implement:

```bash
python -m solution.payroll inputs --week-ending 2025-11-09 --output output
```

Pair `IN`/`OUT` punches by employee and shift. Deduct 30 unpaid minutes when a shift exceeds six hours and has no explicit break. For non-union employees, weekly hours above 40 pay 1.5x. Night minutes from 22:00 through 06:00 earn a 10% differential. Produce `payroll.csv`, `shift_detail.csv`, and `exceptions.csv`.

**Stage 2 message after compaction:**

> `inputs/punch_corrections.csv` supersedes punch records by `record_id`. Apply corrections before pairing, and include changed gross pay in `output/correction_summary.csv`.

**Stage 3 message:**

> `inputs/union_rules.json` now applies to group `U`: hours after 8 in a local day pay 1.5x and after 12 pay 2x; weekly overtime does not stack. Keep the night differential additive on base pay. Recalculate all files.

**Progress landmarks:** shifts pair; base payroll accurate; corrections supersede old punches; union/DST rules and exact cents retained; edge pass.

**Main correctness checks:** pairing and breaks; weekly versus daily tiers; minute-level night differential; correction delta; exact gross totals.

**Edge fixture:** a shift crosses the daylight-saving fallback with explicit offsets. Pay actual elapsed time, not naive wall-clock difference.

---

## 23 — Procurement Three-Way Match

**Profile:** M; three stages; 1,200 seconds; request one compaction after stage 1.

**Fixture:** purchase orders in CSV, goods receipts in JSON, supplier invoices in XML, and item unit conversions. It includes partial receipts, multiple invoices, freight, tax, and known tolerances.

**Stage 1 task:** implement:

```bash
python -m solution.three_way_match inputs --output output
```

Aggregate receipts and invoices by PO line. Convert cases/eaches using `items.csv`. A line passes quantity when `abs(received_qty - invoiced_qty) <= 0.02 * ordered_qty` and passes price when `abs(invoice_unit_price - po_unit_price) <= 0.01 * po_unit_price`. Header freight and tax are reported separately, not allocated into line unit price. Produce `line_matches.csv`, `exceptions.csv`, and `supplier_summary.json`.

**Stage 2 message after compaction:**

> `inputs/receipt_corrections.json` voids or replaces selected receipt records. Apply corrections by record ID and regenerate the match.

**Stage 3 message:**

> `inputs/credit_notes.xml` contains line and header credits. Apply line credits to the referenced invoice line and header credits to supplier unapplied balance. Add `credit_applied` and final payable totals.

**Progress landmarks:** initial matching; tolerances/conversions correct; corrections replace old data; credits and totals reconcile; edge pass.

**Main correctness checks:** line aggregation and conversion; tolerance boundaries; correction semantics; credit application; supplier totals equal line/header components.

**Edge fixture:** a line credit exceeds that invoice line's remaining payable amount. Cap the line at zero and report the excess as unapplied credit.

---

## 24 — Multi-Warehouse Order Fulfillment

**Profile:** M; three stages; 1,200 seconds; request one compaction after stage 1.

**Fixture:** 500 orders, four warehouses, inventory, shipping costs, already-shipped lines, and per-order `allow_partial` flags.

**Stage 1 task:** implement:

```bash
python -m solution.fulfill inputs --output output
```

Process orders by priority (`urgent`, `high`, `normal`), due date, then order ID. For each order, enumerate feasible allocations using at most three warehouses. If a full allocation exists, choose fewer warehouses, then lower shipping cost, then warehouse tuple. Otherwise, when partial fulfillment is allowed, maximize the number of completely filled lines, then total requested units filled, then choose fewer warehouses, lower shipping cost, and warehouse tuple. Shipping cost is the sum of one `base_cost` per used warehouse plus `per_unit_cost * units` from `shipping_cost.csv`. Do not consume stock from later orders until the current choice is fixed. Produce `allocations.csv`, `backorders.csv`, and `inventory_after.csv`.

**Stage 2 message after compaction:**

> `inputs/warehouse_outage.json` removes one warehouse from new allocations. Preserve rows already marked shipped, release only unshipped reservations from that warehouse, and create `output/allocation_changes.csv`.

**Stage 3 message:**

> `inputs/expedite.csv` raises selected unshipped orders to urgent. Replan the remaining pool under the same objective without changing shipped lines.

**Progress landmarks:** deterministic initial allocator; inventory conserved; outage replan preserves shipped state; expedite priority and deltas correct; edge pass.

**Main correctness checks:** order ordering; feasible allocation objective; no over-allocation; outage release/preservation; exact final backorders and change rows.

**Edge fixture:** an order cannot be fully filled and has `allow_partial=false`. Allocate nothing and backorder every line.

---

## 25 — Library Circulation Reconstruction

**Profile:** L; two stages; 900 seconds.

**Initial fixture:** 300,000 circulation transactions in CSV plus patron and catalog data. Transaction kinds are checkout, renew, return, mark-lost, waive-fine, and restore. Rows are interleaved and not guaranteed to be timestamp ordered.

**Stage 1 task:** implement:

```bash
python -m solution.library_state inputs --as-of 2025-08-31T23:59:59Z --output output
```

Order each item's transactions by timestamp then transaction ID. Reconstruct active loans and lost items. Checkout and renewal rows carry explicit due dates; renewal replaces the current due date only when the item is actively loaned. A fine accrues for each local calendar day after the due date through the day before return, or through the as-of date when still open, capped by the catalog cap. Returns stop fines. `mark-lost` adds the catalog lost fee but does not erase already accrued fines; `restore` removes the lost fee. Waivers subtract from the patron balance without taking it below zero. Produce `active_loans.csv`, `fines.csv`, and one UTF-8 notice per patron under `output/notices/`.

**Stage 2 message:**

> `inputs/corrections.csv` lists transaction IDs to void and replacement transactions. Apply the corrections before reconstruction and add `output/correction_effects.csv` showing patrons whose balance or active-loan set changed.

**Progress landmarks:** scalable reconstruction; state outputs parse; fines/loans exact; corrections replayed and effects listed; edge pass.

**Main correctness checks:** per-item ordering; renewal/return/lost transitions; fine totals; notice content; correction delta set.

**Edge fixture:** a return row appears before its checkout in file order but after it by timestamp. Timestamp ordering must produce a closed loan.

---

## 26 — School Meal Allergen and Stock Plan

**Profile:** L; two stages; 900 seconds.

**Initial fixture:** recipes, ingredient components, allergen tags, weekly menu, student restrictions, inventory, and pack sizes.

**Stage 1 task:** implement:

```bash
python -m solution.meal_plan inputs --output output
```

Resolve nested recipe components to base ingredients and multiply quantities per planned serving from `menu.csv`. An item tagged `may_contain` counts as containing that allergen. Produce `eligibility.csv` for every student/menu option, `safe_options.csv` listing at least one safe option per student/day when available, and `purchase_list.csv` after subtracting stock and rounding up packs.

**Stage 2 message:**

> `inputs/substitutions.json` changes selected ingredients by effective date and may introduce new component recipes. Recompute allergens and purchases, and add `output/substitution_impacts.csv` for eligibility changes.

**Progress landmarks:** recipe graph resolves; eligibility/purchases plausible; exact allergen propagation; substitutions and impacts correct; edge pass.

**Main correctness checks:** nested quantities; allergen/may-contain propagation; student restrictions; stock/pack rounding; exact changed eligibility rows.

**Edge fixture:** a substitution creates a component cycle. Report the recipe in `output/errors.csv`, omit that menu option from safe choices, and continue processing other recipes.

---

## 27 — Clinic Appointment Rescheduling

**Profile:** H; four stages; 1,800 seconds; request compactions after stages 1 and 3.

**Initial fixture:** 250 appointments, provider availability, patient windows, rooms, equipment, appointment types, locked appointments, and travel buffers between clinic sites.

**Stage 1 task:** implement:

```bash
python -m solution.clinic_schedule inputs --output output
```

Validate the existing schedule and produce `baseline_issues.csv` plus a normalized `schedule.csv`. A valid appointment must fit provider and patient availability, required room/equipment, site travel time, and no-overlap rules.

**Stage 2 message after the first compaction:**

> `inputs/provider_absence.json` makes one provider unavailable. Reschedule affected unlocked appointments. Optimize: schedule the most appointments; minimize the number moved; minimize total absolute minutes moved; preserve provider when possible; then earliest slot and appointment ID. Produce `changes.csv` and `unscheduled.csv`.

**Stage 3 message:**

> `inputs/urgent_requests.csv` adds urgent patients. An urgent request may displace one lower-priority unlocked appointment if the displaced appointment can be rescheduled. Locked appointments cannot move.

**Stage 4 message after the second compaction:**

> `inputs/equipment_outage.json` removes one room's imaging equipment. Regenerate the final schedule and write one plain-text notification per changed or unscheduled patient under `output/notices/`. Retain every prior optimization rule.

**Progress landmarks:** baseline validation; absence reschedule; urgent insertion without breaking locks; equipment replan and notices after two compactions; edge pass.

**Main correctness checks:** all resource/time constraints; objective ordering for affected appointments; locked-appointment preservation; urgent displacement chain; exact change/unscheduled/notices.

**Edge fixture:** an urgent request has no feasible slot even with one displacement. Leave it unscheduled rather than violate a constraint or move a locked appointment.

---

## 28 — Permit Intake and Status Pipeline

**Profile:** H; four stages; 1,800 seconds; request compactions after stages 1 and 3.

**Initial fixture:** editable `permitflow/` package, 1,000 applications in JSON/XML, parcel and owner registries, zoning rules, fee tables, and attachment metadata.

**Stage 1 task:** implement:

```bash
python -m permitflow import inputs workspace/permits.db
python -m permitflow validate workspace/permits.db --output output
```

Normalize applications into SQLite while preserving source IDs. Validate parcel existence, owner match, zone/type compatibility, required document types, and fee. Produce `applications.csv`, `validation_issues.csv`, and `fees.csv`. Duplicate source IDs update the higher revision rather than creating another application.

**Stage 2 message after the first compaction:**

> `inputs/ordinance_update.json` changes required documents and fees from an effective date. Revalidate only applications still open on that date and add `output/ordinance_impacts.csv`.

**Stage 3 message:**

> `inputs/correction_batch/` contains owner corrections and duplicate-application links. Apply higher revisions, merge linked duplicates into the lowest application ID, and retain all document references on the survivor.

**Stage 4 message after the second compaction:**

> Generate `output/status.csv` and one notice letter per application. Status is `approved` when parcel, owner, zoning, and required documents are valid; `needs_information` when the only blockers are missing or expired documents; and `manual_review` for absent parcels, owner mismatches, zoning incompatibility, unresolved duplicates, or parse errors. Letters must name only the actual outstanding issues and exact fee due.

**Progress landmarks:** database import; core validation; ordinance/correction updates; final statuses/letters after two compactions; edge pass.

**Main correctness checks:** mixed-format normalization; revision/duplicate behavior; effective-date revalidation; merge preservation; exact status, fees, and letter issues.

**Edge fixture:** an application has a syntactically valid parcel ID absent from the registry. It must be `manual_review`, not crash or become approved.

---

## 29 — Legacy Budgeting CLI Repair

**Profile:** M; three stages; 1,200 seconds; request one compaction after stage 1.

**Initial fixture:** editable `budgetdesk/` package with about a dozen modules, a v1 SQLite database, two bank CSV dialects, category rules, and a broken CLI. The task statement defines existing commands and expected semantics; there are no undocumented traps.

**Stage 1 task:** repair:

```bash
python -m budgetdesk import workspace/budget.db inputs/accounts.json inputs/statements
python -m budgetdesk report workspace/budget.db --month 2025-05 --output output/monthly.json
```

Imports must normalize dates/descriptions, use `Decimal`, avoid duplicate source rows using `(source_account, source_id)`, apply ordered category rules, and produce income, spending, transfers, and budget variance.

**Stage 2 message after compaction:**

> Migrate the database to support split transactions. `inputs/splits.csv` assigns category/amount parts to existing source rows. Split parts must sum exactly to the transaction amount, and the monthly report must use parts instead of the parent category.

**Stage 3 message:**

> Add `python -m budgetdesk export workspace/budget.db --format csv|json --output PATH` with stable ordering and all original source IDs. Keep repeated imports idempotent.

**Progress landmarks:** CLI starts; initial import/report correct; migration/splits work; export and repeated import preserve state; edge pass.

**Main correctness checks:** both dialects; duplicate prevention; category/transfer totals; split migration and report; deterministic CSV/JSON export.

**Edge fixture:** a split file does not sum exactly to the parent amount. Reject that split row, leave the original transaction unsplit, and report the error without corrupting other splits.

---

## 30 — Helpdesk Service Upgrade

**Profile:** H; five stages; 1,800 seconds; request compactions after stages 1 and 3.

**Initial fixture:** editable `helpdesk/` package with roughly 20 Python files, SQLite migrations, a loopback HTTP service, and failing ticket/comment behavior.

**Stage 1 task:** repair the service and CLI:

```bash
python -m helpdesk serve --db workspace/helpdesk.db --port 0
python -m helpdesk create-agent workspace/helpdesk.db --email agent@example.test
```

Required API: create/get/update tickets; append comments; list tickets by status and assignee. Use JSON over HTTP and stable numeric IDs. Preserve supplied database data.

**Stage 2 message after the first compaction:**

> Import `inputs/archive.mbox` with `python -m helpdesk import-mail`. Messages addressed to `support+<ticket-id>@example.test` become comments; unmatched threads create tickets. Preserve external `Message-ID` for deduplication.

**Stage 3 message:**

> Add SLA due times from `inputs/sla.json` using stated business hours and holidays. A customer comment reopens a resolved ticket. Add `python -m helpdesk escalations --as-of ... --output output/escalations.csv`.

**Stage 4 message after the second compaction:**

> Add deterministic token search over subject, body, and comments plus `python -m helpdesk export --status ... --output output/tickets.csv`. Tokenize with NFKC/casefold alphanumeric runs. Query terms use AND semantics. Rank by `3 * subject_hits + 2 * body_hits + comment_hits`, then newest `updated_at`, then ticket ID. Do not rely on optional SQLite extensions.

**Stage 5 message:**

> Add `python -m helpdesk maintenance --as-of ... --output output/maintenance.json`. Close stale `pending_customer` tickets after the configured number of business days and report every changed ticket. Retain all earlier API, import, SLA, search, and export behavior.

**Progress landmarks:** service/API starts; mailbox import/dedupe; SLA/reopen/escalation; search/export after compaction; maintenance with all previous behavior intact; edge pass.

**Main correctness checks:** core API state transitions; mbox threading and message dedupe; business-time SLA/reopen; deterministic search/export; stale closure and final database state.

**Edge fixture:** the same external `Message-ID` appears twice in different mbox files. Import one comment only and report the duplicate as skipped.

---

## 10. Implementation details for fixture authors

### 10.1 Main and edge fixtures

For every task:

- Build one realistic main dataset containing all ordinary requirements and named anchor cases.
- Build exactly one small edge dataset exercising the stated edge behavior.
- Keep the edge isolated enough that a failure has an obvious meaning.
- Generate expected values inside `judge.py` with a small reference calculation or explicit anchor values. Do not share solution code with the judge.
- Avoid huge expected-output files. Check semantic rows, totals, and selected records directly.

### 10.2 Large-input targets

Use these approximate generated sizes:

- Task 09: 200,000 JSONL rows, 25–40 MB.
- Task 13: 1.5 million mixed log lines, 60–100 MB compressed/uncompressed combined.
- Task 17: 120 contracts, 25–40 MB total.
- Task 18: 8,000 notes, 20–30 MB total.
- Task 19: 1.2 million gzip CSV rows, 25–50 MB compressed.
- Task 25: 300,000 CSV rows, 35–60 MB.
- Task 30: 5,000 mbox messages plus the editable application.

Other tasks should stay below 10 MB unless their format naturally requires more. The purpose is to reward targeted scripting and indexing, not raw file dumping. Keep the candidate graphs for Tasks 06, 24, and 27 sparse enough that a straightforward independent reference search in the judge finishes within a few seconds.

### 10.3 Output determinism

Each `TASK.md` must state ordering and formatting where it matters. Judges should accept semantically equivalent JSON whitespace and ICS property order only where the task does not prescribe a canonical form. CSV header names and row ordering are exact when specified.

### 10.4 Local services

Tasks 10, 12, and 30 use loopback services. The runner starts fixture servers on port 0, writes the selected URL or port into a visible input file, and tears them down after the agent run. A task-owned server started with `--port 0` must print exactly one `LISTENING <port>` line once it is ready so the runner and judge can connect. Judges start fresh servers for final evaluation. No service may contact the public network.

### 10.5 Read-only inputs

Make input data read-only rather than adding content hashes or post-run integrity systems. Repair-task application directories remain writable. The judge runs against a fresh fixture, so modifying generated outputs cannot alter expected values.

---

## 11. Suggested implementation order

1. Implement `benchlib.py`, `scenario.json` parsing, workspace creation, stage injection, compaction requests, event/usage capture, and judge invocation.
2. Implement one task from each pressure class: 01, 02, 06, and 13. Confirm the runner handles single-turn, follow-up, one-compaction, and two-compaction workflows.
3. Implement the remaining N tasks, then L, M, and H.
4. Run each task once with a plain Python reference solution maintained only during fixture development; remove that solution from the distributed workspace.
5. Keep the final corpus to the stated one judge and one edge case per task. Stop when the workflow and judge are direct and reproducible.

---

## 12. Definition of done

The benchmark is ready when:

- all 30 `seed.py` scripts create fresh deterministic workspaces using only the standard library;
- all initial and follow-up prompts match this specification;
- class distribution is exactly 8 N, 10 L, 8 M, and 4 H;
- requested compactions occur only at the documented natural stage boundaries;
- every task has one readable `judge.py`, one main fixture, and one specified edge fixture;
- judges emit the common JSON result and can distinguish progress levels 0 through 5;
- the runner records the required provider, tool, compaction, time, and cost metrics without changing task behavior;
- no task requires internet access, third-party Python packages, external executables, exact final-response boilerplate, or benchmark-only goal rituals;
- a strict pass means level 5, and efficiency comparisons include only matched strict-pass task pairs.
