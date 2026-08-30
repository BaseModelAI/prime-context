# Discount, tax, and account-credit follow-up

Final requirements:
- Subscription may include integer `discount_percent` from 0 to 100, nonnegative Decimal-string `tax_percent`, and nonnegative Decimal-string `credit_balance`.
- For every recurring and usage line, compute its discount from gross amount and round to cents with `ROUND_HALF_EVEN`.
- Compute tax from the post-discount net and round each line's tax independently to cents.
- Add two-decimal `discount`, `net`, and `tax` fields to each line.
- `subtotal` is gross; also return `discount_total`, `tax_total`, and `pre_credit_total`.
- Apply credit up to the nonnegative pre-credit total. Return `credit_applied`, `ending_credit`, and final `total` as two-decimal strings.
- Defaults are zero discount, zero tax, and zero credit.
