param(
    [switch]$ResumeDownload
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$workspaceDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$toolchainDirectory = Join-Path $workspaceDirectory 'output/godot-migration/toolchain'
$archiveName = 'Godot_v4.7.2-stable_export_templates.tpz'
$archivePath = Join-Path $toolchainDirectory $archiveName
$partialPath = $archivePath + '.part'
$templateDirectory = [IO.Path]::GetFullPath((Join-Path $toolchainDirectory 'templates'))
$expectedBytes = [long]1281349702
$expectedSha256 = 'f298490b8d44d934be425a5a65a51bf15f422428b229a06a6e11d9ffea248011'
$officialUrl = 'https://github.com/godotengine/godot-builds/releases/download/4.7.2-stable/Godot_v4.7.2-stable_export_templates.tpz'
$expectedVersion = '4.7.2.stable'
$requiredEntries = @(
    'templates/windows_debug_x86_64.exe',
    'templates/windows_release_x86_64.exe',
    'templates/version.txt'
)

# The full archive contains other platforms; retain only this explicit Windows allowlist.
$allowedPrefix = [IO.Path]::GetFullPath($toolchainDirectory).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
if (-not $templateDirectory.StartsWith($allowedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The template destination must remain inside the project toolchain directory.'
}
[IO.Directory]::CreateDirectory($toolchainDirectory) | Out-Null

if (-not [IO.File]::Exists($archivePath)) {
    if ($ResumeDownload) {
        & curl.exe --location --fail --continue-at - --retry 0 --max-time 600 --connect-timeout 15 --output $partialPath $officialUrl
        if ($LASTEXITCODE -ne 0) {
            throw "Official template download stopped with curl exit $LASTEXITCODE. The partial archive was retained for another explicit resume."
        }
    }
    if (-not [IO.File]::Exists($partialPath)) {
        throw 'No template archive is present. Run this script with -ResumeDownload to resume the official download.'
    }
    $candidatePath = $partialPath
} else {
    $candidatePath = $archivePath
}

$candidate = Get-Item -LiteralPath $candidatePath
if ($candidate.Length -ne $expectedBytes) {
    throw "Template archive is incomplete: $($candidate.Length) bytes; expected $expectedBytes. Resume the existing partial file."
}
$archiveSha256 = (Get-FileHash -LiteralPath $candidatePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($archiveSha256 -ne $expectedSha256) {
    throw 'Template archive SHA256 does not match the verified official release. Nothing was extracted.'
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($candidatePath)
$files = [Collections.Generic.List[object]]::new()
try {
    $entries = @{}
    foreach ($name in $requiredEntries) {
        $matchingEntries = @($archive.Entries | Where-Object { $_.FullName -ceq $name })
        if ($matchingEntries.Count -ne 1) {
            throw "Expected exactly one official template entry: $name"
        }
        $entries[$name] = $matchingEntries[0]
    }
    $reader = [IO.StreamReader]::new($entries['templates/version.txt'].Open())
    try {
        $version = $reader.ReadToEnd().Trim()
    } finally {
        $reader.Dispose()
    }
    if ($version -ne $expectedVersion) {
        throw "Template version mismatch: $version; expected $expectedVersion."
    }
    [IO.Directory]::CreateDirectory($templateDirectory) | Out-Null
    foreach ($name in $requiredEntries) {
        $filename = [IO.Path]::GetFileName($name)
        $destination = [IO.Path]::GetFullPath((Join-Path $templateDirectory $filename))
        $destinationPrefix = $templateDirectory.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
        if (-not $destination.StartsWith($destinationPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'The extracted file escaped the explicit destination.'
        }
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entries[$name], $destination, $true)
        $file = Get-Item -LiteralPath $destination
        $files.Add([ordered]@{
            file = $filename
            bytes = $file.Length
            sha256 = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
        })
    }
} finally {
    $archive.Dispose()
}

if ($candidatePath -eq $partialPath) {
    Move-Item -LiteralPath $partialPath -Destination $archivePath
}
$report = [ordered]@{
    version = $version
    officialUrl = $officialUrl
    archive = $archiveName
    archiveBytes = $expectedBytes
    archiveSha256 = $archiveSha256
    archiveVerified = $true
    extractedDirectory = 'output/godot-migration/toolchain/templates'
    extractedFiles = @($files.ToArray())
    verifiedAtUtc = [DateTime]::UtcNow.ToString('o')
}
$reportPath = Join-Path $toolchainDirectory 'windows-template-verification.json'
$reportText = ($report | ConvertTo-Json -Depth 6) + "`n"
[IO.File]::WriteAllText($reportPath, $reportText.Replace("`r`n", "`n"), [Text.UTF8Encoding]::new($false))
$report | ConvertTo-Json -Depth 6
