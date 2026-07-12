import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const clientId = process.env.GITHUB_CLIENT_ID || import.meta.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI || import.meta.env.GITHUB_REDIRECT_URI;

  if (!clientId) {
    return new Response(JSON.stringify({ error: 'GITHUB_CLIENT_ID is not configured on the server.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const redirectTo = url.searchParams.get('redirect');
  if (redirectTo) {
    cookies.set('auth_redirect', redirectTo, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 300,
    });
  }

  // Always request 'repo' scope to scan both public and private repos,
  // and 'user:follow' to follow SrivarsanK.
  const scope = 'repo,user:follow';

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scope,
  });

  if (redirectUri) {
    params.set('redirect_uri', redirectUri);
  }

  const githubAuthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  return redirect(githubAuthUrl);
};
