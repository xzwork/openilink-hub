# Publishing a GitHub Release

This fork follows the upstream GitHub Actions and GoReleaser release process for native archives. A version tag publishes binaries directly to a GitHub Release; no container images are built or published.

## Repository Setup

Allow Actions to write repository contents. No Docker Hub, registry credentials, or custom repository secrets are required; publishing uses the workflow's built-in `GITHUB_TOKEN`.

## Publish a Release

After tests pass and the release commit is on `main`, create and push a new semantic-version tag:

```bash
git tag -a v0.1.4 -m "Release v0.1.4"
git push origin v0.1.4
```

Tags matching `v*` trigger `.github/workflows/release.yml`. The workflow builds the frontend, macOS binaries, Linux AMD64/ARM64 binaries, checksums, and the GitHub Release assets. Do not move an existing release tag; publish a new patch version instead.

Manual runs from **Actions → Release → Run workflow** use GoReleaser snapshot mode and do not publish a formal GitHub Release.

## Install From This Fork

After the Release job succeeds, install the latest native release with:

```bash
curl -fsSL https://raw.githubusercontent.com/xzwork/openilink-hub/main/install.sh | sh
```

The script detects macOS/Linux and CPU architecture, queries this fork's latest Release, and installs `oih` into `/usr/local/bin`. Select a specific release when needed:

```bash
curl -fsSL https://raw.githubusercontent.com/xzwork/openilink-hub/main/install.sh \
  | OIH_VERSION=v0.1.4 sh
```

Linux ARM64 native installation remains disabled by the upstream script because of the Silk/CGO limitation.
