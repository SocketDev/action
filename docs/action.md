# GitHub Action reference

Use `SocketDev/action` in a workflow step to install Socket Firewall or run
`socket-patch apply`. This page documents the inputs and outputs declared in
[`action.yml`](../action.yml) and the behavior implemented by `src/main.js`,
`src/tools/firewall.js`, `src/tools/patch.js`, and `src/post.js`.

## Modes

| `mode` value          | Supported | Behavior                                                                                                             | Socket token                       |
| --------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `firewall`            | Yes       | Installs Socket Firewall. The action selects Enterprise when `socket-token` is nonempty; otherwise it selects Free.  | Optional. Required for Enterprise. |
| `firewall-free`       | Yes       | Installs the Free edition.                                                                                           | Not used to select the edition.    |
| `firewall-enterprise` | Yes       | Installs the Enterprise edition.                                                                                     | Supply `socket-token`.             |
| `patch`               | Yes       | Downloads `socket-patch`, adds it to `PATH`, then runs `socket-patch apply`.                                         | Not used.                          |
| `cli`                 | No        | Declared in the manifest description but not implemented by the current entrypoint. It fails as an unsupported mode. | Not applicable.                    |

Mode names are lowercased before dispatch. The manifest marks `mode` required,
but does not define a default. Choose a supported mode explicitly.

## Inputs

All inputs below come from [`action.yml`](../action.yml). GitHub Actions passes
input values as strings; the action parses the Boolean inputs with
`@actions/core`.

| Input              | Required | Default                                                                    | Effect                                                                                                                                                                     |
| ------------------ | -------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`             | Yes      | Not set                                                                    | Selects the mode described above.                                                                                                                                          |
| `firewall-version` | No       | `latest`                                                                   | The default resolves to the checksum-pinned `v1.15.0` Firewall release. A different requested version fails checksum validation.                                           |
| `github-token`     | Yes      | `${{ github.server_url == 'https://github.com' && github.token \|\| '' }}` | Used by patch mode to look up release metadata through the GitHub API. The action downloads binaries from public release URLs.                                             |
| `job-summary`      | No       | `all`                                                                      | Firewall post-step summary policy: `all`, `errors`, or `none`. The implementation also maps `true` to `all` and `false` to `none`. Patch mode skips the post-step summary. |
| `patch-cwd`        | No       | `''`                                                                       | When nonempty in patch mode, passes `--cwd <value>` to `socket-patch apply`.                                                                                               |
| `patch-dry-run`    | No       | `false`                                                                    | When true in patch mode, passes `--dry-run`; the patch tool verifies changes without applying them.                                                                        |
| `patch-ecosystems` | No       | `''`                                                                       | When nonempty in patch mode, passes `--ecosystems <value>`. The manifest describes comma-separated ecosystem names: `npm`, `pypi`, and `cargo`.                            |
| `patch-version`    | No       | `latest`                                                                   | Selects the `socket-patch` release. A value other than `latest` is looked up using a `v`-prefixed release tag.                                                             |
| `shims`            | No       | `true`                                                                     | In Firewall mode, creates package-manager shims that route commands through `sfw`. Set to `false` to invoke `sfw` explicitly.                                              |
| `socket-token`     | No       | Not set                                                                    | Sets both `SOCKET_API_TOKEN` and `SOCKET_API_KEY` for later steps and selects Enterprise in `firewall` mode. The action masks this value in logs.                          |
| `socket_api_key`   | No       | Not set                                                                    | Declared as an input in the manifest. The current entrypoint does not read it; use `socket-token` to export the token and select Enterprise mode.                          |
| `use-cache`        | No       | `true`                                                                     | Reuses a cached Firewall or patch binary when available. Set to `false` to download it again.                                                                              |

Boolean values must use the syntax accepted by `@actions/core`'s
`getBooleanInput`, such as `true` or `false`.

### Firewall job summaries

The post step reads the Firewall report path exported during installation. With
`job-summary: all`, it writes a summary for the report, including blocked
packages and URL parse failures. With `errors`, it writes a summary only when
the report contains those findings. With `none`, it skips the summary. If the
Firewall setup did not provide a report file, the post step skips summary
creation. This input has no effect in patch mode.

## Outputs

| Output                 | Set in                                         | Value                                            |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------ |
| `firewall-path-report` | Firewall mode when `job-summary` is not `none` | Path to the generated Firewall report JSON.      |
| `firewall-path-binary` | Firewall mode                                  | Path to the installed `sfw` executable.          |
| `patch-path-binary`    | Patch mode                                     | Path to the installed `socket-patch` executable. |

Each output is available to later workflow steps through the action step's
`outputs` context. For example, `steps.socket.outputs.patch-path-binary` reads
the patch binary path when the step id is `socket`.

## Patch mode

Patch mode supports these runner platform and architecture pairs, based on the
Node platform and architecture values used by the action:

| Runner platform | Runner architecture   |
| --------------- | --------------------- |
| macOS           | ARM64, x64            |
| Linux           | ARM, ARM64, IA32, x64 |
| Windows         | ARM64, IA32, x64      |

The action downloads the matching release archive, checks it against the
release's `SHA256SUMS`, extracts it, adds the binary directory to `PATH`, and
runs `socket-patch apply`. Unsupported platform and architecture pairs fail
before download. The action forwards ecosystem, dry-run, and working-directory
options as CLI arguments.

```yaml
steps:
  - uses: SocketDev/action@<commit-sha>
    with:
      mode: patch
      patch-ecosystems: npm,pypi
      patch-dry-run: 'true'
      patch-cwd: ./packages/service
```

Remove `patch-dry-run` or set it to `'false'` to apply patches. Patch mode can
modify files when dry-run is disabled. It does not create a Firewall job
summary.

## Firewall mode

Firewall mode installs a supported build of `sfw`, verifies its checksum,
places it on `PATH`, and can create package-manager shims. The currently
supported builds are macOS ARM64 and x64, Linux ARM64 and x64, and Windows
ARM64 and x64. Unsupported builds fail rather than installing an unverified
binary.

Use the Free or Enterprise mode examples in the [README](../README.md#usage).
Enterprise access requires a Socket API token, commonly provided as a GitHub
secret. Free mode does not require one.

## Errors and permissions

The action reports setup or execution errors as failed workflow steps. Common
causes include an unsupported mode or runner architecture, a missing GitHub
release, a failed download, or a checksum mismatch. Patch mode also fails if
the `socket-patch apply` command fails.

The action reads the GitHub token input to query releases and download assets.
The default uses `github.token` on GitHub.com and an empty value on other
servers. Configure a suitable token when running on GitHub Enterprise Server.
Firewall Enterprise mode also needs the Socket API token. Limit token
permissions to what the workflow needs and store credentials in GitHub
secrets.
