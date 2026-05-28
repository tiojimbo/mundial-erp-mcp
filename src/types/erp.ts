export interface TaskStatus {
  id: string;
  name: string;
  type: string;
  color: string;
}

export interface TaskAssignee {
  id?: string;
  userId?: string;
  name?: string;
  email?: string;
}

export interface TaskCustomType {
  id: string;
  value: string;
  pluralName?: string;
  icon?: string | null;
  color?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus | null;
  itemType: string;
  priority: string;
  assignees: TaskAssignee[];
  creatorId: string | null;
  parentId: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  closedAt: string | null;
  estimatedMinutes: number | null;
  trackedMinutes: number;
  timeSpentSeconds: number;
  points: number | null;
  customType: TaskCustomType | null;
  listId: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface TasksListResponse {
  data: Task[];
  meta: PaginationMeta;
}

export interface MyTasksResponse {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  noDate: Task[];
  completed: Task[];
  meta: { hasMore: boolean; cap: number; tz: string };
}

export interface TasksByStatusGroup {
  group: {
    id: string;
    name: string;
    label: string;
    type: string;
    color: string;
  };
  tasks: Task[];
}

export interface Status {
  id: string;
  name: string;
  type: string;
  color: string;
  position: number;
}

export interface SpaceList {
  id: string;
  name: string;
  position: number;
}

export interface SpaceFolder {
  id: string;
  name: string;
  position: number;
  lists: SpaceList[];
}

export interface Space {
  id: string;
  name: string;
  description: string | null;
  position: number;
  visibility: string;
  icon: string | null;
  folders: SpaceFolder[];
  statuses: Status[];
}

export interface ListDetail {
  id: string;
  name: string;
  slug: string;
  spaceId: string;
  folderId: string | null;
  description: string | null;
  processType: string;
  isPrivate: boolean;
  statusInheritance: string;
  statuses: Status[];
  defaultTaskType: { id: string; value: string; pluralName?: string } | null;
}

export interface TaskType {
  id: string;
  value: string;
  pluralName: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isBuiltin: boolean;
  spaceId: string;
  creator?: { id: string; name: string; email: string };
}

export interface CustomFieldDefinition {
  id: string;
  name: string;
  type: string;
  required: boolean;
  description?: string | null;
  options?: unknown;
  scope: string;
  scopeId: string | null;
}

export interface GroupedCustomFields {
  workspace: CustomFieldDefinition[];
  space: CustomFieldDefinition[];
  folder: CustomFieldDefinition[];
  list: CustomFieldDefinition[];
  taskType: CustomFieldDefinition[];
}

export interface CommentCreated {
  id: string;
  taskId: string;
  content: string;
  authorId: string;
  createdAt: string;
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string | null;
  type: string;
  createdAt: string;
  _count: { members: number };
}

export interface ChatMessage {
  id: string;
  channelId: string;
  author: { id: string; name: string; email: string | null };
  content: string;
  type: string;
  parentMessageId: string | null;
  replyCount: number;
  resolved: boolean;
  createdAt: string;
  editedAt: string | null;
}

export interface MessagesListResponse {
  data: ChatMessage[];
  meta: { cursor: { next: string | null; hasMore: boolean } };
}

export interface Automation {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  scopeType: string;
  scopeId: string;
  isActive: boolean;
  actions?: Array<{ type: string }>;
  createdAt: string;
}

export interface ChatMessageCreated {
  id: string;
  channelId: string;
  content: string;
  type: string;
  createdAt: string;
}

export interface ErpUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
}

export interface UsersListResponse {
  data: ErpUser[];
  meta: { pagination: { page: number; limit: number; total: number; totalPages: number } };
}
