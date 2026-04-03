import { afterEach } from "bun:test";
import { inArray } from "drizzle-orm";

import { db } from "@recipe-notes-app/db";
import { user } from "@recipe-notes-app/db/schema/auth";

import type { Context } from "../context";

// Track user IDs created during each test. afterEach deletes only these rows,
// leaving any pre-existing data in the database untouched.
const createdUserIds: string[] = [];

afterEach(async () => {
  if (createdUserIds.length === 0) return;
  await db.delete(user).where(inArray(user.id, createdUserIds));
  createdUserIds.length = 0;
});

export async function createTestUser(overrides?: Partial<typeof user.$inferInsert>) {
  const id = crypto.randomUUID();
  const now = new Date();

  const [row] = await db
    .insert(user)
    .values({
      id,
      name: "Test User",
      email: `test-${id}@example.com`,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();

  if (!row) throw new Error("Failed to create test user");
  createdUserIds.push(row.id);
  return row;
}

export function createMockContext(userId: string): Context {
  return {
    auth: null,
    session: {
      user: {
        id: userId,
        name: "Test User",
        email: `test-${userId}@example.com`,
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 86400000),
        token: crypto.randomUUID(),
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      },
    },
  } as unknown as Context;
}
