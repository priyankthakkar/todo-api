import { AppSyncResolverEvent, Todo } from "../../shared/types";
import {
  batchDeleteSchema,
  createTodoSchema,
  updateTodoSchema,
} from "../validators/todo-validators";
import { dynamoDB, TABLE_NAME } from "../utils/dynamodb-client";
import {
  BatchWriteCommand,
  DeleteCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const { v4 } = require("uuid");

export async function createTodo(event: AppSyncResolverEvent): Promise<Todo> {
  const userId = event.identity.sub;
  const validated = createTodoSchema.parse(event.arguments.input);

  const now = new Date().toISOString();
  const todo: Todo = {
    id: v4(),
    ...validated,
    userId,
    completed: false,
    createdDate: now,
    updatedDate: now,
    tags: validated.tags || [],
  };

  await dynamoDB.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: todo,
      ConditionExpression: "attribute_not_exists(id)",
    }),
  );

  return todo;
}

export async function updateTodo(event: AppSyncResolverEvent): Promise<Todo> {
  const userId = event.identity.sub;
  const validated = updateTodoSchema.parse(event.arguments.input);

  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  // Build update expression dynamically
  Object.entries(validated).forEach(([key, value]) => {
    if (key !== "id" && value !== undefined) {
      updateExpressions.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    }
  });

  // Alway update the updatedDate
  updateExpressions.push("#updatedDate = :updatedDate");
  expressionAttributeNames[`#updatedDate`] = "updatedDate";
  expressionAttributeValues[`:updatedDate`] = new Date().toISOString();

  // Add userId check
  expressionAttributeValues[":userId"] = userId;

  const response = await dynamoDB.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id: validated.id },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: "attribute_exists(id) AND userId = :userId",
      ReturnValues: "ALL_NEW",
    }),
  );

  return response.Attributes as Todo;
}

export async function deleteTodo(
  event: AppSyncResolverEvent,
): Promise<boolean> {
  const userId = event.identity.sub;
  const { id } = event.arguments;

  await dynamoDB.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { id },
      ConditionExpression: "attribute_exists(id) and userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    }),
  );

  return true;
}

export async function batchDeleteTodos(
  event: AppSyncResolverEvent,
): Promise<number> {
  const userId = event.identity.sub;
  const validated = batchDeleteSchema.parse(event.arguments);

  const deleteRequest = validated.ids.map((id) => ({
    DeleteRequest: {
      Key: { id },
    },
  }));

  // Batch delete in chunks of 25 (DynamoDB limit)
  let deleted = 0;
  for (let i = 0; i < deleteRequest.length; i += 25) {
    const chunk = deleteRequest.slice(i, i + 25);

    await dynamoDB.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: chunk,
        },
      }),
    );

    deleted += chunk.length;
  }

  return deleted;
}
