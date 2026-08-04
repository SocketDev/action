# Socket Security (GitHub Action)

[![Follow @SocketSecurity](https://img.shields.io/twitter/follow/SocketSecurity?style=social)](https://twitter.com/SocketSecurity)
[![Follow @socket.dev on Bluesky](https://img.shields.io/badge/Follow-@socket.dev-1DA1F2?style=social&logo=bluesky)](https://bsky.app/profile/socket.dev)

A GitHub Action for running [Socket.dev](https://socket.dev)

> [!TIP]
> A [GitHub App](https://github.com/marketplace/socket-security) is also available for a fully automated SCA workflow.

## Install

There is nothing to install. Reference the action from a workflow step and the
runner fetches it at the ref you pin — the copy-pasteable step, with the `mode`
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

#### Most secure: pin to a commit SHA

```yaml
on: push

jobs:
  safe-install:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2

      - uses: SocketDev/action@2d3f25590c6ed6ba11a9a14c064d962a3a04698f # v1.3.1
        with:
          mode: firewall-free

      # javascript / typescript
      - run: sfw npm install # or yarn, pnpm

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

      - uses: SocketDev/action@v1.3.1
        with:
          mode: firewall-free

      # javascript / typescript
      - run: sfw npm install # or yarn, pnpm

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
| `job-summary`      | Create a [job summary][job-summary] (`all`, `errors`, or `none`) | No       | `all`                |
| `use-cache`        | Cache the Socket binaries (force download if `false`)            | No       | `true`               |
| `github-token`     | GitHub API Token used for downloading binaries                   | No       | `${{ github.token}}` |

#### Outputs

| Output                 | Description                                |
| ---------------------- | ------------------------------------------ |
| `firewall-path-report` | Path to the generated firewall report JSON |
| `firewall-path-binary` | Path to the installed binary               |

### Socket Firewall: Enterprise

Downloads and installs [Socket Firewall: Enterprise](https://github.com/SocketDev/firewall-release) edition in your GitHub Action job, making it available to use in subsequent steps as a wrapper.

#### Most secure: pin to a commit SHA

```yaml
on: push

jobs:
  safe-install:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2

      - uses: SocketDev/action@2d3f25590c6ed6ba11a9a14c064d962a3a04698f # v1.3.1
        with:
          mode: firewall-enterprise
          socket-token: ${{ secrets.SOCKET_API_KEY }}

      # javascript / typescript
      - run: sfw npm install # or yarn, pnpm

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

      - uses: SocketDev/action@v1.3.1
        with:
          mode: firewall-enterprise
          socket-token: ${{ secrets.SOCKET_API_KEY }}

      # javascript / typescript
      - run: sfw npm install # or yarn, pnpm

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
| `job-summary`      | Create a [job summary][job-summary] (`all`, `errors`, or `none`) | No       | `all`                |
| `use-cache`        | Cache the Socket binaries (force download if `false`)            | No       | `true`               |
| `github-token`     | GitHub API Token used for downloading binaries                   | No       | `${{ github.token}}` |
| `socket-token`     | Socket API Token                                                 | **YES**  | `-`                  |

#### Outputs

| Output                 | Description                                |
| ---------------------- | ------------------------------------------ |
| `firewall-path-report` | Path to the generated firewall report JSON |
| `firewall-path-binary` | Path to the installed binary               |

[job-summary]: https://github.blog/news-insights/product-news/supercharging-github-actions-with-job-summaries

## Development

Requires Node 24+ and pnpm.

```sh
pnpm install
pnpm run build
pnpm run check --all
```

`src/` holds the action sources and `dist/` holds the bundle a workflow runner
actually executes — a consumer resolves the action at a git tag and runs the
committed `dist/main.js` and `dist/post.js`, with no `node_modules` beside
them. That makes `dist/` part of the source of truth: run `pnpm run build` and
commit the result in the same change as any `src/` edit, or the next tag ships
a bundle that silently does not contain your change. The
`committed-dist-is-current` check is the gate that catches a miss.

## License

MIT
