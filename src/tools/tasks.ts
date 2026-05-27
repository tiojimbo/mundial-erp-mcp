import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MundialErpClient } from '../api-client.js';
import { sanitizeErrorForLlm } from '../errors.js';
import {
  formatDate,
  formatDateRelative,
  formatPriority,
  formatStatus,
  formatTaskLine,
  formatUser,
} from '../formatters.js';
import type {
  CommentCreated,
  MyTasksResponse,
  Task,
  TasksByStatusGroup,
  TasksListResponse,
} from '../types/erp.js';

const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 100;

function formatMyTasks(r: MyTasksResponse): string {
  const sections: Array<[string, Task[]]> = [
    ['Atrasadas', r.overdue],
    ['Hoje', r.today],
    ['Próximas', r.upcoming],
    ['Sem data', r.noDate],
    ['Concluídas', r.completed],
  ];
  const lines: string[] = [];
  for (const [title, tasks] of sections) {
    if (tasks.length === 0) continue;
    lines.push(`${title} (${tasks.length}):`);
    for (const t of tasks) lines.push(formatTaskLine(t));
    lines.push('');
  }
  if (lines.length === 0) return 'Você não tem tasks atribuídas no momento.';
  if (r.meta.hasMore) lines.push(`(cap atingido em ${r.meta.cap} tasks — pode haver mais)`);
  return lines.join('\n').trim();
}

function formatTasksList(r: TasksListResponse): string {
  if (r.data.length === 0) return 'Nenhuma task encontrada com esses filtros.';
  const lines = r.data.map(formatTaskLine);
  lines.push(
    `\nMostrando ${r.data.length} de ${r.meta.total} · página ${r.meta.page}${
      r.meta.hasMore ? ' · há mais resultados' : ''
    }`,
  );
  return lines.join('\n');
}

function formatTaskDetail(t: Task): string {
  const lines = [
    `Task: ${t.title}`,
    `ID: ${t.id}`,
    `Status: ${formatStatus(t.status)}`,
    `Prioridade: ${formatPriority(t.priority)}`,
  ];
  if (t.assignees.length > 0) {
    lines.push(`Atribuída a: ${t.assignees.map(formatUser).join(', ')}`);
  }
  if (t.dueDate) lines.push(`Prazo: ${formatDate(t.dueDate)} (${formatDateRelative(t.dueDate)})`);
  if (t.startDate) lines.push(`Início: ${formatDate(t.startDate)}`);
  if (t.completedAt) lines.push(`Concluída em: ${formatDate(t.completedAt)}`);
  if (t.points !== null) lines.push(`Pontos: ${t.points}`);
  if (t.customType) lines.push(`Tipo: ${t.customType.value}`);
  if (t.description) lines.push(`\nDescrição:\n${t.description}`);
  return lines.join('\n');
}

function formatCreatedTask(t: Task): string {
  return [
    `Task criada: ${t.title}`,
    `ID: ${t.id}`,
    `List: ${t.listId}`,
    `Status: ${formatStatus(t.status)}`,
    `Prioridade: ${formatPriority(t.priority)}`,
  ].join('\n');
}

