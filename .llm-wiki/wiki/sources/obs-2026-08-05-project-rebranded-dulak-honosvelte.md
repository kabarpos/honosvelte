---
type: source
title: "Observation: Project rebranded dulak → honosvelte"
slug: obs-2026-08-05-project-rebranded-dulak-honosvelte
status: observation
created: 2026-08-05
updated: 2026-08-05
relevance: high
observed_at: 2026-08-05T18:20:44.944Z
tags: ["rename", "branding", "honosvelte"]
source_context: "Renaming the project identity from dulak to honosvelte and moving the GitHub remote to kabarpos/honosvelte."
---
# ⭐ Observation: Project rebranded dulak → honosvelte
Project identity renamed from "dulak" to "honosvelte" across the repo. GitHub repo moved from maulanashalihin/dulak to kabarpos/honosvelte. Scope of changes: root package.json name+keywords+repository.url; brand strings in src/index.ts, src/client/styles.css, Brand.svelte, Layout.svelte, src/server/inertia.ts (default <title>), Profile.svelte (localStorage key dulak:avatar:upload → honosvelte:avatar:upload); README.md title/CI badge/philosophy/repo URL; the create-dulak scaffolder renamed to create-honosvelte (package name, bin, CLEANUP list, help text, directory create-dulak → create-honosvelte, REPO constant). LICENSE copyright holder left as "maulanashalihin" (ownership decision, not changed). Note: this working directory is NOT a git repo, so `git remote set-url` must be run in the actual repo. The README philosophy etymology ("Banjar word for bored") was replaced with a stack description since "Honosvelte" has no such meaning.
*Relevance: high*

*Context: Renaming the project identity from dulak to honosvelte and moving the GitHub remote to kabarpos/honosvelte.*

*Tags: rename branding honosvelte*
---
*Observed: 2026-08-05T18:20:44.944Z*