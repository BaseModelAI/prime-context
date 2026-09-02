# Mailbox Thread Cleanup

Use Python 3.12 and the standard library only. Do not use the network or install packages.

Build `solution/mailbox_clean.py`. The initial command is:

```bash
python -m solution.mailbox_clean inputs/current.mbox --output output
```

## Mail handling

Read the input mbox in source order. Treat every physical mbox entry as a message.

- Keep one copy of each non-empty `Message-ID`. When an ID is repeated, keep the copy with the latest valid `Date`. A valid date beats a missing or invalid date. If candidates have the same valid instant, or none has a valid date, keep the earliest input copy.
- Messages without a `Message-ID` remain distinct.
- Decode RFC 2047 headers. Unknown charsets or invalid bytes must use replacement characters instead of aborting.
- When body text must be inspected, prefer a non-attachment `text/plain` MIME part. If there is none, use non-attachment `text/html`. Never inspect or place attachment payload bytes in CSV output.
- Determine a message's thread root from the first message ID in `References`; if absent, use the first ID in `In-Reply-To`; if absent, use its own `Message-ID`. A no-ID orphan may use any stable, unique generated thread ID.
- The display subject is the decoded subject with any repeated leading `Re:`, `Fwd:`, or `Fw:` prefixes removed case-insensitively. Prefix removal affects only the CSV display value, not the message stored in the cleaned mbox.
- A participant is a mailbox address found in `From`, `To`, or `Cc`. Lowercase addresses, remove duplicates, sort them, and join them with `;`.
- Normalize valid dates to UTC as `YYYY-MM-DDTHH:MM:SSZ`. Treat a naive parsed date as UTC. Missing or invalid dates are unknown.

## Outputs

Create `output` if needed and replace these files on each run:

1. `cleaned.mbox`, containing the retained original messages. Sort by `thread_id`; within a thread put valid dates in chronological order, then unknown dates; break remaining ties by retained input order.
2. `threads.csv`, with this exact header:

   ```text
   thread_id,subject,participants,first_date,last_date,message_count
   ```

   Write one row per thread, sorted by `thread_id`. `subject` comes from the earliest retained message in the thread with a non-empty display subject. Participants are the sorted union for the thread. `first_date` and `last_date` are the earliest and latest valid dates; leave both blank when a thread has no valid date. Count retained messages, including no-ID messages.
3. `unsubscribe.csv`, with this exact header:

   ```text
   sender_domain,http_targets,mailto_targets
   ```

   Parse URI targets enclosed in angle brackets in every retained `List-Unsubscribe` header. Aggregate by the lowercase domain of the sender address. Sort and de-duplicate each scheme's targets, join them with `;`, and sort rows by sender domain. HTTP and HTTPS targets go in `http_targets`; `mailto:` targets go in `mailto_targets`.

Write UTF-8 CSV with one header even when there are no data rows. Output must be deterministic and must not contain attachment payloads.

## Stated edge behavior

A multipart message can declare an unknown charset and contain valid text bytes plus a large binary attachment. Decode headers and inspected text with replacement, complete the run, and never copy attachment bytes into CSV output.
