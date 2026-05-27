import { MundialErpClient } from './api-client.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export function validateApiKey(client: MundialErpClient): Promise<AuthenticatedUser> {
  return client.get<AuthenticatedUser>('/auth/me');
}

export function listWorkspaces(client: MundialErpClient): Promise<Workspace[]> {
  return client.get<Workspace[]>('/workspaces');
}
