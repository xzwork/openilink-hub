# Publishing a GitHub Release

The release workflow publishes native binaries only; it does not require Docker or registry credentials.

## Prepare a Release

Run the relevant tests, commit all release changes, and push the target branch. Create an annotated semantic-version tag and push it:

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

Tags matching `v*` trigger `.github/workflows/release.yml`. The workflow builds the frontend once, embeds it into each Go binary, and publishes these archives:

- `openilink-hub_<version>_linux_amd64.tar.gz`
- `openilink-hub_<version>_darwin_amd64.tar.gz`
- `openilink-hub_<version>_darwin_arm64.tar.gz`
- `checksums.txt`

Linux ARM64 is intentionally excluded because the native Silk/CGO build is not yet supported by `install.sh`.

No repository secrets are required; the workflow uses the automatically provided `GITHUB_TOKEN` with `contents: write` permission.

## Install From a Fork

After the Release workflow succeeds, install the latest release from this fork:

```bash
curl -fsSL https://raw.githubusercontent.com/xzwork/openilink-hub/main/install.sh | sh
```

`install.sh` queries `xzwork/openilink-hub` for its latest GitHub Release and downloads the archive matching the host OS and architecture. To install a specific release instead of `latest`, set `OIH_VERSION`:

```bash
curl -fsSL https://raw.githubusercontent.com/xzwork/openilink-hub/main/install.sh \
  | OIH_VERSION=v0.1.0 sh
```

Set `OIH_REPO=OWNER/REPO` in the pipeline when testing releases from another fork.

## Validate Without Publishing

Run the workflow manually from **Actions → Release binaries → Run workflow**. Leave `release_tag` empty to build all supported archives as workflow artifacts without publishing. Enter an existing tag such as `v0.1.0` to build it and create or update that GitHub Release.

## Retry or Replace Assets

Re-running a tag workflow updates existing assets with `--clobber`. Do not move an already published tag to different source code; create a new patch version instead.
