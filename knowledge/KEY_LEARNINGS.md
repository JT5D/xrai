# Key Learnings (Verified)

## WarpJobs (repo evidence)

- **Simplified scoring to 5 tiers** (T1–T5) to keep prioritization debuggable and easy to iterate.
  - Evidence: `WarpJobs/CLAUDE.md` section “SIMPLIFIED SCORING SYSTEM (5 Tiers)”.

- **Interview calendar system should use native Calendar.app alarms, not LaunchAgents**, to avoid daemon proliferation and to sync across devices.
  - Evidence: `WarpJobs/CLAUDE.md` section “INTERVIEW CALENDAR SYSTEM”.

- **Auto-improvement via multiple feedback loops**: scrapers, weights, patterns, data quality, priorities, auto-fix, news trends, cleanup.
  - Evidence: `WarpJobs/CLAUDE.md` section “AUTO-IMPROVEMENT SYSTEM (8 Loops)”.

- **Knowledgebase signal extraction**: periodic sync from a knowledgebase directory into `kb-signals.json` to influence scoring.
  - Evidence: `WarpJobs/CLAUDE.md` section “KNOWLEDGEBASE INTEGRATION”.

## XRAI (repo evidence)

- XRAI positions itself as a cross-platform AI+XR ecosystem spanning Unity + WebGL/ThreeJS + AI services for 3D generation.
  - Evidence: `xrai/CLAUDE.md` “Project Overview” + “Architecture Overview”.

## Holograim (repo evidence)

- Holograim focuses on a high-performance crawler/visualizer with 2D (D3) + 3D graph/treemap/sunburst visualizations, and multi-source crawling targets (filesystem, web, S3, GDrive).
  - Evidence: `holograim` commit messages + repo structure (`crawler.js`, `visualizer-server.js`, `crawl-output/`).

