import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["ADMIN", "USER"]);
export const userStatus = pgEnum("user_status", ["ACTIVE", "MUTED", "BANNED"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: varchar("username", { length: 32 }).notNull(),
    normalizedUsername: varchar("normalized_username", { length: 32 }).notNull(),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    email: varchar("email", { length: 320 }),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: "date" }),
    role: userRole("role").default("USER").notNull(),
    status: userStatus("status").default("ACTIVE").notNull(),
    biography: text("biography"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("users_normalized_username_unique").on(table.normalizedUsername),
    uniqueIndex("users_email_unique").on(table.email),
  ],
);

export const credentials = pgTable("credentials", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  passwordUpdatedAt: timestamp("password_updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenDigest: varchar("token_digest", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sessions_user_revoked_idx").on(table.userId, table.revokedAt),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);
