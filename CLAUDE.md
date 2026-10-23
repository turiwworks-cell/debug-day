# Rules for every agent working on this repo

## 0. Core purpose of the app (most important — read first)
These two principles are the app's main strength and goal. Every change must respect them.

1. **Everything stays in sync — one connected system.**
   A change made in Board must show up in Lanes, in Plan, and everywhere else. No view keeps its own separate copy of the truth. When you add or change a feature, make sure every view reflects it.
2. **A planner for artists, not a rigid scheduler.**
   The app always moves toward being an artist's planner. It must not become a clichéd, strict, hour-by-hour, dry scheduling system. When in doubt, choose the softer, more flexible, more human option.

> Owner's words (Persian): «همه چیز باید باهم هماهنگ باشن. چیزی که در برد تغییر داده میشه باید در حالت lanes و plan و همه جا تغییر کنه. یک سیستم پیوسته به هم.» — «اپ همیشه به سمتی میره که به عنوان برنامه ریز ارتیست باشه، نه یک سیستم برنامه ریزی کلیشه ای، سفت و سخت، ساعتی و خشک.»


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
