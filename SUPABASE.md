# Supabase CLI workflow

The Supabase CLI is installed locally as a devDependency
(`npm i -D supabase`). All commands below are executed via
`npx` so the pinned version in `package.json` is always used.

Project ref: **`mkofisdyebcnmhgkpqws`** (extracted from
`EXPO_PUBLIC_SUPABASE_URL`).

## Initial setup (one-time)

1. **Authenticate the CLI.** Opens a browser and asks you to
   paste the access token back into the terminal:

   ```
   npx supabase login
   ```

2. **Link this checkout to the remote project.** The ref
   below is hardcoded; copy this command verbatim:

   ```
   npx supabase link --project-ref mkofisdyebcnmhgkpqws
   ```

3. **Verify the link.** Lists local vs. remote migration
   state. The two pending migrations from G.1 / G.5 should
   show as not applied remotely:

   ```
   npx supabase migration list --linked
   ```

## Apply pending migrations to production

```
npm run db:push
```

Currently pending:

- [supabase/migrations/20260513_geo_columns.sql](supabase/migrations/20260513_geo_columns.sql) (G.1 — geo columns)
- [supabase/migrations/20260514_products_within_radius_rpc.sql](supabase/migrations/20260514_products_within_radius_rpc.sql) (G.5 — radius RPC)

Both are reversible; rollback SQL is inlined at the top of
each migration file.

## Regenerate TypeScript types after any schema change

```
npm run gen:types
```

Output: `src/types/supabase.ts`. Commit this file alongside
the migration that produced it.

## Local Postgres (optional, for offline dev)

Requires Docker Desktop running.

```
npx supabase start         # boots local stack
npm run gen:types:local    # regen types against local DB
npx supabase stop          # tears the stack down
```

## Rollback a migration

The CLI does not auto-rollback applied migrations. For G.1 /
G.5, the rollback SQL is at the top of each migration file —
apply it manually via the Supabase SQL editor, or run it
against the remote DB with `psql`.

## Baselining a project migrated by hand (already done — historical note)

If migrations were applied manually via the SQL editor before
the CLI was introduced, the remote `supabase_migrations.schema_migrations`
table is empty even though the schema is fully in place. The
first `db:push` then errors on `relation "X" already exists`
trying to re-apply migration #1.

Fix: tell the CLI those migrations are already applied,
without re-running their SQL:

```
npx supabase migration repair --status applied <version> [<version> ...]
```

For this project, this was run once on 2026-05-03 with all
14 versions (`20260501` through `20260514`). After repair,
`npm run db:status` shows local/remote in sync and `npm run
db:push` is a clean no-op.

You should not need to repeat this — every migration from now
on goes through `npm run db:push`, which keeps history correct
automatically.

## Other handy scripts

| Script              | Wrapped command                          |
| ------------------- | ---------------------------------------- |
| `npm run db:status` | `supabase migration list --linked`       |
| `npm run db:diff`   | `supabase db diff --linked`              |
| `npm run db:push`   | `supabase db push --linked`              |
| `npm run gen:types` | `supabase gen types typescript --linked` |
