import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { AppSyncResolverEvent, Todo } from "../../shared/types";
import { dynamoDB, TABLE_NAME } from "../utils/dynamodb-client";
import { getTodoSchema, listTodoSchema } from "../validators/todo-validators";
import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

export async function getTodo(
  event: AppSyncResolverEvent,
): Promise<Todo | null> {
  const validated = getTodoSchema.parse(event.arguments);
  const userId = event.identity.sub;

  const response = await dynamoDB.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: validated.id },
    }),
  );

  const todo = (response.Item as Todo) || undefined;

  // Check if todo exists and belongs to user
  if (!todo || todo.userId !== userId) {
    return null;
  }

  return todo;
}

export async function listTodos(event: AppSyncResolverEvent): Promise<any> {
  const validated = listTodoSchema.parse(event.arguments);
  const userId = event.identity.sub;

  const filterExpressions: string[] = ["userId = :userId"];
  const expressionAttributeValues: Record<string, any> = {
    ":userId": userId,
  };

  // Apply filters
  if (validated.filter) {
    if (validated.filter.priority) {
      filterExpressions.push("priority = :priority");
      expressionAttributeValues[":priority"] = validated.filter.priority;
    }

    if (validated.filter.completed !== undefined) {
      filterExpressions.push("completed = :completed");
      expressionAttributeValues[":completed"] = validated.filter.completed;
    }

    if (validated.filter.startDate !== undefined) {
      filterExpressions.push("dueDate >= :startDate");
      expressionAttributeValues[":startDate"] = validated.filter.startDate;
    }

    if (validated.filter.endDate !== undefined) {
      filterExpressions.push("dueDate <= :endDate");
      expressionAttributeValues[":endDate"] = validated.filter.endDate;
    }
  }

  const response = await dynamoDB.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: filterExpressions.join("AND"),
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: validated.limit,
      ExclusiveStartKey: validated.nextToken
        ? JSON.parse(Buffer.from(validated.nextToken, "base64").toString())
        : undefined,
    }),
  );

  return {
    items: response.Items || [],
    nextToken: response.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString(
          "base64",
        )
      : null,
    total: response.Count || 0,
  };
}

export async function getUserTodos(
  event: AppSyncResolverEvent,
): Promise<Todo[]> {
  const userId = event.arguments.userId || event.identity.sub;

  const response = await dynamoDB.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "UserIdIndex",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    }),
  );

  // Fixed: Proper handling of undefined and type asssertion
  if (!response.Items || response.Items.length === 0) {
    return [];
  }

  const todos = response.Items.map((item) => unmarshall(item) as Todo);
  return todos;
}
