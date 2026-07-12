import type { APIRoute } from 'astro';
import { getUserProfile, getUserRepos } from '../../lib/github';
import { scanRepository } from '../../lib/scanner';
import { getCachedRepo, setCachedRepo, setCachedUser } from '../../lib/cache';

export const GET: APIRoute = async ({ request, url, cookies }) => {
  const username = url.searchParams.get('username');
  const includeForks = url.searchParams.get('forks') === 'true';
  const includeArchived = url.searchParams.get('archived') === 'true';
  const maxReposStr = url.searchParams.get('limit');
  const maxRepos = maxReposStr ? parseInt(maxReposStr, 10) : 100;

  const includePrivate = url.searchParams.get('private') === 'true';

  if (!username) {
    return new Response(JSON.stringify({ error: 'Username is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get session token and user details if logged in
  const token = cookies.get('github_token')?.value;
  const githubUserCookie = cookies.get('github_user')?.value;
  
  let isSelf = false;
  if (githubUserCookie && includePrivate) {
    try {
      const sessionUser = JSON.parse(githubUserCookie);
      if (sessionUser?.login?.toLowerCase() === username.toLowerCase()) {
        isSelf = true;
      }
    } catch (_) {}
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        // 1. Fetch user profile
        sendEvent('status', { message: 'Fetching user profile...' });
        const profile = await getUserProfile(username, token);
        
        // 2. Fetch user repositories
        sendEvent('status', { message: `Fetching repositories (isSelf: ${isSelf})...` });
        const repos = await getUserRepos(username, {
          includeForks,
          includeArchived,
          maxRepos,
          isSelf,
        }, token);

        sendEvent('start', {
          profile,
          totalRepos: repos.length,
        });

        if (repos.length === 0) {
          const finalResult = {
            profile,
            languages: {},
            technologies: {},
            repos: [],
          };
          await setCachedUser(username, finalResult);
          sendEvent('done', finalResult);
          controller.close();
          return;
        }

        const scannedRepos: any[] = [];
        let completedCount = 0;

        const CONCURRENCY_LIMIT = 3;
        
        const scanRepo = async (repo: typeof repos[0]) => {
          const cacheKey = repo.updated_at;
          
          try {
            const cached = await getCachedRepo(username, repo.name, cacheKey);
            let languages: Record<string, number> = {};
            let technologies: string[] = [];

            if (cached) {
              languages = cached.languages;
              technologies = cached.technologies;
            } else {
              sendEvent('status', { message: `Scanning ${repo.name}...` });
              const scan = await scanRepository(username, repo.name, repo.default_branch, token);
              languages = scan.languages;
              technologies = scan.technologies;
              
              await setCachedRepo(username, repo.name, cacheKey, {
                languages,
                technologies,
              });
            }

            scannedRepos.push({
              name: repo.name,
              html_url: repo.html_url,
              language: repo.language,
              private: repo.private,
              stargazers_count: repo.stargazers_count,
              updated_at: repo.updated_at,
              languages,
              technologies,
            });

            completedCount++;
            sendEvent('progress', {
              current: completedCount,
              total: repos.length,
              repoName: repo.name,
              languages,
              technologies,
            });
          } catch (err: any) {
            console.error(`Error scanning ${repo.name}:`, err);
            scannedRepos.push({
              name: repo.name,
              html_url: repo.html_url,
              language: repo.language,
              private: repo.private,
              stargazers_count: repo.stargazers_count,
              updated_at: repo.updated_at,
              languages: {},
              technologies: [],
              error: err.message,
            });
            completedCount++;
            sendEvent('progress', {
              current: completedCount,
              total: repos.length,
              repoName: repo.name,
              languages: {},
              technologies: [],
            });
          }
        };

        const executing: Promise<void>[] = [];
        for (const repo of repos) {
          const p = scanRepo(repo);
          executing.push(p);
          if (executing.length >= CONCURRENCY_LIMIT) {
            await Promise.race(executing.map(e => e.catch(() => {})));
          }
        }
        await Promise.all(executing);

        sendEvent('status', { message: 'Aggregating results...' });
        
        const aggregatedTechs: Record<string, number> = {};
        const aggregatedLangs: Record<string, number> = {};

        for (const r of scannedRepos) {
          for (const tech of r.technologies) {
            aggregatedTechs[tech] = (aggregatedTechs[tech] || 0) + 1;
          }
          for (const [lang, bytes] of Object.entries(r.languages)) {
            aggregatedLangs[lang] = (aggregatedLangs[lang] || 0) + (bytes as number);
          }
        }

        const finalResult = {
          profile,
          languages: aggregatedLangs,
          technologies: aggregatedTechs,
          repos: scannedRepos,
          scannedAt: Date.now(),
        };

        await setCachedUser(username, finalResult, {
          private: includePrivate,
          forks: includeForks,
          archived: includeArchived,
          limit: maxRepos,
        });
        sendEvent('done', finalResult);
      } catch (err: any) {
        console.error('SSE Scan Error:', err);
        sendEvent('error', { message: err.message || 'Unknown scanning error' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};
