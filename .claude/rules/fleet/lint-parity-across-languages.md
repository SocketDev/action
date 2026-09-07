# Lint parity across languages

The fleet's `socket/*` doctrine isn't JS-specific. The same rules the oxlint
plugin enforces on TypeScript apply to **Rust, Go, and C++** fleet code -
delivered **hybrid**: each language's native linter carries what it can
express, and one shared fleet check-script carries the rest.

## The rule

- **Native linter for what it can express.** clippy (`clippy.toml` +
  `[lints]`), golangci-lint (`.golangci.yml`), clang-tidy (`.clang-tidy`) -
  cascaded from `template/base/universal`. Port the doctrine into their config:
  `no-boolean-trap-param` → clippy `max-fn-params-bools = 1`;
  `no-process-chdir` → clippy `disallowed-methods`, golangci `forbidigo`
  (`os.Chdir`); `no-console-prefer-logger` → golangci `forbidigo`
  (`fmt.Print*`).
- **Shared check-script for the rest.** `inclusive-language`,
  `no-status-emoji`, `no-placeholders`/`personal-path-placeholders`,
  `no-private-path-in-source`, `no-malformed-bypass-marker`,
  `max-file-lines` - one fleet check-script across `.rs`/`.go`/`.c*`/`.h*`,
  not three custom-lint frameworks.
- **Don't port JS-only rules** (`vitest-*`, `no-default-export`,
  `no-namespace-import`, ESM/dynamic-import, `structured-clone`) - no
  cross-language meaning.
- **The Rust deny-set lives in each crate's `Cargo.toml`** (`[lints.clippy]
all = { level = "deny" }`), not clippy.toml - that file only holds
  thresholds + disallowed APIs.

## Coverage: don't chase the tool's artifacts

Rust coverage runs through the pinned nightly (`cargo llvm-cov`), honoring
`#[cfg_attr(coverage_nightly, coverage(off))]` only on genuinely un-runnable
I/O glue (real browser/webview, raw-terminal loops, global-logger init,
system clipboard).

- **`coverage(off)` is for un-runnable I/O, not for logic.** If reachable,
  test it (inject the dependency and mock it).
- **Never rewrite early-returns to single-exit for coverage.** The closing
  brace after a `return` is its own llvm-cov region and shows uncovered
  regardless of runtime cost - contorting guard clauses trades readability for
  a cosmetic metric. ~99% with all logic covered is the honest ceiling.

## Why

A boolean trap, a process-global chdir, a status emoji in a comment are
equally wrong in Rust, Go, or C++. Encoding each rule once keeps the fleet
consistent without three parallel rule sets to drift.
