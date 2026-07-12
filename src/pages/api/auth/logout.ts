import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('github_token', { path: '/' });
  cookies.delete('github_user', { path: '/' });
  return redirect('/');
};
