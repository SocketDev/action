# Socket Security (GitHub Action)

A GitHub Action for running [Socket.dev](https://socket.dev)

> [!TIP]
> A [GitHub App](https://github.com/marketplace/socket-security) is also available for a fully automated SCA workflow.

## Usage

This action can run in multiple modes:

- [Socket Firewall: Free](#socket-firewall-free)
- [Socket Firewall: Enterprise](#socket-firewall-enterprise)
- Socket CLI: _Coming soon_

### Socket Firewall: Free

Downloads and installs [Socket Firewall: Free](https://github.com/SocketDev/sfw-free) edition in your GitHub Action job, making it available to use in subsequent steps.

```yaml
on: push

jobs:
  safe-install:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: SocketDev/action@v1
        with:
          mode: firewall-free

      # javascript / typescript
      - run: sfw npm install # or yarn, pnpm

      # rust
      - run: sfw cargo fetch

      # python
      - run: sfw pip install -r requirements.txt
```

#### Inputs

| Input              | Description                                           | Required | Default              |
| ------------------ | ----------------------------------------------------- | -------- | -------------------- |
| `firewall-version` | Specify the firewall version number                   | No       | `latest`             |
| `job-summary`      | Create a [job summary][job-summary]                   | No       | `true`               |
| `use-cache`        | Cache the Socket binaries (force download if `false`) | No       | `true`               |
| `github-token`     | GitHub API Token used for downloading binaries        | No       | `${{ github.token}}` |

#### Outputs

| Output                 | Description                                |
| ---------------------- | ------------------------------------------ |
| `firewall-path-report` | Path to the generated firewall report JSON |
| `firewall-path-binary` | Path to the installed binary               |

### Socket Firewall: Enterprise

Downloads and installs [Socket Firewall: Enterprise](https://github.com/SocketDev/firewall-release) edition in your GitHub Action job, making it available to use in subsequent steps as a wrapper.

```yaml
on: push

jobs:
  safe-install:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: SocketDev/action@v1
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

#### Inputs

| Input              | Description                                           | Required | Default              |
| ------------------ | ----------------------------------------------------- | -------- | -------------------- |
| `firewall-version` | Specify the firewall version number                   | No       | `latest`             |
| `job-summary`      | Create a [job summary][job-summary]                   | No       | `true`               |
| `use-cache`        | Cache the Socket binaries (force download if `false`) | No       | `true`               |
| `github-token`     | GitHub API Token used for downloading binaries        | **YES**  | `${{ github.token}}` |

#### Outputs

| Output                 | Description                                |
| ---------------------- | ------------------------------------------ |
| `firewall-path-report` | Path to the generated firewall report JSON |
| `firewall-path-binary` | Path to the installed binary               |

[job-summary]: https://github.blog/news-insights/product-news/supercharging-github-actions-with-job-summaries
[job-summary]: https://github.blog/news-insights/product-news/supercharging-github-actions-with-job-summaries