function formatGrouped(groups: TasksByStatusGroup[]): string {
  const lines: string[] = [];
  for (const g of groups) {
    lines.push(`${g.group.name} (${g.tasks.length}):`);
    if (g.tasks.length === 0) {
      lines.push('  (vazio)');
    } else {
      for (const t of g.tasks) lines.push(`  ${formatTaskLine(t).slice(2)}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

export function registerTaskReadTools(server: McpServer, client: MundialErpClient): void {
  server.tool(
    'erp_my_tasks',
    "Lists tasks assigned to the current user, bucketed by temporal context (overdue, today, upcoming, no date, completed). Use when the user asks 'my tasks', 'what I have today', 'what's overdue'.",
    {},
    async () => {
      try {
        const r = await client.getRaw<MyTasksResponse>('/tasks/my-tasks');
        return { content: [{ type: 'text', text: formatMyTasks(r) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );

  server.tool(
    'erp_tasks_list',
    "Lists tasks across the workspace with filters. Filters: listId, statusId, assigneeId, dueDateFrom/dueDateTo (ISO date). Paginated (default 20, max 100). Use for searches like 'tasks of João', 'tasks due this week in list X'.",
    {
      listId: z.string().optional(),
      statusId: z.string().optional(),
      assigneeId: z.string().optional(),
      dueDateFrom: z.string().optional(),
      dueDateTo: z.string().optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(LIMIT_MAX).default(LIMIT_DEFAULT),
    },
    async (args) => {
      try {
        const r = await client.getRaw<TasksListResponse>('/tasks', args);
        return { content: [{ type: 'text', text: formatTasksList(r) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );

  server.tool(
    'erp_task_get',
    'Fetches one task by ID with full detail (status, assignees, dates, points, type, description).',
    { taskId: z.string() },
    async ({ taskId }) => {
      try {
        const t = await client.get<Task>(`/tasks/${taskId}`);
        return { content: [{ type: 'text', text: formatTaskDetail(t) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );

  server.tool(
    'erp_list_tasks',
    'Lists tasks grouped by status inside a list/folder/space/view. Either provide viewId, OR provide level=(list|folder|space) plus the matching id.',
    {
      viewId: z.string().optional(),
      level: z.enum(['list', 'folder', 'space']).optional(),
      listId: z.string().optional(),
      folderId: z.string().optional(),
      spaceId: z.string().optional(),
    },
    async (args) => {
      try {
        const groups = await client.get<TasksByStatusGroup[]>('/tasks/list', args);
        return { content: [{ type: 'text', text: formatGrouped(groups) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );
}

export function registerTaskWriteTools(server: McpServer, client: MundialErpClient): void {
  server.tool(
    'erp_task_create',
    'Creates a new task in a list. Required: title (3-255 chars) and listId. Optional: description, statusId, priority (LOW/NORMAL/HIGH/URGENT), dueDate (ISO), assigneeIds[], customTypeId.',
    {
      title: z.string().min(3).max(255),
      listId: z.string(),
      description: z.string().max(5000).optional(),
      statusId: z.string().optional(),
      priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
      dueDate: z.string().optional(),
      assigneeIds: z.array(z.string()).max(50).optional(),
      customTypeId: z.string().optional(),
    },
    async (args) => {
      try {
        const t = await client.post<Task>('/tasks', args);
        return { content: [{ type: 'text', text: formatCreatedTask(t) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );

  server.tool(
    'erp_task_update_status',
    'Moves a task to a different status. Only changes statusId, nothing else. Use erp_status_list to discover valid statusIds for the list.',
    { taskId: z.string(), statusId: z.string() },
    async ({ taskId, statusId }) => {
      try {
        const t = await client.put<Task>(`/tasks/${taskId}`, { statusId });
        return {
          content: [{ type: 'text', text: `Status alterado para: ${formatStatus(t.status)}` }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );

  server.tool(
    'erp_task_assign',
    'Replaces the full list of assignees on a task. Pass empty array to clear (backend will re-add the creator).',
    { taskId: z.string(), userIds: z.array(z.string()).max(50) },
    async ({ taskId, userIds }) => {
      try {
        await client.put(`/tasks/${taskId}/assign`, {
          assignees: userIds.map((userId) => ({ userId })),
        });
        const count = userIds.length;
        return {
          content: [
            {
              type: 'text',
              text: `Assignees atualizados (${count} pessoa${count === 1 ? '' : 's'}).`,
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );

  server.tool(
    'erp_comment_create',
    'Adds a comment to a task. Content is plain text (max 10k chars). Optional: parentId for thread reply, assigneeId to also assign the task.',
    {
      taskId: z.string(),
      content: z.string().min(1).max(10000),
      parentId: z.string().optional(),
      assigneeId: z.string().optional(),
    },
    async (args) => {
      try {
        const c = await client.post<CommentCreated>('/comments', args);
        return { content: [{ type: 'text', text: `Comentário adicionado (id: ${c.id}).` }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );
}
