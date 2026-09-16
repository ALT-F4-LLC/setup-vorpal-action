# Setup Vorpal Action

GitHub Action that downloads, configures, and starts the Vorpal service for use in CI/CD workflows.

## Features

- 🚀 Downloads and installs Vorpal binary from GitHub releases
- 🔧 Configures Vorpal directories and permissions
- 🔑 Generates required cryptographic keys
- 🌐 Starts Vorpal services (agent, registry, worker)
- ☁️ Supports multiple registry backends (local, S3)
- 🔒 Automatic cleanup on workflow completion

## Usage

### Basic Usage

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Setup Vorpal
        uses: ALT-F4-LLC/setup-vorpal-action@main
```

### Advanced Usage with S3 Backend

```yaml
name: CI with S3 Registry
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Setup Vorpal
        uses: ALT-F4-LLC/setup-vorpal-action@main
        with:
          port: "23151"
          registry-backend-s3-bucket: "my-vorpal-registry"
          registry-backend: "s3"
          services: "agent,registry,worker"
          version: "0.4.0"
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_DEFAULT_REGION: us-west-2
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

> [!TIP]
> Pin `version` explicitly for reproducible, production CI runs. Omit it to always install the latest release for convenience or local development.

## Inputs

| Input                        | Description                                                                          | Required | Default                 |
| ---------------------------- | ------------------------------------------------------------------------------------ | -------- | ----------------------- |
| `github-token`               | Token used to authenticate `gh attestation verify` when installing a released binary | false    | `${{ github.token }}`   |
| `port`                       | Port for vorpal services                                                             | false    | `23151`                 |
| `registry-backend-s3-bucket` | S3 bucket name for s3 backend                                                        | false    | -                       |
| `registry-backend`           | Registry backend to use (local, s3)                                                  | false    | `local`                 |
| `services`                   | Services to start (comma-separated)                                                  | false    | `agent,registry,worker` |
| `version`                    | Version of Vorpal to install (e.g., 0.4.0)                                           | false    | latest release          |

## Environment Variables

When using the S3 registry backend, the following environment variables are required:

- `AWS_ACCESS_KEY_ID`: AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key
- `AWS_DEFAULT_REGION`: AWS region

## Architecture Support

The action supports the following architectures:

- **Linux**: x86_64, aarch64
- **macOS**: x86_64, aarch64

## Binary Integrity Verification

When installing a released Vorpal binary (`use-local-build: false`, the default), the
action verifies the downloaded binary's
[GitHub artifact attestation](https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds)
via the `gh` CLI before marking it executable. Verification is pinned to the
`ALT-F4-LLC/vorpal` release workflow and fails closed on any error (tampered binary,
missing attestation, wrong signer, or `gh` unavailable).

- Requires the `gh` CLI on the runner (pre-installed on GitHub-hosted runners) and
  network egress to GitHub's attestation API.
- Requires a token with permission to read attestations on `ALT-F4-LLC/vorpal`; the
  `github-token` input defaults to `${{ github.token }}`.
- The minimum supported Vorpal version is `0.2.2` (the oldest release with a
  published attestation). Pinning an older version fails the install.

## What the Action Does

1. **Install Vorpal**: Downloads the Vorpal binary from GitHub releases, installs it to `~/.vorpal/bin/vorpal`, and adds `~/.vorpal/bin` to `PATH`
2. **Setup Directories**: Creates necessary directories under `/var/lib/vorpal/` with proper permissions
3. **Generate Keys**: Creates cryptographic keys required by Vorpal
4. **Start Services**: Launches the specified Vorpal services in the background
5. **Cleanup**: Automatically stops services when the workflow completes

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
npm install
```

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/ALT-F4-LLC/setup-vorpal-action/issues) on GitHub.
