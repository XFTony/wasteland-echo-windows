param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath
)

$ErrorActionPreference = "Stop"
$resolvedInstaller = (Resolve-Path -LiteralPath $InstallerPath).Path
$uninstallRoot = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall"
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$productName = [string]([char]0x8352) + [char]0x539F + [char]0x56DE + [char]0x54CD
$expectedInstallLocation = [IO.Path]::GetFullPath((Join-Path $localAppData $productName))
if (-not $expectedInstallLocation.StartsWith($localAppData, [StringComparison]::OrdinalIgnoreCase)) {
  throw "The expected installation directory escaped LocalApplicationData."
}
$appProcess = $null
$entry = $null
$installLocation = $null
$appExe = $null

function Get-WastelandUninstallEntry {
  Get-ChildItem -Path $uninstallRoot -ErrorAction SilentlyContinue |
    Get-ItemProperty |
    Where-Object { $_.DisplayName -eq $productName -or $_.DisplayName -like "*Wasteland Echo*" } |
    Select-Object -First 1
}

if ((Get-WastelandUninstallEntry) -or (Test-Path -LiteralPath $expectedInstallLocation)) {
  throw "An existing Wasteland Echo installation was found. The smoke test will not overwrite it."
}

try {
  $installProcess = Start-Process -FilePath $resolvedInstaller -ArgumentList "/S" -Wait -PassThru -WindowStyle Hidden
  if ($installProcess.ExitCode -ne 0) { throw "Installer exited with code $($installProcess.ExitCode)" }

  for ($attempt = 0; $attempt -lt 8 -and -not $entry; $attempt += 1) {
    Start-Sleep -Milliseconds 250
    $entry = Get-WastelandUninstallEntry
  }
  $installLocation = if ($entry -and $entry.InstallLocation) { ([string]$entry.InstallLocation).Trim('"') } else { $expectedInstallLocation }
  if (-not $installLocation -or -not (Test-Path -LiteralPath $installLocation -PathType Container)) {
    throw "The registered installation directory is missing: $installLocation"
  }

  $appExe = Get-ChildItem -LiteralPath $installLocation -Filter "*.exe" -File |
    Where-Object { $_.Name -notmatch "(?i)uninstall|unins" } |
    Select-Object -First 1
  if (-not $appExe) { throw "The installed game executable was not found in $installLocation" }

  $appProcess = Start-Process -FilePath $appExe.FullName -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 3
  if ($appProcess.HasExited) { throw "The installed game exited during the startup smoke window with code $($appProcess.ExitCode)." }
} finally {
  if ($appProcess -and -not $appProcess.HasExited) {
    Stop-Process -Id $appProcess.Id -Force -ErrorAction SilentlyContinue
    [void]$appProcess.WaitForExit(5000)
  }
  $entry = Get-WastelandUninstallEntry
  $uninstallCommand = if ($entry) { [string]$entry.UninstallString } else { [string](Join-Path $expectedInstallLocation "uninstall.exe") }
  if ($uninstallCommand) {
    $uninstaller = if ($uninstallCommand -match '^"([^"]+\.exe)"') { $Matches[1] }
      elseif ($uninstallCommand -match '^(.+?\.exe)') { $Matches[1] }
      else { $null }
    if ($uninstaller -and (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
      $uninstallProcess = Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait -PassThru -WindowStyle Hidden
      if ($uninstallProcess.ExitCode -ne 0) { throw "Uninstaller exited with code $($uninstallProcess.ExitCode)" }
      Start-Sleep -Seconds 2
    }
  }
}

$remainingEntry = Get-WastelandUninstallEntry
$installDirectoryExists = [bool]($installLocation -and (Test-Path -LiteralPath $installLocation))
if ($remainingEntry -or $installDirectoryExists) {
  throw "Uninstall verification failed. Registry entry or installation directory remains."
}

[pscustomobject]@{
  Installer = $resolvedInstaller
  InstalledVersion = if ($entry) { [string]$entry.DisplayVersion } elseif ($appExe) { $appExe.VersionInfo.ProductVersion } else { $null }
  Application = if ($appExe) { $appExe.Name } else { $null }
  StartupSeconds = 3
  UninstallEntryRemoved = $true
  InstallDirectoryRemoved = $true
  RegistryEntryObserved = [bool]$entry
} | ConvertTo-Json -Compress
