# PRD: StackScan — GitHub Profile Tech Stack Scanner

## 1. Overview

**Product name (working title):** StackScan

**One-liner:** A web app where you enter a GitHub username and get back a breakdown of every framework, library, and language used across all their public repositories.

**Problem statement:** Recruiters, engineers evaluating collaborators, and developers auditing their own portfolios currently have to manually click through each repo to figure out someone's tech stack. There's no single tool that aggregates this across an entire profile.

**Target users:**
- Technical recruiters / hiring managers doing quick candidate screening
- Engineers vetting open-source contributors or potential collaborators
- Developers wanting an auto-generated "tech stack" summary for their own portfolio/resume

---

## 2. Goals & Non-Goals

**Goals**
- Given a GitHub username, return an aggregated, de-duplicated list of frameworks/languages/tools used across all public, non-fork repos (with a toggle to include forks)
- Show per-repo breakdown as well as profile-level aggregation
- Fast enough for casual/interactive use (under ~15s for profiles with <50 repos)
- Shareable/linkable results (e.g. `stackscan.dev/octocat`)

**Non-Goals (v1)**
- Scanning private repos (would require OAuth scope creep — punt to v2)
- Full dependency-tree resolution (transitive deps) — rely on whatever the detection library surfaces from direct manifests
- Code-quality or security analysis (not a Snyk competitor)
- Organization-level scanning (v1 is user-profile only)

---

## 3. User Stories

| # | As a... | I want to... | So that... |
|---|---------|---------------|------------|
| 1 | Recruiter | paste a candidate's GitHub username | quickly see if they have relevant framework experience |
| 2 | Developer | scan my own profile | get a shareable stack summary for my resume/portfolio |
| 3 | Engineering lead | scan a contributor's profile | evaluate whether their experience matches our stack before onboarding |
| 4 | Any user | see which repos use which framework | dig into specific projects that are relevant to me |
| 5 | Any user | exclude forked repos | avoid stack info that isn't actually the person's own work |

---

## 4. Core Features (v1 scope)

### 4.1 Input & Scan
- Single input field: GitHub username or profile URL
- "Scan" button triggers the pipeline
- Progress indicator (repos processed incrementally): "Scanning 12/34 repos..."
- Options (collapsible/advanced): include forks, include archived repos, max repos to scan

