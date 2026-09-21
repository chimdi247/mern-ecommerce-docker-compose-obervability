# docker/

Supporting files for `docker compose up`, referenced from the root
`docker-compose.yml`.

## Important: this app can't have a local admin@example.com/password123 login

You asked for a script that creates a `admin@example.com` / `password123`
login so you can sign in once the stack is up. That isn't possible for
**this specific app**, and it's worth explaining why rather than faking
something that looks like it works but doesn't:

Authentication here is entirely delegated to **Clerk**
(`@clerk/express` on the backend, `@clerk/react` on the frontend) --
a hosted identity provider. Looking at the code:

- `server/src/models/User.ts` has no `password` field at all -- only a
  `clerkUserId` that references an identity Clerk owns.
- `server/src/middleware/auth.ts` and `routes/auth/auth.routes.ts`
  verify session tokens issued by Clerk (`getAuth(req)`); nothing in
  this codebase checks a password against a hash.
- The sign-in/sign-up UI is Clerk's own hosted React components --
  they won't even render without a real `VITE_CLERK_PUBLISHABLE_KEY`.

So there's no local credentials table a SQL/Mongo script could seed
that this app would actually check at login time -- the login flow is
mediated entirely by Clerk's own frontend SDK and cloud service, not
by a query against this database. A MongoDB document with a hashed
password would just be dead data no code path reads.

### What to do instead

1. **Get free Clerk API keys**: sign up at
   [clerk.com](https://clerk.com) (they have a generous free tier),
   create an application, and copy its Publishable key and Secret key
   into `.env`:
   ```
   CLERK_PUBLISHABLE_KEY=...
   CLERK_SECRET_KEY=...
   VITE_CLERK_PUBLISHABLE_KEY=...   # same publishable key
   ```
   This step can't be automated from here -- it needs a real account.
2. **Sign up through the running app** at http://localhost:3000 using
   `admin@example.com` (or whatever email you want as the admin).
3. You're auto-promoted to `role: "admin"` on that first sign-in,
   **without needing any script**: `.env` already sets
   `ADMIN_EMAILS=admin@example.com`, and `POST /auth/sync`
   (`server/src/routes/auth/auth.routes.ts`), which runs automatically
   on every sign-in, checks the signed-in user's email against that
   list and sets their role to `admin` if it matches. Add more emails
   there (comma-separated) for additional admins.

If you ever need to promote a *different* already-signed-up email to
admin after the fact, see `docker/scripts/promote-admin-by-email.js`
below.

## init-db/

Mounted into the `mongo` container's `/docker-entrypoint-initdb.d`.
The official mongo image runs every `*.js` file it finds there, in
alphabetical order, **once** -- only the first time the container
starts against an empty data volume.

`01-init-indexes-and-seed.js` explicitly creates every collection and
index Mongoose's schemas declare (`server/src/models/*.ts`) -- the
same ones Mongoose would create on its own via `autoIndex` on first
connect, made explicit and deterministic here as requested -- plus
seeds one starter "General" category so the admin product-creation
flow isn't blocked on creating a category first.

## scripts/

Mounted into the `mongo` container at `/scripts` (a different path
from `init-db/`, deliberately, so it does *not* auto-run on boot).

`promote-admin-by-email.js` promotes an existing user (one who's
already signed in at least once, per the steps above) to
`role: "admin"`, for when you need to do that outside the
`ADMIN_EMAILS` auto-promotion flow:

```bash
docker compose exec -e TARGET_ADMIN_EMAIL=someone@example.com mongo \
  mongosh ecommerce /scripts/promote-admin-by-email.js
```

## Resetting the database

`init-db/` scripts only run once. If you've already started the stack
before (so the `mongo` volume already exists), editing them won't do
anything until you drop that volume:

```bash
docker compose down -v   # -v also removes named volumes, including the database
docker compose up --build
```
