import { describe, expect, it } from "bun:test";

import type { Context } from "../context";
import { appRouter } from "../routers/index";
import { createMockContext, createTestUser } from "./helpers";

// An unauthenticated context — session is null so protectedProcedure will throw UNAUTHORIZED.
const unauthCtx = { auth: null, session: null } as unknown as Context;

// ---------------------------------------------------------------------------
// healthCheck
// ---------------------------------------------------------------------------

describe("healthCheck", () => {
  it("returns OK", async () => {
    const caller = appRouter.createCaller(unauthCtx);
    const result = await caller.healthCheck();
    expect(result).toBe("OK");
  });
});

// ---------------------------------------------------------------------------
// Auth guards — every protected procedure must reject unauthenticated callers
// ---------------------------------------------------------------------------

describe("recipe — auth guard", () => {
  const caller = appRouter.createCaller(unauthCtx);

  it("list throws UNAUTHORIZED when session is null", async () => {
    await expect(caller.recipe.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("get throws UNAUTHORIZED when session is null", async () => {
    await expect(caller.recipe.get({ id: "any" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("create throws UNAUTHORIZED when session is null", async () => {
    await expect(caller.recipe.create({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("update throws UNAUTHORIZED when session is null", async () => {
    await expect(caller.recipe.update({ id: "any" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("delete throws UNAUTHORIZED when session is null", async () => {
    await expect(caller.recipe.delete({ id: "any" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ---------------------------------------------------------------------------
// recipe.list
// ---------------------------------------------------------------------------

describe("recipe.list", () => {
  it("returns empty array for a new user", async () => {
    const testUser = await createTestUser();
    const caller = appRouter.createCaller(createMockContext(testUser.id));
    const result = await caller.recipe.list();
    expect(result).toEqual([]);
  });

  it("returns only the authenticated user's recipes, not other users'", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();

    const callerA = appRouter.createCaller(createMockContext(userA.id));
    const callerB = appRouter.createCaller(createMockContext(userB.id));

    await callerA.recipe.create({ title: "User A Recipe" });
    await callerB.recipe.create({ title: "User B Recipe" });

    const resultA = await callerA.recipe.list();
    expect(resultA).toHaveLength(1);
    expect(resultA[0]?.title).toBe("User A Recipe");
  });

  it("orders by updatedAt descending (most recently updated first)", async () => {
    const testUser = await createTestUser();
    const caller = appRouter.createCaller(createMockContext(testUser.id));

    await caller.recipe.create({ title: "First" });
    // Small delay to ensure distinct updatedAt timestamps.
    await Bun.sleep(10);
    await caller.recipe.create({ title: "Second" });

    const result = await caller.recipe.list();
    expect(result[0]?.title).toBe("Second");
    expect(result[1]?.title).toBe("First");
  });

  it("returned items have id, title, updatedAt but NOT content (list is a summary)", async () => {
    const testUser = await createTestUser();
    const caller = appRouter.createCaller(createMockContext(testUser.id));

    await caller.recipe.create({ title: "Summary Test", content: { text: "secret" } });

    const result = await caller.recipe.list();
    expect(result).toHaveLength(1);
    const item = result[0];
    expect(item).toHaveProperty("id");
    expect(item).toHaveProperty("title");
    expect(item).toHaveProperty("updatedAt");
    expect(item).not.toHaveProperty("content");
  });
});

// ---------------------------------------------------------------------------
// recipe.create
// ---------------------------------------------------------------------------

describe("recipe.create", () => {
  it("creates with default title 'Untitled Recipe' when none provided", async () => {
    const testUser = await createTestUser();
    const caller = appRouter.createCaller(createMockContext(testUser.id));

    const result = await caller.recipe.create({});
    expect(result?.title).toBe("Untitled Recipe");
  });

  it("creates with a custom title", async () => {
    const testUser = await createTestUser();
    const caller = appRouter.createCaller(createMockContext(testUser.id));

    const result = await caller.recipe.create({ title: "My Pasta Recipe" });
    expect(result?.title).toBe("My Pasta Recipe");
  });

  it("creates with custom content and stores it", async () => {
    const testUser = await createTestUser();
    const caller = appRouter.createCaller(createMockContext(testUser.id));

    const content = { type: "doc", content: [{ type: "paragraph", text: "Boil water" }] };
    const result = await caller.recipe.create({ title: "Content Test", content });
    expect(result?.content).toEqual(content);
  });

  it("assigns the recipe to the authenticated user", async () => {
    const testUser = await createTestUser();
    const caller = appRouter.createCaller(createMockContext(testUser.id));

    const result = await caller.recipe.create({ title: "Ownership Test" });
    expect(result?.userId).toBe(testUser.id);
  });

  it("returns a recipe with a UUID id", async () => {
    const testUser = await createTestUser();
    const caller = appRouter.createCaller(createMockContext(testUser.id));

    const result = await caller.recipe.create({});
    expect(result?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});

// ---------------------------------------------------------------------------
// recipe.get
// ---------------------------------------------------------------------------

describe("recipe.get", () => {
  it("returns the full recipe for its owner, including content", async () => {
    const testUser = await createTestUser();
    const caller = appRouter.createCaller(createMockContext(testUser.id));

    const content = { type: "doc", content: [] };
    const created = await caller.recipe.create({ title: "Full Recipe", content });

    const result = await caller.recipe.get({ id: created!.id });
    expect(result?.title).toBe("Full Recipe");
    expect(result?.content).toEqual(content);
  });

  it("returns null for a non-existent id", async () => {
    const testUser = await createTestUser();
    const caller = appRouter.createCaller(createMockContext(testUser.id));

    const result = await caller.recipe.get({ id: crypto.randomUUID() });
    expect(result).toBeNull();
  });

  it("returns null when accessing another user's recipe (SECURITY)", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();

    const callerA = appRouter.createCaller(createMockContext(userA.id));
    const callerB = appRouter.createCaller(createMockContext(userB.id));

    const created = await callerA.recipe.create({ title: "User A Private Recipe" });
    const result = await callerB.recipe.get({ id: created!.id });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// recipe.update
// ---------------------------------------------------------------------------

describe("recipe.update", () => {
  it("updates the title", async () => {
    const testUser = await createTestUser();
    const caller = appRouter.createCaller(createMockContext(testUser.id));

    const created = await caller.recipe.create({ title: "Old Title" });
    const updated = await caller.recipe.update({ id: created!.id, title: "New Title" });
    expect(updated?.title).toBe("New Title");
  });

  it("updates the content", async () => {
    const testUser = await createTestUser();
    const caller = appRouter.createCaller(createMockContext(testUser.id));

    const created = await caller.recipe.create({ title: "Content Update Test" });
    const newContent = { type: "doc", content: [{ type: "paragraph", text: "Updated" }] };
    const updated = await caller.recipe.update({ id: created!.id, content: newContent });
    expect(updated?.content).toEqual(newContent);
  });

  it("throws INTERNAL_SERVER_ERROR when updating another user's recipe (SECURITY)", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();

    const callerA = appRouter.createCaller(createMockContext(userA.id));
    const callerB = appRouter.createCaller(createMockContext(userB.id));

    const created = await callerA.recipe.create({ title: "User A Recipe" });

    // The router throws Error("Recipe not found") which tRPC surfaces as INTERNAL_SERVER_ERROR.
    await expect(
      callerB.recipe.update({ id: created!.id, title: "Hijacked" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("does not set googleDriveFileId when syncToDrive is false", async () => {
    const testUser = await createTestUser();
    const caller = appRouter.createCaller(createMockContext(testUser.id));

    const created = await caller.recipe.create({ title: "No Drive Sync" });
    const updated = await caller.recipe.update({
      id: created!.id,
      title: "Still No Drive Sync",
      syncToDrive: false,
    });
    expect(updated?.googleDriveFileId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// recipe.delete
// ---------------------------------------------------------------------------

describe("recipe.delete", () => {
  it("deletes the recipe (list returns empty after delete)", async () => {
    const testUser = await createTestUser();
    const caller = appRouter.createCaller(createMockContext(testUser.id));

    const created = await caller.recipe.create({ title: "To Be Deleted" });
    await caller.recipe.delete({ id: created!.id });

    const result = await caller.recipe.list();
    expect(result).toHaveLength(0);
  });

  it("returns { success: true }", async () => {
    const testUser = await createTestUser();
    const caller = appRouter.createCaller(createMockContext(testUser.id));

    const created = await caller.recipe.create({ title: "Delete Return Value" });
    const result = await caller.recipe.delete({ id: created!.id });
    expect(result).toEqual({ success: true });
  });

  it("silently ignores deleting another user's recipe (user A's recipe survives)", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();

    const callerA = appRouter.createCaller(createMockContext(userA.id));
    const callerB = appRouter.createCaller(createMockContext(userB.id));

    const created = await callerA.recipe.create({ title: "User A's Recipe" });

    // User B attempts to delete User A's recipe — it should silently no-op.
    await callerB.recipe.delete({ id: created!.id });

    // User A's recipe must still be intact.
    const result = await callerA.recipe.list();
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("User A's Recipe");
  });
});
