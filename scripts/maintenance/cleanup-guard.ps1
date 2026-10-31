param(
    [ValidateSet('Backup', 'Shadow', 'Apply')]
    [string]$Mode,
    [string]$Workspace = '',
    [string]$PlanPath = '',
    [string]$ShadowPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if ([string]::IsNullOrWhiteSpace($Workspace)) { $Workspace = $repositoryRoot }
$workspaceRoot = [IO.Path]::GetFullPath($Workspace).TrimEnd([IO.Path]::DirectorySeparatorChar)
if ([string]::IsNullOrWhiteSpace($PlanPath)) { $PlanPath = Join-Path $repositoryRoot 'docs/cleanup/retirement-plan.json' }
$planFile = [IO.Path]::GetFullPath($PlanPath)
$plan = [IO.File]::ReadAllText($planFile) | ConvertFrom-Json
$planSha = (Get-FileHash -LiteralPath $planFile -Algorithm SHA256).Hash.ToLowerInvariant()
if ($plan.format -ne 1 -or $plan.blockers.Count -ne 0) { throw 'Plan must be supported and have no remaining dependency blockers.' }
$proofDirectory = Join-Path $repositoryRoot 'output/card-layout-cleanup'
[IO.Directory]::CreateDirectory($proofDirectory) | Out-Null
$backupDirectory = if ([IO.Path]::IsPathRooted($plan.backupDirectory)) { [IO.Path]::GetFullPath($plan.backupDirectory) } else { [IO.Path]::GetFullPath((Join-Path $repositoryRoot $plan.backupDirectory)) }
$backupFolderName = 'Wechat games-' + [char]0x6e05 + [char]0x7406 + [char]0x5907 + [char]0x4efd
$expectedBackup = [IO.Path]::GetFullPath((Join-Path (Join-Path $repositoryRoot '..') ($backupFolderName + '/2026-10-31-card-layout-cleanup')))
if ($backupDirectory -ne $expectedBackup) { throw 'Unexpected backup destination.' }
$archivePath = Join-Path $backupDirectory 'retired-files.zip'
$utf8 = [Text.UTF8Encoding]::new($false)

function Resolve-SafeFile([string]$Base, [string]$Relative) {
    if ([IO.Path]::IsPathRooted($Relative) -or $Relative -match '(^|[\/])\.\.([\/]|$)' -or $Relative -match '(^|[\/])(?:\.git|\.codex|\.agents|node_modules|saves|user-data|userdata)([\/]|$)' -or $Relative -match 'wasteland_echo_save|save-backup') {
        throw "Unsafe cleanup relative path: $Relative"
    }
    $resolved = [IO.Path]::GetFullPath((Join-Path $Base $Relative))
    if (-not $resolved.StartsWith($Base + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Resolved cleanup file escaped workspace.' }
    $cursor = $resolved
    while ($cursor.Length -gt $Base.Length) {
        if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Cleanup never follows a reparse point.' }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
    return $resolved
}

function Confirm-WindowsTemplates {
    $hashes = @{
        'windows_debug_x86_64.exe' = '51498b72b3a237f882ebd7d1787f06a4bc1eaf0572daab93837adcfd3cfdc107'
        'windows_release_x86_64.exe' = 'd34d36f3be1a6c49c56525ae86469b92e4f417ddf0b43cf00dd80c385c4b0562'
    }
    foreach ($name in $hashes.Keys) {
        $template = Join-Path $repositoryRoot ('output/godot-migration/toolchain/templates/' + $name)
        if ((Get-FileHash -LiteralPath $template -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hashes[$name]) { throw 'Current Windows template must remain intact.' }
    }
}

function Confirm-Sources([string]$Base, [bool]$TrackedOnly) {
    $checked = @()
    foreach ($record in $plan.files) {
        if ($TrackedOnly -and -not $record.gitBlob) { continue }
        $resolved = Resolve-SafeFile $Base $record.path
        if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) { throw "Cleanup source is missing: $($record.path)" }
        $file = Get-Item -LiteralPath $resolved -Force
        if ($file.Length -ne $record.bytes -or (Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash.ToLowerInvariant() -ne $record.sha256) {
            if (-not $TrackedOnly) { throw "Source changed after audit: $($record.path)" }
            $blob = (& git -C $Base hash-object ('--path=' + $record.path) -- $resolved).Trim()
            if ($LASTEXITCODE -ne 0 -or $blob -ne $record.gitBlob) { throw "Shadow differs beyond Git line-ending normalization: $($record.path)" }
        }
        $checked += [pscustomobject]@{record=$record;absolute=$resolved}
    }
    return $checked
}

if ($Mode -eq 'Backup') {
    Confirm-WindowsTemplates
    $checked = @(Confirm-Sources $workspaceRoot $false)
    [IO.Directory]::CreateDirectory($backupDirectory) | Out-Null
    if (Test-Path -LiteralPath $archivePath) { throw 'Backup already exists; it will never be overwritten.' }
    Add-Type -AssemblyName System.IO.Compression
    $zipStream = [IO.File]::Open($archivePath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $archive = [IO.Compression.ZipArchive]::new($zipStream, [IO.Compression.ZipArchiveMode]::Create, $false)
    try {
        foreach ($entry in $checked) {
            $zipEntry = $archive.CreateEntry($entry.record.path, [IO.Compression.CompressionLevel]::Fastest)
            $input = [IO.File]::OpenRead($entry.absolute)
            $output = $zipEntry.Open()
            try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose() }
        }
    } finally { $archive.Dispose(); $zipStream.Dispose() }
    $readerStream = [IO.File]::OpenRead($archivePath)
    $reader = [IO.Compression.ZipArchive]::new($readerStream, [IO.Compression.ZipArchiveMode]::Read, $false)
    $verified = 0
    try {
        if ($reader.Entries.Count -ne $checked.Count) { throw 'ZIP entry count does not match the exact cleanup allowlist.' }
        foreach ($entry in $checked) {
            $zipEntry = $reader.GetEntry($entry.record.path)
            if ($null -eq $zipEntry -or $zipEntry.Length -ne $entry.record.bytes) { throw 'ZIP entry missing or size changed.' }
            $stream = $zipEntry.Open()
            $digest = [Security.Cryptography.SHA256]::Create()
            try { $hash = [BitConverter]::ToString($digest.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() } finally { $digest.Dispose(); $stream.Dispose() }
            if ($hash -ne $entry.record.sha256) { throw 'ZIP entry SHA256 mismatch.' }
            $verified++
        }
    } finally { $reader.Dispose(); $readerStream.Dispose() }
    $proof = [ordered]@{planSha256=$planSha;verified=$true;entries=$verified;archive=$archivePath;archiveSha256=(Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant();archiveBytes=(Get-Item -LiteralPath $archivePath).Length;sourceBytes=($plan.files | Measure-Object bytes -Sum).Sum}
    [IO.File]::WriteAllText((Join-Path $proofDirectory 'backup-proof.json'), ($proof | ConvertTo-Json -Depth 4) + "`n", $utf8)
    Copy-Item -LiteralPath $planFile -Destination (Join-Path $backupDirectory 'retirement-plan.json')
    [IO.File]::WriteAllText((Join-Path $backupDirectory 'verification.json'), ($proof | ConvertTo-Json -Depth 4) + "`n", $utf8)
    $proof | ConvertTo-Json -Depth 4
    exit
}

if ($Mode -eq 'Shadow') {
    if ([string]::IsNullOrWhiteSpace($ShadowPath)) { throw 'Shadow mode requires the isolated worktree path.' }
    $shadowRoot = [IO.Path]::GetFullPath($ShadowPath)
    $expectedShadow = [IO.Path]::GetFullPath((Join-Path $repositoryRoot 'output/card-layout-cleanup/shadow'))
    if ($shadowRoot -ne $expectedShadow) { throw 'Unexpected shadow worktree target.' }
    $checked = @(Confirm-Sources $shadowRoot $true)
    foreach ($entry in $checked) { Remove-Item -LiteralPath $entry.absolute -Force }
    [ordered]@{mode='shadow';removedTrackedFiles=$checked.Count;planSha256=$planSha} | ConvertTo-Json
    exit
}

if ($Mode -ne 'Apply') { throw 'An explicit maintenance mode is required.' }
if ($workspaceRoot -ne $repositoryRoot) { throw 'Actual cleanup applies only to the verified primary workspace.' }
$backup = [IO.File]::ReadAllText((Join-Path $proofDirectory 'backup-proof.json')) | ConvertFrom-Json
$shadow = [IO.File]::ReadAllText((Join-Path $proofDirectory 'shadow-proof.json')) | ConvertFrom-Json
if (-not $backup.verified -or $backup.planSha256 -ne $planSha -or -not $shadow.nativePassed -or -not $shadow.legacyPassed -or $shadow.planSha256 -ne $planSha) { throw 'Matching verified ZIP and deleted-shadow regression proofs are required.' }
if ((Get-FileHash -LiteralPath $backup.archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $backup.archiveSha256) { throw 'Verified ZIP changed after backup.' }
Confirm-WindowsTemplates
$checked = @(Confirm-Sources $workspaceRoot $false)
foreach ($entry in $checked) { Remove-Item -LiteralPath $entry.absolute -Force }
$receipt = [ordered]@{date='2026-10-31';planSha256=$planSha;removedFiles=$checked.Count;removedBytes=($plan.files | Measure-Object bytes -Sum).Sum;backupArchive=$backup.archive;backupSha256=$backup.archiveSha256;trackedFiles=@($plan.files | Where-Object gitBlob).Count;shadowNativePassed=$true;shadowLegacyPassed=$true}
[IO.File]::WriteAllText((Join-Path $proofDirectory 'cleanup-receipt.json'), ($receipt | ConvertTo-Json -Depth 4) + "`n", $utf8)
$receipt | ConvertTo-Json -Depth 4
