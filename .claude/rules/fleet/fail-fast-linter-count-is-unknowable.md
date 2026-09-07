# A fail-fast linter's remaining count is unknowable

`cargo clippy` denies per crate and stops at the first failing crate - fixing
one failure uncovers the next batch, not the total. There is no point in that
loop where "how many findings are left" is a real number.

## The rule

- **Never report or estimate a remaining count from a fail-fast linter.** A
  runner that stops at the first crate/file/module carrying a denied lint
  cannot see what's behind it. Any "N left" claim made before the runner goes
  fully clean is a guess dressed as a measurement.
- **Run the runner's own `--fix` first.** Clear the mechanical residue in one
  pass before iterating by hand, same discipline as `code-first-then-ai`.
- **Iterate the hand-fix residue one round at a time.** Fix what the runner
  currently shows, re-run, repeat - a new batch surfacing is expected, not a
  sign the estimate was wrong, because there never was one.
- **Report progress as "N fixed, unknown remaining," never invent a
  denominator.**

## Why

Clearing a clippy backlog took twelve rounds under this constraint, and a
count volunteered at any round would have been wrong every time. Three
findings that surfaced only in later rounds were latent bugs, not lint noise -
none would have been found by stopping early because a fabricated remaining
count looked like zero.
