import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core"; // Added 'timestamp', removed 'boolean' as it's not used
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  // Note: The 'username' and 'password' fields suggest a custom authentication system.
  // However, AuthDialog.tsx uses Supabase for authentication (email/password & Google).
  // If Supabase is the primary auth, this 'users' table should ideally store a reference
  // to the Supabase user ID (UUID) and might not need to store passwords.
  // For this task, we'll assume this table structure is fixed and 'users.id' (serial)
  // is used for linking user-specific data like Notion secrets.
  // A record in this table is assumed to be created/managed in conjunction with Supabase auth.
  username: text("username").notNull().unique(), // This might correspond to the email used in Supabase.
  password: text("password").notNull(), // Storing passwords here alongside Supabase auth needs careful consideration.
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// New table for storing user-specific Notion secrets
export const userNotionSecrets = pgTable("user_notion_secrets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Foreign key to users.id
  notionApiKey: text("notion_api_key").notNull(), // Important: Consider encryption for this field in a production environment.
  notionDbId: text("notion_db_id").notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(), // Should be updated manually on record changes by application logic
});

// Schema for inserting new Notion secrets
export const insertUserNotionSecretSchema = createInsertSchema(userNotionSecrets, {
  userId: z.number().int().positive("User ID must be a positive integer."),
  notionApiKey: z.string().min(1, "Notion API Key cannot be empty."),
  notionDbId: z.string().min(1, "Notion DB ID cannot be empty."),
  // id, createdAt, updatedAt are typically handled by the database or ORM defaults on insert.
}).pick({
  userId: true,
  notionApiKey: true,
  notionDbId: true,
});

export type InsertUserNotionSecret = z.infer<typeof insertUserNotionSecretSchema>;
export type UserNotionSecret = typeof userNotionSecrets.$inferSelect; // For selecting/reading secrets
