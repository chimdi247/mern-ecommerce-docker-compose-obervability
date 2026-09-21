// ============================================================
// Ecommerce DB bootstrap (MongoDB)
// ============================================================
// Runs automatically the FIRST time the mongo container starts
// against an empty data volume (official mongo image behavior for
// /docker-entrypoint-initdb.d -- it runs every *.js file it finds
// there, once, evaluated with mongosh). It will NOT re-run against an
// existing volume -- see docker/README.md to reset it.
//
// MongoDB is schemaless, so there are no "CREATE TABLE" statements --
// Mongoose already creates collections/indexes itself on connect
// (server/src/models/*.ts) unless autoIndex is disabled. This script
// exists to make that explicit and deterministic on first boot (same
// indexes, unique constraints included), and to seed one starter
// Category so the admin product-creation flow isn't blocked on
// creating a category first.
// ============================================================

const dbName = "ecommerce";
const targetDb = db.getSiblingDB(dbName);

// --- users ---------------------------------------------------
targetDb.createCollection("users");
targetDb.users.createIndex({ clerkUserId: 1 }, { unique: true });

// --- categories ------------------------------------------------
targetDb.createCollection("categories");

// --- products --------------------------------------------------
targetDb.createCollection("products");
targetDb.products.createIndex({ category: 1 });
targetDb.products.createIndex({ status: 1 });
targetDb.products.createIndex({ createdBy: 1 });

// --- carts -------------------------------------------------------
targetDb.createCollection("carts");
targetDb.carts.createIndex({ user: 1 }, { unique: true });

// --- wishlists -----------------------------------------------------
targetDb.createCollection("wishlists");
targetDb.wishlists.createIndex({ user: 1 }, { unique: true });

// --- promos --------------------------------------------------------
targetDb.createCollection("promos");
targetDb.promos.createIndex({ code: 1 }, { unique: true });

// --- orders ----------------------------------------------------------
targetDb.createCollection("orders");
targetDb.orders.createIndex({ user: 1, createdAt: -1 });
targetDb.orders.createIndex({ orderStatus: 1, createdAt: -1 });
targetDb.orders.createIndex({ paymentStatus: 1, createdAt: -1 });

// --- banners -----------------------------------------------------------
targetDb.createCollection("banners");

// --- Seed: one starter category so the catalog isn't empty ---------------
targetDb.categories.updateOne(
  { name: "General" },
  {
    $setOnInsert: {
      name: "General",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
  { upsert: true },
);

print("ecommerce DB bootstrap complete: collections/indexes created, starter category seeded.");
