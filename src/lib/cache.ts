import * as fs from 'fs/promises';
import * as path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'scans.json');
const TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

interface CachedUser {
  profile: any;
  scannedAt: number;
}

interface CachedRepo {
  languages: Record<string, number>;
  technologies: string[];
  scannedAt: number;
}

interface CacheSchema {
  users: Record<string, CachedUser>;
  repos: Record<string, CachedRepo>;
}

// Read from disk every time to ensure process-safety (Vite / Astro dev server isolation)
async function getCache(): Promise<CacheSchema> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return { users: {}, repos: {} };
  }
}

// Atomic write to prevent file corruption
async function saveCache(cache: CacheSchema): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const tempFile = `${CACHE_FILE}.${Math.random().toString(36).substring(2)}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(cache, null, 2), 'utf-8');
  await fs.rename(tempFile, CACHE_FILE);
}

export interface CacheOptions {
  private?: boolean;
  forks?: boolean;
  archived?: boolean;
  limit?: number;
}

function getUserCacheKey(username: string, options?: CacheOptions): string {
  const lower = username.toLowerCase();
  if (!options) return lower;
  const privateStr = options.private ? 'true' : 'false';
  const forksStr = options.forks ? 'true' : 'false';
  const archivedStr = options.archived ? 'true' : 'false';
  const limitVal = options.limit || 100;
  return `${lower}?private=${privateStr}&forks=${forksStr}&archived=${archivedStr}&limit=${limitVal}`;
}

export async function getCachedUser(username: string, options?: CacheOptions): Promise<any | null> {
  const cache = await getCache();
  const key = getUserCacheKey(username, options);
  const cached = cache.users[key];
  if (!cached) {
    console.log(`[Cache] Miss for user key: ${key}`);
    return null;
  }
  
  if (Date.now() - cached.scannedAt > TTL) {
    console.log(`[Cache] Expired for user key: ${key}`);
    delete cache.users[key];
    await saveCache(cache);
    return null;
  }
  
  console.log(`[Cache] Hit for user key: ${key}`);
  return cached.profile;
}

export async function setCachedUser(username: string, profile: any, options?: CacheOptions): Promise<void> {
  const cache = await getCache();
  const key = getUserCacheKey(username, options);
  cache.users[key] = {
    profile,
    scannedAt: Date.now(),
  };
  console.log(`[Cache] Set user key: ${key}`);
  await saveCache(cache);
}

export async function getCachedRepo(
  username: string,
  repo: string,
  commitSHA: string
): Promise<CachedRepo | null> {
  const cache = await getCache();
  const key = `${username.toLowerCase()}/${repo.toLowerCase()}:${commitSHA}`;
  const cached = cache.repos[key];
  if (!cached) return null;
  return cached;
}

export async function setCachedRepo(
  username: string,
  repo: string,
  commitSHA: string,
  data: Omit<CachedRepo, 'scannedAt'>
): Promise<void> {
  const cache = await getCache();
  const key = `${username.toLowerCase()}/${repo.toLowerCase()}:${commitSHA}`;
  cache.repos[key] = {
    ...data,
    scannedAt: Date.now(),
  };
  await saveCache(cache);
}

export async function clearCache(): Promise<void> {
  const cache = { users: {}, repos: {} };
  await saveCache(cache);
}
