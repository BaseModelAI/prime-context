# Urgent request update

`inputs/urgent_requests.csv` adds appointment requests. Its columns are
`appointment_id,patient_id,type_id,site_id,window_start,window_end,priority,preferred_provider_id`.
The request window is the patient's only window and the site is fixed. The
preferred provider is a tie preference, not an eligibility restriction. An
urgent appointment may use any listed provider and capable room.

Apply all earlier validity and optimization rules. Before the final tie rule,
prefer the urgent request's listed provider when this does not worsen an
objective above it. One urgent request may directly displace at most one
lower-priority unlocked existing appointment. It is allowed only if that
existing appointment is scheduled feasibly elsewhere in the same result.
An urgent request may not displace an equal/higher-priority or locked
appointment. If no result obeys these rules, put the urgent appointment in
`unscheduled.csv` instead of violating a constraint.

A scheduled urgent request is added to `schedule.csv` with `locked=false` and
is added to `changes.csv` using `change_kind=urgent_scheduled`. Its old
provider, old room, old start, and `minutes_moved` fields are blank. Continue
to report moved existing appointments as `moved`. An unscheduled urgent
request appears only in `unscheduled.csv`, with reason `NO_FEASIBLE_SLOT`.
Regenerate all current reports after each run.
