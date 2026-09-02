# Final status and letters

The next `validate` must also create `output/status.csv` with header `application_id,source_id,status,fee_due`, sorted by numeric application ID, and `output/notices/<application_id>.txt` for every surviving application. Use `approved` when there are no parcel, owner, zoning, or document issues; `needs_information` when every blocker is `MISSING_DOCUMENT` or `EXPIRED_DOCUMENT`; otherwise use `manual_review`. `FEE_MISMATCH` changes fee due but is not a status blocker.

Each UTF-8 letter is exactly:

```
Permit application <source_id>
Status: <status>
Fee due: <0.00>
Outstanding issues:
- <CODE>: <detail>
```

List issues in the same `(code, detail)` order as `validation_issues.csv`; use `- none` when there are none. End the file with one newline.
