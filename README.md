# <picture><img width="32" height="32" alt="action" src="https://raw.githubusercontent.com/SocketDev/action/HEAD/assets/repo/logomark.svg"></picture> Socket Security (GitHub Action)

[![Follow @SocketSecurity](https://img.shields.io/twitter/follow/SocketSecurity?style=social)](https://twitter.com/SocketSecurity)
[![Follow @socket.dev on Bluesky](https://img.shields.io/badge/Follow-@socket.dev-1DA1F2?style=social&logo=bluesky)](https://bsky.app/profile/socket.dev)

A GitHub Action for running [Socket.dev](https://socket.dev)

> [!TIP]
> A [GitHub App](https://github.com/marketplace/socket-security) is also available for a fully automated SCA workflow.

## Install

There is nothing to install. Reference the action from a workflow step and the
runner fetches it at the ref you pin. The workflow step, with the `mode`
input filled in, is in [Usage](#usage) below. Pin to a commit SHA rather than a
tag; [Why We Recommend Pinning](#why-we-recommend-pinning) explains the
trade-off.

## Usage

This action can run in multiple modes:

- [Socket Firewall: Free](#socket-firewall-free)
- [Socket Firewall: Enterprise](#socket-firewall-enterprise)
- Socket CLI: _Coming soon_

### Why We Recommend Pinning

Socket is a security control, so the action that installs it should be pinned, too. We recommend pinning to an immutable commit SHA for the strongest supply-chain protection. If your organization prefers easier readability, pin to an immutable version tag instead. Either way, Dependabot can keep the reference current while preserving a human review gate.

### Socket Firewall: Free

Downloads and installs [Socket Firewall: Free](https://github.com/SocketDev/sfw-free) edition in your GitHub Action job, making it available to use in subsequent steps.

The published action requires an explicit `sfw` prefix, as shown below. Automatic shims and final PATH validation are unreleased features in the current source.

<details>
<summary>Free edition examples, inputs, and outputs</summary>

#### Most secure: pin to a commit SHA

```yaml
on: push

jobs:
  safe-install:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2

      - uses: SocketDev/action@ba6de6cc0565af1f42295590380973573297e31f # v1.3.2
        with:
          mode: firewall-free

      # javascript / typescript
      - run: sfw npm install # or sfw pnpm install, sfw yarn install

      # rust
      - run: sfw cargo fetch

      # python
      - run: sfw pip install -r requirements.txt
```

#### Slightly less secure: pin to an immutable version tag

```yaml
on: push

jobs:
  safe-install:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2

      - uses: SocketDev/action@v1.3.2
        with:
          mode: firewall-free

      # javascript / typescript
      - run: sfw npm install # or sfw pnpm install, sfw yarn install

      # rust
      - run: sfw cargo fetch

      # python
      - run: sfw pip install -r requirements.txt
```

#### Explicit sfw invocation

Prefix each package-manager command with `sfw`:

```yaml
- uses: SocketDev/action@v1.3.2
  with:
    mode: firewall-free

- run: sfw npm install
```

#### Dependabot config

```yaml
version: 2
updates:
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
    cooldown:
      semver-major-days: 14
      semver-minor-days: 7
      semver-patch-days: 3
```

Add a cooldown period if you want an extra buffer before newly published action releases are proposed. That gives the ecosystem a little time to surface regressions before Dependabot opens an update PR in your repo.

#### Inputs

| Input              | Description                                                      | Required | Default              |
| ------------------ | ---------------------------------------------------------------- | -------- | -------------------- |
| `firewall-version` | Specify the firewall version number                              | No       | `latest`             |
| `github-token`     | GitHub API Token used for downloading binaries                   | No       | `${{ github.token}}` |
| `job-summary`      | Create a [job summary][job-summary] (`all`, `errors`, or `none`) | No       | `all`                |
| `shims`            | Create automatic shims (unreleased source only)                  | No       | `true`               |
| `use-cache`        | Cache the Socket binaries (force download if `false`)            | No       | `true`               |

#### Outputs

| Output                 | Description                                |
| ---------------------- | ------------------------------------------ |
| `firewall-path-binary` | Path to the installed binary               |
| `firewall-path-report` | Path to the generated firewall report JSON |

</details>

### Socket Firewall: Enterprise

Downloads and installs [Socket Firewall: Enterprise](https://github.com/SocketDev/firewall-release) edition in your GitHub Action job, making it available to use in subsequent steps.

The published action requires the same explicit `sfw` prefix as the free edition.

<details>
<summary>Enterprise edition examples, inputs, and outputs</summary>

#### Most secure: pin to a commit SHA

```yaml
on: push

jobs:
  safe-install:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2

      - uses: SocketDev/action@ba6de6cc0565af1f42295590380973573297e31f # v1.3.2
        with:
          mode: firewall-enterprise
          socket-token: ${{ secrets.SOCKET_API_KEY }}

      # javascript / typescript
      - run: sfw npm install # or sfw pnpm install, sfw yarn install

      # rust
      - run: sfw cargo fetch

      # python
      - run: sfw pip install -r requirements.txt
```

#### Slightly less secure: pin to an immutable version tag

```yaml
on: push

jobs:
  safe-install:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2

      - uses: SocketDev/action@v1.3.2
        with:
          mode: firewall-enterprise
          socket-token: ${{ secrets.SOCKET_API_KEY }}

      # javascript / typescript
      - run: sfw npm install # or sfw pnpm install, sfw yarn install

      # rust
      - run: sfw cargo fetch

      # python
      - run: sfw pip install -r requirements.txt
```

#### Dependabot config

```yaml
version: 2
updates:
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
    cooldown:
      semver-major-days: 14
      semver-minor-days: 7
      semver-patch-days: 3
```

Add a cooldown period if you want an extra buffer before newly published action releases are proposed. That gives the ecosystem a little time to surface regressions before Dependabot opens an update PR in your repo.

#### Inputs

| Input              | Description                                                      | Required | Default              |
| ------------------ | ---------------------------------------------------------------- | -------- | -------------------- |
| `firewall-version` | Specify the firewall version number                              | No       | `latest`             |
| `github-token`     | GitHub API Token used for downloading binaries                   | No       | `${{ github.token}}` |
| `job-summary`      | Create a [job summary][job-summary] (`all`, `errors`, or `none`) | No       | `all`                |
| `shims`            | Create automatic shims (unreleased source only)                  | No       | `true`               |
| `socket-token`     | Socket API Token                                                 | **YES**  | `-`                  |
| `use-cache`        | Cache the Socket binaries (force download if `false`)            | No       | `true`               |

#### Outputs

| Output                 | Description                                |
| ---------------------- | ------------------------------------------ |
| `firewall-path-binary` | Path to the installed binary               |
| `firewall-path-report` | Path to the generated firewall report JSON |

</details>

### Supported Ecosystems

The supported ecosystems depend on the edition. Current unreleased source also routes these commands through automatic shims when `shims` is `true`.

<details>
<summary>Package managers by edition</summary>

#### Free + Enterprise

Available in both [sfw-free][sfw-free-ecosystems] and [sfw-enterprise][sfw-enterprise-ecosystems]:

| Ecosystem       | Package Manager |
| --------------- | --------------- |
| JavaScript/Node | `npm`           |
| JavaScript/Node | `pnpm`          |
| JavaScript/Node | `yarn`          |
| Python          | `pip`           |
| Python          | `pip3`          |
| Python          | `uv`            |
| Rust            | `cargo`         |

#### Enterprise only

Additional ecosystems available with [sfw-enterprise][sfw-enterprise-ecosystems]:

| Ecosystem | Package Manager | Note       |
| --------- | --------------- | ---------- |
| .NET      | `nuget`         |            |
| Go        | `go`            | Linux only |
| Ruby      | `bundler`       |            |
| Ruby      | `gem`           |            |

[sfw-free-ecosystems]: https://github.com/SocketDev/sfw-free?tab=readme-ov-file#supported-package-managers
[sfw-enterprise-ecosystems]: https://github.com/SocketDev/firewall-release/wiki#support-matrix

</details>

### Setup order for automatic shims

Run runtime and package-manager setup actions before the firewall action. Install dependencies afterward. A later setup step can put its binaries ahead of the firewall shims on `PATH`.

With automatic shims enabled, the post action fails the job if supported commands resolve outside the shim directory. This check also runs with `job-summary: none`. It checks the final `PATH` after execution. It cannot protect earlier installs or detect temporary drift that was later restored.

Run the firewall action again after changing runtimes, or use explicit `sfw` invocation. In current source, `shims: 'false'` selects explicit invocation and disables the final shim check.

### Bypassing shims for publishing

With automatic shims enabled in current source, the action exports `SFW_SHIM_DIR` as an environment variable pointing to the shim directory. If you need to bypass sfw for a specific step (e.g. `npm publish`), you can temporarily disable the shims by renaming them and restore them afterwards:

<details>
<summary>Disable and restore shims around publishing</summary>

```yaml
# disable shims before publishing
- name: Disable sfw shims
  run: |
    if [ -n "$SFW_SHIM_DIR" ] && [ -d "$SFW_SHIM_DIR" ]; then
      for SHIM in "$SFW_SHIM_DIR"/*; do
        [ -f "$SHIM" ] && mv "$SHIM" "${SHIM}.disabled"
      done
    fi

- run: npm publish

# re-enable shims after publishing
- name: Restore sfw shims
  if: always()
  run: |
    if [ -n "$SFW_SHIM_DIR" ] && [ -d "$SFW_SHIM_DIR" ]; then
      for SHIM in "$SFW_SHIM_DIR"/*.disabled; do
        [ -f "$SHIM" ] && mv "$SHIM" "${SHIM%.disabled}"
      done
    fi
```

</details>

### Checksum Validation

Current source validates each downloaded firewall binary against a checksum pinned in the action source.

[job-summary]: https://github.blog/news-insights/product-news/supercharging-github-actions-with-job-summaries

## Development

Requires Node 24+ and pnpm.

```sh
pnpm install
pnpm run build
pnpm run check --all
```

`src/` holds the action sources and `dist/` holds the bundle a workflow runner
actually executes. A consumer resolves the action at a git tag and runs the
committed `dist/main.js` and `dist/post.js`, with no `node_modules` beside
them. That makes `dist/` part of the source of truth: run `pnpm run build` and
commit the result in the same change as any `src/` edit, or the next tag ships
a bundle that silently does not contain your change. The
`committed-dist-is-current` check is the gate that catches a miss.

## License

MIT
