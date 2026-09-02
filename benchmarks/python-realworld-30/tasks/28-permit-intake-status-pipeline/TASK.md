# Permit intake and validation

The county has received 1,000 permit records from two intake systems. Build the
editable `permitflow/` package into a standard-library-only command-line
application. Do not modify files under `inputs/`. Put the SQLite database under
`workspace/` and reports under `output/`.

Run the initial workflow with these commands:

```bash
python -m permitflow import inputs workspace/permits.db
python -m permitflow validate workspace/permits.db --output output
```

## Input files

- `inputs/applications.json` is an object with an `applications` list.
- `inputs/applications.xml` has an `<applications>` root and one
  `<application>` child per record. XML child names match the JSON field names.
- An application has `source_id`, integer `revision`, `parcel_id`, `owner_id`,
  `permit_type`, `submitted_date`, optional `closed_date`, and decimal
  `fee_paid`. Empty XML text represents an empty value.
- `inputs/parcels.csv` maps `parcel_id` to its registered `owner_id` and `zone`.
  `inputs/owners.csv` is the owner registry.
- `inputs/zoning_rules.csv` lists allowed `(zone, permit_type)` pairs.
- `inputs/document_requirements.csv` lists required document types by permit
  type. Every row is one requirement.
- `inputs/fee_table.csv` gives the initial required fee by permit type.
- `inputs/attachments.csv` contains `document_id`, `source_id`,
  `document_type`, `expires_on`, and `filename`. A blank expiry never expires.
- `inputs/settings.json` supplies the fixed `validation_date`. Do not use the
  wall clock.

Dates are ISO `YYYY-MM-DD`. Currency values have exactly two decimal places.
Use `decimal.Decimal` for all fee calculations.

## Import and revision rules

Normalize both application sources into SQLite and preserve every source ID.
Process JSON records first in file order, then XML records in file order.
Assign internal `application_id` values from 1 in first-seen order. If a source
ID appears again, keep the same internal ID and replace its application fields
only when the incoming integer revision is higher. A lower or equal revision
must not create or replace an application. Attachments remain associated by
source ID.

A malformed field in an otherwise readable record must not abort the import.
Preserve the record and report `PARSE_ERROR` with detail `field_name` during
validation. The supplied source files themselves are valid JSON and XML.
Re-running `import` against the same database must produce the same state.

## Validation rules

For every current application, calculate these issues:

| Code | Detail | Condition |
|---|---|---|
| `PARSE_ERROR` | field name | an integer, date, or decimal application field is invalid |
| `PARCEL_NOT_FOUND` | parcel ID | the syntactically valid parcel ID is absent from `parcels.csv` |
| `OWNER_MISMATCH` | application owner ID | the owner is absent from the owner registry or does not equal the parcel owner |
| `ZONING_INCOMPATIBLE` | `zone/permit_type` | the parcel exists but that pair is not allowed |
| `MISSING_DOCUMENT` | document type | no attachment of a required type exists |
| `EXPIRED_DOCUMENT` | document type | attachments of that required type exist, but all expire before `validation_date` |
| `FEE_MISMATCH` | `required 0.00; paid 0.00` | paid and required fees differ |

If a parcel is absent, report `PARCEL_NOT_FOUND` without inventing owner or
zoning issues from unavailable parcel data. A required type is satisfied when
at least one attachment of that type is unexpired. Fee due is
`max(required_fee - fee_paid, 0.00)`.

Create `output/` if needed. Write UTF-8 CSV with a header and LF line endings:

- `applications.csv` — `application_id,source_id,revision,parcel_id,owner_id,permit_type,submitted_date,closed_date`
- `validation_issues.csv` — `application_id,source_id,code,detail`
- `fees.csv` — `application_id,source_id,required_fee,paid_fee,fee_due`

Sort all rows by numeric `application_id`. Sort multiple issue rows for one
application by `(code, detail)`. Format every fee with two decimal places.
Replace reports rather than appending when a command is run again.

The initial stage is complete when both commands succeed and all three reports
reflect the normalized, highest-revision records. Later policy and casework
updates will arrive as ordinary follow-up requests.
