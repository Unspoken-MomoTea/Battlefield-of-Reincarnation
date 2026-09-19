import { requireUser } from '../auth.js';

export async function authenticatedUser(request, env) {
  return (await requireUser(request, env)).user;
}
