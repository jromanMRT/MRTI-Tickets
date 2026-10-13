export const ticketKeys = {
  all: ['tickets'] as const,
  lists: () => [...ticketKeys.all, 'list'] as const,
  list: (params: string) => [...ticketKeys.lists(), params] as const,
  details: () => [...ticketKeys.all, 'detail'] as const,
  detail: (id: string) => [...ticketKeys.details(), id] as const,
  workflow: (id: string) => [...ticketKeys.all, 'workflow', id] as const,
  comments: (id: string) => [...ticketKeys.all, 'comments', id] as const,
  attachments: (id: string) => [...ticketKeys.all, 'attachments', id] as const,
  history: (id: string) => [...ticketKeys.all, 'history', id] as const,
  sla: (id: string) => [...ticketKeys.all, 'sla', id] as const,
  context: () => [...ticketKeys.all, 'context'] as const,
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
};

export const catalogKeys = {
  statuses: () => ['statuses'] as const,
  priorities: () => ['priorities'] as const,
  businessAreas: () => ['business-areas'] as const,
  categories: () => ['categories'] as const,
  subcategories: () => ['subcategories'] as const,
  assignees: (areaId?: number) => ['assignees', areaId] as const,
};

export const kbKeys = {
  all: ['kb-articles'] as const,
  lists: () => [...kbKeys.all, 'list'] as const,
  list: (params: string) => [...kbKeys.lists(), params] as const,
  detail: (id: number) => [...kbKeys.all, 'detail', id] as const,
  suggestions: (params: string) => [...kbKeys.all, 'suggestions', params] as const,
};

export const slaKeys = {
  all: ['sla-policies'] as const,
  list: () => [...slaKeys.all, 'list'] as const,
};
