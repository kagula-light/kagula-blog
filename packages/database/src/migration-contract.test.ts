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
});
