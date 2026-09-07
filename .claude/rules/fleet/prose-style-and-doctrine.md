# Prose style and doctrine

Fleet prose rules apply to every human-facing surface: PR bodies, issue
comments, Linear updates, commit bodies, docs, README, CHANGELOG, release
notes. The prose skill enforces these at write time.

## Voice

- Lead with the point - first sentence is the decision or answer, no
  preamble.
- Default to 1-3 sentences on conversational surfaces; cut what the reader
  already knows.
- Code beats prose when the answer is code.
- Decide fast and name the reason + reversal condition - don't survey
  options.
- For a breaking/architectural decision, name the migration path.
- Keep direct requests complete and junior-readable; use existing code, a
  snippet, or a link as the receipt.
- Be warm without ceremony - skip service-desk openings and manufactured
  enthusiasm.

## Evidence

- Every technical claim needs a receipt from this session: a commit SHA, a
  `file:line`, a benchmark output. Never assert "faster/works/fixed" without
  a tool call that produced the result.
- A self-reported detail (a PR author's "I ran X", a bot's claim, a
  teammate's count) is a lead, not your finding - verify it or attribute it,
  never restate it as your own verified fact.

## Finishing

- Finish the task; capture side-quests as a note + an ask, don't chase them.
- A standard that isn't executable is policy on paper - correct once,
  promote to a hook, lint rule, or check.

## Anti-patterns

Blocked by `anti-prose-guard` on doc surfaces, flagged by `convo-prose-nudge`
on PR/issue bodies: throat-clearers ("I've gone ahead and…", "Let me…"),
closing filler ("Hope this helps!"), diff narration, hedge-stacking
("essentially", "simply", "just"), em-dashes (replace with a plain hyphen -
exempt inside code spans), "not X, it's Y" contrast pairs, and honesty
announcements ("to be honest").

The prose skill enforces a fuller banned-words/slop-pattern set beyond these
(delve, foster, leverage, utilize, colon reveals, weasel attribution, fake-
strong verbs, summary-recap endings) - full list in `references/phrases.md`.

## GitHub advanced formatting

When a body earns structure: collapsed `<details><summary>` sections
(verdict stays outside the fold; blank line after `</summary>` or it won't
render), at most one alert (`> [!NOTE]` etc.) per body, `- [ ]` task lists for
actionable follow-ups, autolinks/permalinks, footnotes for one or two asides.

## Surface routing

Conversational surfaces (PR/issue/Linear/commit body) get voice +
anti-pattern rules, 1-3 sentence target. Documentation surfaces (`docs/**`,
README, CHANGELOG, release notes) get core prose rules, no brevity target.
Cascade output and bot-generated text are exempt.

See also: `.claude/skills/fleet/prose/SKILL.md`,
`docs/fleet/agents.md/prose-style-and-doctrine.md`.
