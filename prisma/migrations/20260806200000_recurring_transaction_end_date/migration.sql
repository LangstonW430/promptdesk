-- An end date for recurring transactions.
--
-- A recurring transaction is a standing charge: entered once, it counts in
-- every period from `occurred_at` onward rather than being re-entered each
-- month. That model needs a way to stop one.
--
-- Without this column the only ways to end a recurrence are deleting the row or
-- clearing `is_recurring`, and both rewrite history — the charge disappears
-- from the months it genuinely applied to. `recurrence_ended_at` stops it going
-- forward while leaving those months intact.
--
-- NULL means still running, which is the correct reading of every existing row.

ALTER TABLE "transactions"
  ADD COLUMN "recurrence_ended_at" DATE;
