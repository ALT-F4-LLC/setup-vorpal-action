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
        with:
          version: "nightly"
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
          version: "nightly"
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_DEFAULT_REGION: us-west-2
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## Inputs

| Input                        | Description                                  | Required | Default                 |
| ---------------------------- | -------------------------------------------- | -------- | ----------------------- |
| `port`                       | Port for vorpal services                     | false    | `23151`                 |
| `registry-backend-s3-bucket` | S3 bucket name for s3 backend                | false    | -                       |
| `registry-backend`           | Registry backend to use (local, s3)          | false    | `local`                 |
| `services`                   | Services to start (comma-separated)          | false    | `agent,registry,worker` |
| `version`                    | Version of Vorpal to install (e.g., nightly) | true     | -                       |

## Environment Variables

When using the S3 registry backend, the following environment variables are required:

- `AWS_ACCESS_KEY_ID`: AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key
- `AWS_DEFAULT_REGION`: AWS region

## Architecture Support

The action supports the following architectures:

- **Linux**: x86_64, aarch64
- **macOS**: x86_64, aarch64

## What the Action Does

1. **Install Vorpal**: Downloads and installs the Vorpal binary from GitHub releases
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
npm run bundle
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
