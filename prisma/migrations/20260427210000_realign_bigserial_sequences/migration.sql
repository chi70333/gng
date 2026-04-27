-- Production imported some legacy rows with explicit IDs, leaving BIGSERIAL
-- sequences behind table data. Realign every id sequence so the next insert
-- starts after the current max(id); this fixes UserPointHistory P2002 id
-- collisions seen on admin mileage adjustments.
DO $$
DECLARE
  row record;
BEGIN
  FOR row IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND column_name = 'id'
      AND column_default LIKE 'nextval(%'
  LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE((SELECT MAX(id) FROM %I.%I), 0) + 1, false)',
      format('%I.%I', row.table_schema, row.table_name),
      'id',
      row.table_schema,
      row.table_name
    );
  END LOOP;
END $$;
