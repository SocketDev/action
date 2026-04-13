# Socket Security (GitHub Action)

A GitHub Action for running [Socket.dev](https://socket.dev)

> [!TIP]
> A [GitHub App](https://github.com/marketplace/socket-security) is also available for a fully automated SCA workflow.

## Usage

This action can run in multiple modes:

- [Socket Firewall: Free](#socket-firewall-free)
- [Socket Firewall: Enterprise](#socket-firewall-enterprise)
- Socket CLI: _Coming soon_

### Why We Recommend Pinning

Socket is a security control, so the action that installs it should be pinned, too. We recommend pinning to an immutable commit SHA for the strongest supply-chain protection. If your organization prefers easier readability, pin to an immutable version tag instead. Either way, Dependabot can keep the reference current while preserving a human review gate.

### Socket Firewall: Free

Downloads and installs [Socket Firewall: Free](https://github.com/SocketDev/sfw-free) edition in your GitHub Action job, making it available to use in subsequent steps.

By default the action creates shims for all supported package managers. This means you do **not** need to prefix your commands with `sfw` — just run your package manager like normal and it will be automatically routed through Socket Firewall.

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

      # these commands are automatically intercepted by sfw
      # no need to prefix with "sfw" anymore!

      # javascript / typescript
      - run: npm install # or pnpm, yarn

      # rust
      - run: cargo fetch

      # python
      - run: pip install -r requirements.txt
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
      - run: npm install # or pnpm, yarn

      # rust
      - run: cargo fetch

      # python
      - run: pip install -r requirements.txt
```

#### Disable shims (explicit sfw prefix)

If you prefer to keep using the `sfw` prefix explicitly, you can turn off automatic shims:

```yaml
- uses: SocketDev/action@v1.3.1
  with:
    mode: firewall-free
    shims: 'false'

# now you need to explicitly prefix commands with sfw
- run: sfw npm install
```

#### Dependabot config

```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    cooldown:
      semver-major-days: 14
      semver-minor-days: 7
      semver-patch-days: 3
```

Add a cooldown period if you want an extra buffer before newly published action releases are proposed. That gives the ecosystem a little time to surface regressions before Dependabot opens an update PR in your repo.

#### Inputs

| Input                 | Description                                                      | Required | Default              |
| --------------------- | ---------------------------------------------------------------- | -------- | -------------------- |
| `firewall-version`    | Specify the firewall version number                              | No       | `latest`             |
| `github-token`        | GitHub API Token used for downloading binaries                   | No       | `${{ github.token}}` |
| `job-summary`         | Create a [job summary][job-summary] (`all`, `errors`, or `none`) | No       | `all`                |
| `shims`               | Create shims so package managers are routed through sfw          | No       | `true`               |
| `use-cache`           | Cache the Socket binaries (force download if `false`)            | No       | `true`               |

#### Outputs

| Output                 | Description                                |
| ---------------------- | ------------------------------------------ |
| `firewall-path-binary` | Path to the installed binary               |
| `firewall-path-report` | Path to the generated firewall report JSON |

### Socket Firewall: Enterprise

Downloads and installs [Socket Firewall: Enterprise](https://github.com/SocketDev/firewall-release) edition in your GitHub Action job, making it available to use in subsequent steps.

Like the free edition, the action creates shims by default so you can use your package manager commands normally without the `sfw` prefix.

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

      # these commands are automatically intercepted by sfw
      # no need to prefix with "sfw" anymore!

      # javascript / typescript
      - run: npm install # or pnpm, yarn

      # rust
      - run: cargo fetch

      # python
      - run: pip install -r requirements.txt
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
      - run: npm install # or pnpm, yarn

      # rust
      - run: cargo fetch

      # python
      - run: pip install -r requirements.txt
```

#### Dependabot config

```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    cooldown:
      semver-major-days: 14
      semver-minor-days: 7
      semver-patch-days: 3
```

Add a cooldown period if you want an extra buffer before newly published action releases are proposed. That gives the ecosystem a little time to surface regressions before Dependabot opens an update PR in your repo.

#### Inputs

| Input                 | Description                                                      | Required | Default              |
| --------------------- | ---------------------------------------------------------------- | -------- | -------------------- |
| `firewall-version`    | Specify the firewall version number                              | No       | `latest`             |
| `github-token`        | GitHub API Token used for downloading binaries                   | No       | `${{ github.token}}` |
| `job-summary`         | Create a [job summary][job-summary] (`all`, `errors`, or `none`) | No       | `all`                |
| `shims`               | Create shims so package managers are routed through sfw          | No       | `true`               |
| `socket-token`        | Socket API Token                                                 | **YES**  | `-`                  |
| `use-cache`           | Cache the Socket binaries (force download if `false`)            | No       | `true`               |

#### Outputs

| Output                 | Description                                |
| ---------------------- | ------------------------------------------ |
| `firewall-path-binary` | Path to the installed binary               |
| `firewall-path-report` | Path to the generated firewall report JSON |

### Supported Ecosystems

When `shims` is `true` (the default), the action creates shims so package manager commands are automatically routed through sfw. The supported ecosystems depend on the edition.

#### Free + Enterprise

Available in both [sfw-free][sfw-free-ecosystems] and [sfw-enterprise][sfw-enterprise-ecosystems]:

| Ecosystem           | Package Manager |
| ------------------- | --------------- |
| JavaScript/Node     | `npm`           |
| JavaScript/Node     | `pnpm`          |
| JavaScript/Node     | `yarn`          |
| Python              | `pip`           |
| Python              | `pip3`          |
| Python              | `uv`            |
| Rust                | `cargo`         |

#### Enterprise only

Additional ecosystems available with [sfw-enterprise][sfw-enterprise-ecosystems]:

| Ecosystem           | Package Manager | Note         |
| ------------------- | --------------- | ------------ |
| .NET                | `nuget`         |              |
| Go                  | `go`            | Linux only   |
| Ruby                | `bundler`       |              |
| Ruby                | `gem`           |              |

[sfw-free-ecosystems]: https://github.com/SocketDev/sfw-free?tab=readme-ov-file#supported-package-managers
[sfw-enterprise-ecosystems]: https://github.com/SocketDev/firewall-release/wiki#support-matrix

### Bypassing shims for publishing

When shims are enabled the action exports `SFW_SHIM_DIR` as an environment variable pointing to the shim directory. If you need to bypass sfw for a specific step (e.g. `npm publish`), you can temporarily disable the shims by renaming them and restore them afterwards:

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

### Checksum Validation

The action validates the SHA256 checksum of the downloaded firewall binary against the checksum file published alongside each release. This ensures the binary was not tampered with during download.

[job-summary]: https://github.blog/news-insights/product-news/supercharging-github-actions-with-job-summaries
