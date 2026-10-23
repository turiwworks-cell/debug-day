# Rules for every agent working on this repo

More than one agent can work on this repo at the same time. Follow these rules on every change.

## 1. Work on your own branch
- Never commit directly to `main`.
- Create your own branch from the latest `main`, do the work there, then open a PR and merge it.
- Before merging, bring in the latest `main` and resolve conflicts (other agents may have merged first).

## 2. Log every change in CHANGELOG.md (required)
After **every** change you ship, add a new entry at the top of `CHANGELOG.md`:

```
## <version> — YYYY-MM-DD
Branch: <branch-name>
- What changed (one short line per change, plain words)
```

- Version follows `MAJOR.MINOR.PATCH`:
  - PATCH (5.0.0 → 5.0.1): bug fix or small tweak
  - MINOR (5.0.1 → 5.1.0): new feature
  - MAJOR (5.1.0 → 6.0.0): breaking change
- Bump the same version in both places: `package.json` (`"version"`) and `src/worker.js` (`INFO.version`).
- If another agent merged a version before you, take the next free number when you merge. Never reuse a version.
- A PR without a CHANGELOG entry is not finished.
