import { describe, expect, it } from "vitest";

import { validatePostActionInput } from "./post-action-state";

const categoryId = "0190f3c2-5710-7aca-b167-8f4b28ad77c1";
const tagId = "0190f3c2-5710-7aca-b167-8f4b28ad77c2";
const postId = "0190f3c2-5710-7aca-b167-8f4b28ad77c3";

function createPostForm(overrides: Readonly<Record<string, string>> = {}): FormData {
  const formData = new FormData();
  formData.set("command", "CREATE_DRAFT");
  formData.set("title", "Content core");
  formData.set("slug", "content-core");
  formData.set("excerpt", "A focused excerpt.");
  formData.set("markdown", "# Content core");
  formData.set("categoryId", categoryId);
  formData.append("tagIds", tagId);
  for (const [name, value] of Object.entries(overrides)) formData.set(name, value);
  return formData;
}

describe("validatePostActionInput", () => {
  it("parses a new draft and repeated tags", () => {
    const formData = createPostForm();
    formData.append("tagIds", "0190f3c2-5710-7aca-b167-8f4b28ad77c4");

    expect(validatePostActionInput(formData)).toMatchObject({
      success: true,
      data: {
        command: "CREATE_DRAFT",
        postId: null,
        expectedVersion: null,
        content: {
          title: "Content core",
          slug: "content-core",
          categoryId,
          tagIds: [tagId, "0190f3c2-5710-7aca-b167-8f4b28ad77c4"],
        },
      },
    });
  });

  it("requires a post identifier and positive version for updates", () => {
    const result = validatePostActionInput(createPostForm({ command: "SAVE" }));

    expect(result).toMatchObject({
      success: false,
      state: { status: "ERROR", fieldErrors: { postId: expect.any(Array) } },
    });
  });

  it("parses a scheduled publication time", () => {
    expect(
      validatePostActionInput(
        createPostForm({
          command: "SCHEDULE",
          postId,
          expectedVersion: "3",
          scheduledFor: "2026-07-15T12:30:00.000Z",
        }),
      ),
    ).toMatchObject({
      success: true,
      data: {
        command: "SCHEDULE",
        postId,
        expectedVersion: 3,
        scheduledFor: new Date("2026-07-15T12:30:00.000Z"),
      },
    });
  });

  it("returns field errors for malformed content", () => {
    const result = validatePostActionInput(
      createPostForm({ title: "", slug: "../bad", markdown: "", categoryId: "bad" }),
    );

    expect(result).toMatchObject({
      success: false,
      state: {
        status: "ERROR",
        fieldErrors: {
          title: expect.any(Array),
          slug: expect.any(Array),
          markdown: expect.any(Array),
          categoryId: expect.any(Array),
        },
      },
    });
  });
});
