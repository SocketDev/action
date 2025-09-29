# Socket Security GitHub Action

A GitHub Action for running [Socket.dev](https://socket.dev)

## Usage

### Socket Firewall

Downloads and installs the Socket Firewall in your GitHub Action job, making it available to use in subsequent steps.

```yaml
on: push

jobs:
  safe-install:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: SocketDev/action@v1
        with:
          mode: firewall

      # javascript / typescript
      - run: sfw npm install # or yarn, pnpm

      # rust
      - run: sfw cargo fetch

      # python
      - run: sfw pip install -r requirements.txt
```

#### Inputs

| Input              | Description                                                  | Required | Default              |
| ------------------ | ------------------------------------------------------------ | -------- | -------------------- |
| `mode`             | Specify run mode (currently only supporting `firewall` mode) | Yes      | `-`                  |
| `firewall-version` | Specify the firewall version number                          | No       | `latest`             |
| `job-summary`      | Create a [job summary][job-summary]                          | No       | `true`               |
| `use-cache`        | Cache the Socket binaries (force download if `false`)        | No       | `false`              |
| `github-token`     | GitHub API Token used for downloading binaries               | No       | `${{ github.token}}` |

#### Outputs

| Output                 | Description                                |
| ---------------------- | ------------------------------------------ |
| `firewall-path-report` | Path to the generated firewall report JSON |
| `firewall-path-binary` | Path to the installed binary               |

[job-summary]: https://github.blog/news-insights/product-news/supercharging-github-actions-with-job-summaries
