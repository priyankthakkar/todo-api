import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";
import { z } from "zod";
import { version } from "process";

const window = new JSDOM("").window;
const purify = DOMPurify(window);

// custom sanitization function
const sanitizeString = (value: string): string => {
  return purify.sanitize(value, { ALLOWED_TAGS: [] }).trim();
};

const PriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

// Base string validators
const titleValidator = z
  .string()
  .min(1, "Title is required")
  .max(100, "Title must be 100 characters or less")
  .transform(sanitizeString);

const descriptionValidator = z
  .string()
  .max(500, "Description must be 500 characters or less")
  .transform(sanitizeString)
  .optional();

const tagValidator = z
  .string()
  .min(1, "Tag cannot be empty")
  .max(30, "Tag must be 30 characters or less")
  .transform(sanitizeString);

const dateValidator = z.string().refine((date) => {
  const d = new Date(date);
  return !isNaN(d.getTime());
}, "Invalid date format");

// Create Todo input validator
export const createTodoSchema = z.object({
  title: titleValidator,
  description: descriptionValidator,
  dueDate: dateValidator.optional(),
  priority: PriorityEnum,
  tags: z.array(tagValidator).max(10, "Maximum 10 tags allowed").default([]),
});

// Update Todo Input Validator
export const updateTodoSchema = z.object({
  id: z.uuid({ error: "Invalid todo ID" }),
  title: titleValidator.optional(),
  description: descriptionValidator,
  dueDate: dateValidator.optional(),
  priority: PriorityEnum.optional(),
  tags: z.array(tagValidator).max(10, "Maximum 10 tags allowed").optional(),
  completed: z.boolean().optional(),
});

// Filter input validator
export const todoFilterSchema = z.object({
  priority: PriorityEnum.optional(),
  completed: z.boolean().optional(),
  startDate: dateValidator.optional(),
  endDate: dateValidator.optional(),
  tags: z.array(tagValidator).optional(),
});

// Query validators
export const getTodoSchema = z.object({
  id: z.uuid("Invalid todo ID"),
});

export const listTodoSchema = z.object({
  filter: todoFilterSchema.optional(),
  limit: z.number().min(1).max(100).default(20),
  nextToken: z.string().optional(),
});

export const batchDeleteSchema = z.object({
  ids: z.array(z.uuid().min(1).max(100)),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type TodoFilter = z.infer<typeof todoFilterSchema>;
