-- Enable RLS on Prisma's internal migrations table.
-- No permissive policies are added, so anon/authenticated roles have zero access
-- through PostgREST, satisfying the Supabase "RLS Disabled in Public" lint check.
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
