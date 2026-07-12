import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';
import { analyser, FSProvider, flatten } from '@specfy/stack-analyser';
// @ts-ignore
import '@specfy/stack-analyser/dist/autoload.js';

export interface ScanResult {
  languages: Record<string, number>;
  technologies: string[];
}

const GITHUB_PAT = process.env.GITHUB_PAT || import.meta.env?.GITHUB_PAT || '';

export async function scanRepository(
  owner: string,
  repo: string,
  ref: string,
  token?: string
): Promise<ScanResult> {
  const tempBase = path.join(os.tmpdir(), 'stackscan');
  await fs.mkdir(tempBase, { recursive: true });
  
  const runId = Math.random().toString(36).substring(2, 15);
  const tmpDir = path.join(tempBase, `${owner}-${repo}-${ref}-${runId}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${ref}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'StackScan-App',
    };

    const finalToken = token || GITHUB_PAT;
    if (finalToken) {
      headers.Authorization = `token ${finalToken}`;
    }

    const response = await fetch(tarballUrl, { headers });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Failed to fetch tarball (${response.status}): ${text || response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = Readable.fromWeb(response.body as any);

    await pipeline(
      reader,
      tar.x({ cwd: tmpDir })
    );

    const contents = await fs.readdir(tmpDir);
    if (contents.length === 0) {
      throw new Error('Tarball was empty or extraction failed');
    }

    const repoPath = path.join(tmpDir, contents[0]);

    const result = await analyser({
      provider: new FSProvider({
        path: repoPath,
      }),
    });

    const flat = flatten(result, { merge: true });
    const json = flat.toJson();

    return {
      languages: json.languages || {},
      technologies: Array.from(new Set(json.techs || [])),
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
