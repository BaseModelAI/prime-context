# Contract Clause Index and Comparison

Use Python 3.12 and only the standard library. Implement the command:

```bash
python3.12 -E -S -m solution.clause_index inputs/contracts --output output
```

The input contains plain-text vendor agreements. A form-feed character is a page break. Physical lines are numbered from 1. `inputs/clause_aliases.json` maps the five canonical clause types to recognized headings. Heading matching is case-insensitive after trimming surrounding whitespace. A clause starts on its heading line and ends immediately before the next recognized heading or a line containing a form feed. The excerpt is the exact UTF-8 text of the cited physical lines joined with `\n`, with no final newline.

Extract these clause types:

* `auto_renewal`: a body says either `renews for N months` or `does not automatically renew`; output `yes` or `no`.
* `termination_notice_days`: a body contains `notice ... N days`; output the decimal integer days.
* `governing_law`: a body says `governed by the laws of JURISDICTION`; output the jurisdiction text with surrounding whitespace and a final period removed.
* `liability_cap`: a body contains either `liability ... $AMOUNT` or `N months of fees`; output `usd:AMOUNT` (commas removed) or `fees_months:N`.
* `data_retention_days`: a body contains `retain ... N days`; output the decimal integer days.

Write `output/clauses.csv` with this exact header:

```text
contract_id,clause_type,normalized_value,start_line,end_line,excerpt
```

`contract_id` is the input filename without `.txt`. Write rows in lexical `(contract_id, clause_type)` order. Line numbers include the heading and every body line in the excerpt. Write `output/missing.csv` with header `contract_id,clause_type`, one row for each absent or unsupported clause, in the same lexical order. A contract has at most one recognized heading for each canonical type. CSV is UTF-8 with ordinary CSV quoting and LF records.

Do not put the corpus in source code or load it into a conversation. Process the local files. Create parent directories as needed and replace deterministic outputs on each run.
