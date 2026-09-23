param(
  [Parameter(Mandatory = $true)][string]$Artifact,
  [string]$CertificateThumbprint,
  [string]$PfxPath,
  [string]$TimestampUrl = "http://timestamp.digicert.com"
)

$ErrorActionPreference = "Stop"
$resolvedArtifact = (Resolve-Path -LiteralPath $Artifact).Path
$signtool = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
  Where-Object FullName -Match '\\x64\\' |
  Sort-Object FullName -Descending |
  Select-Object -First 1
if (-not $signtool) { throw "signtool.exe was not found in the Windows SDK" }

if ($CertificateThumbprint) {
  & $signtool.FullName sign /sha1 $CertificateThumbprint /fd SHA256 /tr $TimestampUrl /td SHA256 $resolvedArtifact
} elseif ($PfxPath) {
  $resolvedPfx = (Resolve-Path -LiteralPath $PfxPath).Path
  if (-not $env:WASTELAND_SIGNING_PASSWORD) { throw "Set WASTELAND_SIGNING_PASSWORD for the PFX without writing it to project files" }
  & $signtool.FullName sign /f $resolvedPfx /p $env:WASTELAND_SIGNING_PASSWORD /fd SHA256 /tr $TimestampUrl /td SHA256 $resolvedArtifact
} else {
  throw "Provide CertificateThumbprint or PfxPath. This script never creates or stores a certificate."
}
if ($LASTEXITCODE -ne 0) { throw "signtool failed with exit code $LASTEXITCODE" }
& $signtool.FullName verify /pa /v $resolvedArtifact
