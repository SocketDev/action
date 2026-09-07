# Verify state before acting

Before creating, publishing, claiming, or scaffolding anything against a
resource, **read its current state first.** Never assume it is absent,
empty, unpublished, or unclaimed.

## The rule

- **Read before you build a create/publish flow.** Query what already
  exists: `npm view <pkg>`, `cargo search <crate>`, `gh release view`,
  `gh repo view`. Let the real state drive the plan.
- **If it already exists, adapt - do not redo it.** Finding the resource
  already in place is the success case; skip the redundant work.
- **Irreversible actions make verifying first the only safety.** An npm
  version can't be republished, a crates.io version is permanent, a pushed
  tag is public immediately - the cheap up-front read is mandatory.
- **This is the pre-action twin of verify-before-you-claim:** that rule
  covers "don't claim done without a receipt," this covers "don't start
  without reading the state."

## Enforcement

- `verify-before-publish-guard` (PreToolUse, every repo) blocks a publish
  path arg with no leading `./`, and any non-`--dry-run` publish with no
  same-session registry-read receipt.

## Why

Acting on an assumed state is how you rebuild what already exists or
republish frozen versions. (Incident: npm placeholder packages already
published at `0.0.0` got a fresh publish flow generated for them anyway,
without one `npm view` up front - wasted work and a near-miss republish.)
