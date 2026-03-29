import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const recipe = pgTable(
  "recipe",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled Recipe"),
    content: jsonb("content").notNull().default({}),
    googleDriveFileId: text("google_drive_file_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("recipe_userId_idx").on(table.userId)],
);

export const recipeRelations = relations(recipe, ({ one }) => ({
  user: one(user, {
    fields: [recipe.userId],
    references: [user.id],
  }),
}));