### 4.2 Results Dashboard
- **Summary header:** avatar, username, bio, # public repos scanned, last scan date
- **Aggregated stack view:** tag/pill cloud of all detected technologies, sized/sorted by frequency (# repos using it)
- **Category grouping:** Languages / Frontend / Backend / Mobile / Data-ML / DevOps-Infra / Databases / SaaS
- **Per-repo table:** repo name, primary language, detected technologies, stars, last updated, link to repo
- **Filter/search:** filter repo list by a specific technology (click "React" pill → see only repos using React)

### 4.3 Sharing & Export
- Unique shareable URL per scanned profile (cached result)
- "Copy as Markdown" button (for pasting into a resume/README)
- Export as JSON (for programmatic use)

### 4.4 Caching & Rate Limits
- Cache scan results per username (24hr TTL) to avoid re-scanning and stay within GitHub API rate limits
- Cache keyed by `username:repo:commitSHA` so unchanged repos are never re-analyzed
- Show "last scanned X ago — rescan" option to force refresh

---

## 5. Out-of-Scope for v1 / Future Roadmap
- v1.1: Org-level scanning (scan all repos in a GitHub org)
- v1.2: OAuth login to scan private repos (with explicit user consent)
- v1.3: Transitive dependency resolution / vulnerability flags
- v1.4: Compare two profiles side-by-side (for team fit assessment)
- v1.5: Browser extension overlaying stack info directly on github.com profile pages
- v2: Support GitLab/Bitbucket profiles

---

## 6. Technical Approach (minimal build)

### 6.1 High-level architecture
Astro 7 site (SSR mode, islands architecture)
├── Static shell: landing page, layout, results page — plain Astro (zero JS)
├── One interactive island (React/Svelte/Preact): results dashboard
│     (filters, pill cloud, sortable table)
└── Astro server endpoints (/src/pages/api/*.ts)
├── /api/repos.ts   → GitHub REST API via Octokit: list public repos
└── /api/scan.ts    → per repo: fetch tarball, run detection library,
aggregate + cache results
No separate backend service — Astro's server endpoints handle GitHub calls and
run the detection library in the same deploy (Vercel / Netlify / Cloudflare Pages).

### 6.2 Detection engine — use an existing library, don't build one

Use **`@specfy/stack-analyser`** (npm), an open-source library that extracts
700+ technologies from a repository by reading manifest files (package.json,
docker-compose.yml, go.mod, requirements.txt, pom.xml, etc.) and outputs a
structured JSON tree of detected technologies per folder/component. This is
the same engine behind getstack.dev.
npx @specfy/stack-analyser <PATH> [--output=<filename>]
or as a module:

```js
import { analyser, FSProvider, flatten } from "@specfy/stack-analyser";
import "@specfy/stack-analyser/dist/autoload"; // load default rules

const result = await analyser({
  provider: new FSProvider({ path: "/tmp/repo-checkout" }),
});
const flat = flatten(result.toJson());
```

This replaces all custom regex/manifest-parsing logic. Before building
tarball-extraction plumbing, check whether `@specfy/stack-analyser` (or a
fork/PR) supports a remote/GitHub-API provider directly — otherwise, pull
each repo's tarball (`GET /repos/{owner}/{repo}/tarball/{ref}`), extract to a
temp dir, and point `FSProvider` at it.

### 6.3 GitHub API usage & rate limits
- Use Octokit.js (official SDK) with a server-side PAT → 5,000 req/hr instead of 60/hr unauthenticated
- List repos: `GET /users/{username}/repos?per_page=100&type=owner`, paginate as needed
- Batch/parallelize tarball fetches with a concurrency limit (e.g. 5 at a time)
- Default to scanning the most recently updated 100 repos; offer a "scan all" option for larger profiles

### 6.4 Data storage
- Start minimal: a single SQLite (Turso) table or Vercel KV store
- Schema: `{ username, repo, commitSHA, techs: json, scannedAt }`
- Skip Postgres + Redis + job queue for v1 — inline scanning is fast enough at this scale; revisit only if usage demands async processing

### 6.5 Suggested stack
- **Framework:** Astro 7 (SSR mode)
- **Detection:** `@specfy/stack-analyser`
- **GitHub client:** Octokit.js
- **Cache/DB:** Vercel KV or Turso (SQLite)
- **Hosting:** Vercel or Cloudflare Pages (both have first-class Astro adapters)

---

## 7. UX Flow

1. Landing page → username input → "Scan"
2. Loading state with live progress (repo count ticking up)
3. Results page:
   - Top: profile summary + aggregated stack pills
   - Middle: category-grouped stack breakdown
   - Bottom: sortable/filterable per-repo table
4. Share button → copies URL
5. "Scan another profile" CTA

---

## 8. Success Metrics

| Metric | Target (v1, first 3 months) |
|---|---|
| Median scan time (profile with <30 repos) | < 10s |
| Scan-to-share rate | > 20% of completed scans generate a share/export |
| Detection accuracy (spot-checked sample) | > 90% precision on top 20 technologies |
| Repeat usage | > 30% of users scan 2+ profiles per session |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| GitHub API rate limiting at scale | Server-side PAT, caching by commit SHA, concurrency limits |
| Detection library gaps for niche stacks | `@specfy/stack-analyser` covers 700+ techs; supplement with a small custom fallback list only if needed |
| Large monorepos slow down scanning | Cap file-tree depth/size per repo scan; timeout + partial results |
| Abuse (scraping the tool to mass-scan profiles) | Rate-limit by IP, CAPTCHA on excessive requests, ToS |
| Privacy concerns | All data scanned is already public; no private-repo scanning without explicit OAuth consent |

---

## 10. Open Questions
- Does `@specfy/stack-analyser` support a remote GitHub provider, or do we need to build tarball-extraction ourselves?
- Should v1 support scanning a pasted list of repo URLs directly, not just a full profile?
- Do we want a polished "resume mode" export in addition to the raw dashboard?
- Should aggregate view weight technologies by recency (2018 repo vs. last month)?