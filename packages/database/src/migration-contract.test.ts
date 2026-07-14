import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("content migration contract", () => {
  it("prevents post revisions from being updated in place", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../drizzle/0002_content_core.sql"),
      "utf8",
    );

    expect(migration).toContain("prevent_post_revision_update");
    expect(migration).toContain('BEFORE UPDATE ON "post_revisions"');
  });

  it("creates the category slug unique index before seeding the default category", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../drizzle/0002_content_core.sql"),
      "utf8",
    );

    expect(migration.indexOf('CREATE UNIQUE INDEX "categories_slug_unique"')).toBeGreaterThan(-1);
    expect(migration.indexOf('CREATE UNIQUE INDEX "categories_slug_unique"')).toBeLessThan(
      migration.indexOf('INSERT INTO "categories"'),
    );
  });
});
