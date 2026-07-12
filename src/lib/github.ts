export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  public_repos: number;
  html_url: string;
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  default_branch: string;
  fork: boolean;
  private: boolean;
  archived: boolean;
  updated_at: string;
  stargazers_count: number;
  html_url: string;
  language: string | null;
}

const GITHUB_PAT = process.env.GITHUB_PAT || import.meta.env?.GITHUB_PAT || '';

async function fetchGithub<T>(endpoint: string, token?: string): Promise<T> {
  const url = `https://api.github.com${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'StackScan-App',
  };

  const finalToken = token || GITHUB_PAT;
  if (finalToken) {
    headers.Authorization = `token ${finalToken}`;
  }

  const response = await fetch(url, { headers });

  if (response.status === 404) {
    throw new Error('User not found');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`GitHub API error (${response.status}): ${errorText || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function getUserProfile(username: string, token?: string): Promise<GitHubUser> {
  return fetchGithub<GitHubUser>(`/users/${encodeURIComponent(username)}`, token);
}

export async function getUserRepos(
  username: string,
  options: { includeForks?: boolean; includeArchived?: boolean; maxRepos?: number; isSelf?: boolean } = {},
  token?: string
): Promise<GitHubRepo[]> {
  const includeForks = options.includeForks ?? false;
  const includeArchived = options.includeArchived ?? false;
  const maxRepos = options.maxRepos ?? 100;
  const isSelf = options.isSelf ?? false;

  let repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (repos.length < maxRepos) {
    // If token is present and it is self, call '/user/repos' to access private repos
    const endpoint = (isSelf && token)
      ? `/user/repos?per_page=${perPage}&page=${page}&sort=updated&type=owner`
      : `/users/${encodeURIComponent(username)}/repos?per_page=${perPage}&page=${page}&sort=updated`;

    const fetched = await fetchGithub<GitHubRepo[]>(endpoint, token);
    
    if (fetched.length === 0) {
      break;
    }

    const filtered = fetched.filter((repo) => {
      if (!includeForks && repo.fork) return false;
      if (!includeArchived && repo.archived) return false;
      return true;
    });

    repos = repos.concat(filtered);
    page += 1;

    if (fetched.length < perPage) {
      break;
    }
  }

  return repos.slice(0, maxRepos);
}

export function getTarballUrl(owner: string, repo: string, ref: string): string {
  return `https://api.github.com/repos/${owner}/${repo}/tarball/${ref}`;
}
