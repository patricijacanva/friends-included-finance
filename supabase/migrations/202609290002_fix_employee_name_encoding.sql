-- Repair display names that were pasted into the Supabase SQL editor with the wrong encoding.
-- This uses PostgreSQL Unicode escapes, so the script itself contains ASCII only.

update public.employees
set display_name = U&'Jean-Claude B\0113rzi\0146\0161'
where code = 'jean_claude';

update public.employees
set display_name = U&'Richard \201CCall Me Dick\201D Darling'
where code = 'richard';
