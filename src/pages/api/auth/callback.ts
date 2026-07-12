import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  if (!code) {
    return new Response(JSON.stringify({ error: 'Authorization code is missing' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const clientId = process.env.GITHUB_CLIENT_ID || import.meta.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || import.meta.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_REDIRECT_URI || import.meta.env.GITHUB_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'OAuth credentials not configured on server.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
    }

    const data = await tokenResponse.json() as any;
    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
    }

    const accessToken = data.access_token;
    if (!accessToken) {
      throw new Error('No access token returned');
    }

    // Set token cookie
    cookies.set('github_token', accessToken, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Fetch user details to display in navbar
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${accessToken}`,
        'User-Agent': 'StackScan-App',
      },
    });

    if (userResponse.ok) {
      const user = await userResponse.json() as any;
      
      // Determine if token has 'repo' scope for private repo access
      const scopesHeader = userResponse.headers.get('x-oauth-scopes') || '';
      const scopes = scopesHeader.split(',').map(s => s.trim().toLowerCase());
      const hasPrivateScope = scopes.includes('repo');

      const cachedProfile = {
        login: user.login,
        avatar_url: user.avatar_url,
        hasPrivateScope,
      };
      
      cookies.set('github_user', JSON.stringify(cachedProfile), {
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    // Automate follow action: PUT /user/following/SrivarsanK
    try {
      await fetch('https://api.github.com/user/following/SrivarsanK', {
        method: 'PUT',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${accessToken}`,
          'User-Agent': 'StackScan-App',
          'Content-Length': '0',
        },
      });
      console.log('Automatically followed SrivarsanK successfully.');
    } catch (followErr) {
      console.error('Failed to auto-follow SrivarsanK:', followErr);
      // Non-blocking, continue with authentication flow
    }

    // Check for post-auth redirect url cookie
    const redirectTo = cookies.get('auth_redirect')?.value;
    if (redirectTo) {
      cookies.delete('auth_redirect', { path: '/' });
      return redirect(redirectTo);
    }

    return redirect('/');
  } catch (err: any) {
    console.error('OAuth Callback Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal authentication error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
