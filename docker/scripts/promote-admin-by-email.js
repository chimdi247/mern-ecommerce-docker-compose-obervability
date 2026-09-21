// ============================================================
// Promote a user to admin, by email
// ============================================================
// NOT run automatically (it lives outside docker-entrypoint-initdb.d
// on purpose -- see docker/README.md for why this has to be a manual,
// post-sign-up step for this app). Run it after the target user has
// signed in at least once through the app (which calls POST
// /auth/sync and creates their User document):
//
//   docker compose exec -e TARGET_ADMIN_EMAIL=admin@example.com mongo \
//     mongosh ecommerce /scripts/promote-admin-by-email.js
//
// Defaults to admin@example.com if TARGET_ADMIN_EMAIL isn't set.
// ============================================================

const targetEmail = process.env.TARGET_ADMIN_EMAIL || "admin@example.com";

const result = db.users.updateOne(
  { email: targetEmail },
  { $set: { role: "admin" } },
);

if (result.matchedCount === 0) {
  print(
    `No user found with email "${targetEmail}" yet. They need to sign in ` +
      `through the app at least once first (Clerk sign-up/sign-in, which ` +
      `triggers POST /auth/sync and creates their User document) -- then ` +
      `re-run this script.`,
  );
} else {
  print(`User "${targetEmail}" promoted to role=admin.`);
}
