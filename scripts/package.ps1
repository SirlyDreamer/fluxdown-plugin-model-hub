$ErrorActionPreference = 'Stop'
# Compatibility entry point; the Node packager also runs on Linux and macOS.
& node (Join-Path $PSScriptRoot 'package.cjs')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
