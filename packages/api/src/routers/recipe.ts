import { db } from "@recipe-notes-app/db";
import { account } from "@recipe-notes-app/db/schema/auth";
import { recipe } from "@recipe-notes-app/db/schema/recipe";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { generateRecipePdf, uploadToDrive } from "../lib/google-drive";

function generateId() {
  return crypto.randomUUID();
}

export const recipeRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return db
      .select({
        id: recipe.id,
        title: recipe.title,
        createdAt: recipe.createdAt,
        updatedAt: recipe.updatedAt,
      })
      .from(recipe)
      .where(eq(recipe.userId, userId))
      .orderBy(desc(recipe.updatedAt));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [row] = await db
        .select()
        .from(recipe)
        .where(and(eq(recipe.id, input.id), eq(recipe.userId, userId)))
        .limit(1);
      return row ?? null;
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().default("Untitled Recipe"),
        content: z.any().default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const id = generateId();
      const [row] = await db
        .insert(recipe)
        .values({ id, userId, title: input.title, content: input.content })
        .returning();
      return row;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.any().optional(),
        syncToDrive: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const updates: Partial<typeof recipe.$inferInsert> = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.content !== undefined) updates.content = input.content;

      // Fetch current record to get existing driveFileId
      const [current] = await db
        .select()
        .from(recipe)
        .where(and(eq(recipe.id, input.id), eq(recipe.userId, userId)))
        .limit(1);

      if (!current) throw new Error("Recipe not found");

      // Google Drive sync
      if (input.syncToDrive) {
        const googleAccount = await db
          .select()
          .from(account)
          .where(
            and(eq(account.userId, userId), eq(account.providerId, "google")),
          )
          .limit(1);

        if (googleAccount[0]?.accessToken && googleAccount[0]?.refreshToken) {
          const title = input.title ?? current.title;
          const content = (input.content ?? current.content) as Parameters<
            typeof generateRecipePdf
          >[1];
          const pdfBuffer = await generateRecipePdf(title, content);
          const driveFileId = await uploadToDrive(
            googleAccount[0].accessToken,
            googleAccount[0].refreshToken,
            title,
            pdfBuffer,
            current.googleDriveFileId,
          );
          updates.googleDriveFileId = driveFileId;
        }
      }

      const [updated] = await db
        .update(recipe)
        .set(updates)
        .where(and(eq(recipe.id, input.id), eq(recipe.userId, userId)))
        .returning();

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db
        .delete(recipe)
        .where(and(eq(recipe.id, input.id), eq(recipe.userId, userId)));
      return { success: true };
    }),
});
