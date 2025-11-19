import { AppSyncResolverEvent } from "../shared/types";
import {
  batchDeleteTodos,
  createTodo,
  deleteTodo,
  updateTodo,
} from "./resolvers/mutations";
import { getTodo, getUserTodos, listTodos } from "./resolvers/queries";

const resolvers: Record<string, any> = {
  //Mutations
  createTodo,
  updateTodo,
  deleteTodo,
  batchDeleteTodos,

  // Queries
  getTodo,
  listTodos,
  getUserTodos,
};

export async function handler(event: AppSyncResolverEvent): Promise<any> {
  console.log(`Received event: ${JSON.stringify(event, null, 2)}`);

  const resolver = resolvers[event.info.fieldName];

  if (!resolver) {
    throw new Error(`Resolver not found for field: ${event.info.fieldName}`);
  }

  try {
    return await resolver(event);
  } catch (error: any) {
    console.error(`Error in resolver ${event.info.fieldName}: `, error);

    // Handle validation errors
    if (error.name === "ZodError") {
      const validationErrors = error.errors.map((e: any) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      throw new Error(`Validation failed: ${JSON.stringify(validationErrors)}`);
    }

    throw error;
  }
}
