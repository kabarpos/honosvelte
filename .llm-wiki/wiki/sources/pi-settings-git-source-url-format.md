---
type: source
title: "pi extension git sources need full https URL in settings.json"
slug: pi-settings-git-source-url-format
status: insight
created: 2026-08-05
updated: 2026-08-05
category: devops
---
# pi extension git sources need full https URL in settings.json
When adding a GitHub-hosted pi extension to `settings.json` (under `packages`), the source string MUST be the full HTTPS URL, e.g. `https://github.com/owner/repo`. The bundled `hosted-git-info` in `@earendil-works/pi-coding-agent` does NOT recognize the `github:owner/repo` shorthand or bare `github.com/owner/repo` — `parseSource`/`parseGitUrl` returns `null` for those, so pi treats them as a LOCAL path and silently skips updates (and `pi update <that>` reports "No matching package found").

Symptom seen: a package installed via `npm install github:owner/repo` was recorded in settings.json as `npm:@scope/package`, causing `pi update --extensions` to rewrite it to `@scope/package@latest` and fail with npm 404 (package not on the npm registry). Fix: change the settings entry to `https://github.com/owner/repo` (owner/repo, NOT the npm @scope), which makes `updateGit` clone it into `~/.pi/agent/git/github.com/owner/repo`. Also remove the stale npm dependency from `~/.pi/agent/npm/package.json` and delete the orphaned `node_modules/@scope/package` dir.

Note: the npm-source form `npm:@scope/name` is correct only for packages actually published to the npm registry.
*Category: devops*
---
*Captured: 2026-08-05*
## Related
_Add links to related pages._