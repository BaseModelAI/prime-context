# Correction batch

On the next `import`, apply owner corrections only when their revision is higher. Merge every linked duplicate pair into the row with the lower numeric `application_id`. Keep that survivor's source ID and application values, re-associate all attachment references from both source IDs with the survivor, and remove the other application. Re-running the batch is idempotent. Then revalidate.
