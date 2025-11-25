import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Todo } from "../shared/types";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-southeast-2",
});
const dynamoDb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || "TodoTable";

interface ReportEvent {
  identity: {
    sub: string;
  };
  arguments: {
    startDate?: string;
    endDate?: string;
  };
}

export async function handled(event: ReportEvent): Promise<any> {
  console.log(`Generating report: ${JSON.stringify(event, null, 2)}`);
  const userId = event.identity.sub;
  const { startDate, endDate } = event.arguments;

  // Fetch all todos for the user
  const response = await dynamoDb.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    }),
  );

  const todos = (response.Items || []) as Todo[];

  // filter todos
  let filterdTodos = todos;
  if (startDate || endDate) {
    filterdTodos = todos.filter((todo) => {
      if (startDate && todo.createdDate < startDate) {
        return false;
      }

      if (endDate && todo.createdDate > endDate) {
        return false;
      }

      return true;
    });
  }

  // Report Generation
  const now = new Date();
  const totalTodos = filterdTodos.length;
  const completedTodos = filterdTodos.filter((todo) => todo.completed).length;
  const pendingTodos = filterdTodos.length - completedTodos;

  // Priority Breakdown
  const byPriority = {
    low: filterdTodos.filter((todo) => todo.priority === "LOW").length,
    medium: filterdTodos.filter((todo) => todo.priority === "MEDIUM").length,
    high: filterdTodos.filter((todo) => todo.priority === "HIGH").length,
    urgent: filterdTodos.filter((todo) => todo.priority === "URGENT").length,
  };

  // Upcoming 7 days from now
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const upcomingTodos = filterdTodos
    .filter(
      (todo) =>
        !todo.completed &&
        todo.dueDate &&
        new Date(todo.dueDate) <= sevenDaysFromNow,
    )
    .sort(
      (a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime(),
    )
    .slice(0, 10);

  // Overdue todos
  const overdueTodos = filterdTodos
    .filter(
      (todo) =>
        !todo.completed && todo.dueDate && new Date(todo.dueDate) <= now,
    )
    .sort(
      (a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime(),
    );

  return {
    totalTodos,
    completedTodos,
    pendingTodos,
    byPriority,
    upcomingTodos,
    overdueTodos,
  };
}
