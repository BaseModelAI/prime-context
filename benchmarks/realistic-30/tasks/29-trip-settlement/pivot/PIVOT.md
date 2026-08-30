# Weighted participant shares pivot

Preserve equal splitting for expenses without `shares` and add:
- An expense may contain `shares`, a mapping of participant name to positive integer weight.
- Only listed participants owe that expense.
- Allocate cents proportionally by weight using largest fractional remainder.
- Break equal remainders by `people` order.
- Payers and share names must appear in `people`; names are unique.
