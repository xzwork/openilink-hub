# Publishing a GitHub Release

This fork follows the upstream GitHub Actions and GoReleaser release process. A version tag publishes native archives, a GitHub Release, and multi-architecture container images.

## Repository Setup

Allow Actions to write repository contents and packages. Add these Actions secrets before publishing:

- `DOCKERHUB_USERNAME`: Docker Hub account that can push `xzwork/openilink-hub`.
- `DOCKERHUB_TOKEN`: Docker Hub access token for that account.

GHCR authentication uses the workflow's built-in `GITHUB_TOKEN`.

## Publish a Release

After tests pass and the release commit is on `main`, create and push a new semantic-version tag:

```bash
git tag -a v0.1.1 -m "Release v0.1.1"
git push origin v0.1.1
```

Tags matching `v*` trigger `.github/workflows/release.yml`. The workflow builds the frontend, macOS binaries, Linux AMD64/ARM64 binaries, checksums, and `xzwork/openilink-hub` images on GHCR and Docker Hub. Do not move an existing release tag; publish a new patch version instead.

Manual runs from **Actions → Release → Run workflow** use GoReleaser snapshot mode and do not publish a formal GitHub Release.

## Install From This Fork

After the Release job succeeds, install the latest native release with:

```bash
curl -fsSL https://raw.githubusercontent.com/xzwork/openilink-hub/main/install.sh | sh
```

The script detects macOS/Linux and CPU architecture, queries this fork's latest Release, and installs `oih` into `/usr/local/bin`. Select a specific release when needed:

```bash
curl -fsSL https://raw.githubusercontent.com/xzwork/openilink-hub/main/install.sh \
  | OIH_VERSION=v0.1.1 sh
```

Linux ARM64 native installation remains disabled by the upstream script; use `ghcr.io/xzwork/openilink-hub:latest` on that platform.
