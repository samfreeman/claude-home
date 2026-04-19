# LEARNING-003: PBI platform-feature deliverables must verify tier availability before entering ADR

**Source snag:** SNAG-003 from chatr
**Applies to:** all (any WAG project consuming vendor platform features — GitHub, Vercel, Turso, Neon, Supabase, Cloudflare, npm, etc.)

## Standard

Any PBI deliverable that names a platform feature must (a) explicitly name the plan/tier the deliverable assumes, and (b) confirm the feature is available on that plan before the PBI enters `/wag:adr`. Assuming "platform X supports Y" without checking the plan matrix is the root cause of unachievable deliverables that then leak into stale acceptance criteria.

When the ADR pre-flight catches a mismatch, capture a SNAG against the PBI (not the ADR) — the defect is upstream in the PBI's assumption, not in the ADR's interpretation.

## Check

Scan the PBI (deliverables + acceptance criteria + technical notes) for platform-feature verbs and nouns: **protect**, **enforce**, **require**, **gate**, **schedule**, **cron**, **run on**, **deploy to**, **limit**, **reserve**, **domain**, **seat**, **member**, **edge function**, **preview**, **analytics**, **branch**, **connection pool**, **row count**, **build minute**, **function invocation**.

For each hit:
- Is the plan/tier named somewhere (PBI, epic, Architecture)?
- Is the feature documented as available on that plan?
- If either answer is "no" or "unclear" — it's a snag candidate. Verify before the ADR is approved.

## Violations look like

```markdown
# PBI-003 (chatr)
## Deliverables
- Branch protection on `main`: require PR from `dev`, require status check green, no direct pushes
```

Repo was private on free tier. GitHub gates classic branch protection AND rulesets behind Pro for private repos (403 from the API: *"Upgrade to GitHub Pro or make this repository public to enable this feature."*). The deliverable was unachievable as written; the PBI never named the plan.

Other common shapes of the same mistake:

- **Vercel cron**: *"Run cleanup cron hourly"* on Hobby — Hobby is once/day.
- **Vercel team features**: *"Require PR review by a code owner"* — Team plan only.
- **Neon branching**: *"One Neon branch per PR"* — free tier branch count is capped.
- **Turso replicas**: *"Replicate to N regions"* — replica count tied to plan.
- **Cloudflare Workers CPU**: *"Long-running transform in a Worker"* — free tier CPU ms is capped.
- **GitHub Actions minutes**: *"Run full matrix CI on every push"* on free private — 2,000 min/mo shared across all private repos.

Invisible at PBI-authoring time; surfaces when the ADR tries to turn the deliverable into a decision, or (worse) when the Dev tries to implement and the API returns 403 / the feature silently doesn't work.

## Fix pattern

1. **In the PBI**: add a *Platform tier assumed* section naming every platform the PBI touches and the plan assumed. If the plan isn't known, flag as an Open Question in the PBI — don't let it slip into an ADR.

2. **At `/wag:adr` pre-flight**: scan the PBI's deliverables for platform-feature keywords. For each, confirm the plan is named and the feature is on that plan. If not, capture a SNAG against the PBI before entering Phase 2 (design).

3. **When a mismatch is found**: SNAG targets the PBI. Resolution amends the PBI deliverable/AC to the achievable form on the actual tier, and the ADR documents the substituted mechanism with explicit rationale ("Do not restore the platform-level feature without re-verifying tier availability"). Otherwise the next reader assumes the workaround was forgetfulness, not a constraint.

4. **GitHub-free-private-tier specifically** — a concrete factoid worth citing in any ADR on this tier: classic branch protection and rulesets are Pro-only. Workaround: **CI-as-gate**. CI runs on `push` to any branch + `pull_request` to the working branch + post-merge `push` to the working branch. Merges gated by visible PR status (human controls the merge button). Post-merge CI on the working branch surfaces any bypass as red. Pair with a `never commit to <working-branch-parent>` discipline. Discipline + signal replaces platform enforcement. Bump to Pro ($4/mo) if enforcement is genuinely required, or flip repo public if product stage allows.

## Template patch — PBI

```markdown
## Platform tier assumed
- **GitHub:** [plan — e.g. "Free, private repo"] — features used: [list, e.g. "Actions (ubuntu), CODEOWNERS, Issues"]
- **Vercel:** [plan] — features used: [list]
- **<other platform>:** [plan] — features used: [list]

Verify each platform feature above is available on the named plan before this PBI enters `/wag:adr`.
```

## Template patch — ADR (when a tier workaround is in use)

```markdown
### Decision N: [Gating / enforcement mechanism]

**Choice:** [CI-as-gate / client-side hook / alternative mechanism]
**Why not the platform-native feature:** [platform] [feature] is [Pro-only / plan-gated / rate-limited] on [tier]. Verified [date] via [API endpoint / docs link].
**Mechanism:** [concrete workflow — what runs where, what triggers what].
**Do not:** "restore" the platform-native feature without first re-verifying tier availability. If the repo is upgraded or flipped public, that's a separate decision; this mechanism is the right answer *for this tier*.
```
