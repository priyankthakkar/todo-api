export interface Todo {
  id: string;
  title: string;
  description?: string;
  createdDate: string;
  dueDate?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  tags: string[];
  userId: string;
  completed: boolean;
  updatedDate: string;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  dueDate?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  tags?: string[];
}

export interface UpdateTodoInput {
  id: string;
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

export interface AppSyncResolveEvent {
  info: {
    fieldName: string;
    parentTypeName: string;
    variables: any;
  };
  arguments: any;
  identity: {
    sub: string;
    username: string;
    claims: any;
  };
  source: any;
  request: {
    headers: any;
  };
}
