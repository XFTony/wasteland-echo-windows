param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [ValidateRange(64, 4096)]
  [int]$MaxWidth = 1200,

  [ValidateRange(0, 64)]
  [int]$Padding = 8,

  [ValidateRange(40, 240)]
  [int]$TransparentDominance = 120,

  [ValidateRange(0, 80)]
  [int]$OpaqueDominance = 24
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = [System.IO.Path]::GetDirectoryName($resolvedOutput)
if (-not [string]::IsNullOrWhiteSpace($outputDirectory)) {
  [System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
}

$source = [System.Drawing.Bitmap]::FromFile($resolvedInput)
$working = [System.Drawing.Bitmap]::new(
  $source.Width,
  $source.Height,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$graphics = [System.Drawing.Graphics]::FromImage($working)
$graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$graphics.DrawImage($source, 0, 0, $source.Width, $source.Height)
$graphics.Dispose()
$source.Dispose()

$rect = [System.Drawing.Rectangle]::new(0, 0, $working.Width, $working.Height)
$data = $working.LockBits(
  $rect,
  [System.Drawing.Imaging.ImageLockMode]::ReadWrite,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$byteCount = [Math]::Abs($data.Stride) * $working.Height
$pixels = [byte[]]::new($byteCount)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $pixels, 0, $byteCount)

$minX = $working.Width
$minY = $working.Height
$maxX = -1
$maxY = -1
$dominanceSpan = [Math]::Max(1, $TransparentDominance - $OpaqueDominance)

for ($y = 0; $y -lt $working.Height; $y += 1) {
  $row = $y * $data.Stride
  for ($x = 0; $x -lt $working.Width; $x += 1) {
    $offset = $row + $x * 4
    $blue = [double]$pixels[$offset]
    $green = [double]$pixels[$offset + 1]
    $red = [double]$pixels[$offset + 2]
    $sourceAlpha = [double]$pixels[$offset + 3]
    $dominance = [Math]::Min($red, $blue) - $green
    $coverage = if ($dominance -le $OpaqueDominance) {
      1.0
    } elseif ($dominance -ge $TransparentDominance) {
      0.0
    } else {
      1 - (($dominance - $OpaqueDominance) / $dominanceSpan)
    }
    $coverage = $coverage * $coverage * (3 - 2 * $coverage)
    $newAlpha = [Math]::Min($sourceAlpha, [Math]::Round(255 * $coverage))

    if ($newAlpha -gt 0 -and $coverage -lt 0.999) {
      $spill = [Math]::Max(0, [Math]::Min($red, $blue) - $green)
      $red = [Math]::Max(0, $red - $spill * 0.82)
      $blue = [Math]::Max(0, $blue - $spill * 0.82)
    }

    $pixels[$offset] = [byte][Math]::Round($blue)
    $pixels[$offset + 1] = [byte][Math]::Round($green)
    $pixels[$offset + 2] = [byte][Math]::Round($red)
    $pixels[$offset + 3] = [byte]$newAlpha

    if ($newAlpha -ge 8) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}

[System.Runtime.InteropServices.Marshal]::Copy($pixels, 0, $data.Scan0, $byteCount)
$working.UnlockBits($data)

if ($maxX -lt $minX -or $maxY -lt $minY) {
  $working.Dispose()
  throw "No opaque subject remained after chroma-key processing."
}

$cropX = [Math]::Max(0, $minX - $Padding)
$cropY = [Math]::Max(0, $minY - $Padding)
$cropRight = [Math]::Min($working.Width - 1, $maxX + $Padding)
$cropBottom = [Math]::Min($working.Height - 1, $maxY + $Padding)
$cropWidth = $cropRight - $cropX + 1
$cropHeight = $cropBottom - $cropY + 1
$targetWidth = [Math]::Min($MaxWidth, $cropWidth)
$targetHeight = [Math]::Max(1, [int][Math]::Round($cropHeight * $targetWidth / $cropWidth))

$output = [System.Drawing.Bitmap]::new(
  $targetWidth,
  $targetHeight,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$outputGraphics = [System.Drawing.Graphics]::FromImage($output)
$outputGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$outputGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$outputGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$outputGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$sourceRect = [System.Drawing.Rectangle]::new($cropX, $cropY, $cropWidth, $cropHeight)
$targetRect = [System.Drawing.Rectangle]::new(0, 0, $targetWidth, $targetHeight)
$outputGraphics.DrawImage($working, $targetRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
$outputGraphics.Dispose()
$working.Dispose()
$output.Save($resolvedOutput, [System.Drawing.Imaging.ImageFormat]::Png)
$output.Dispose()

$check = [System.Drawing.Bitmap]::FromFile($resolvedOutput)
$cornerAlpha = $check.GetPixel(0, 0).A
$summary = [pscustomobject]@{
  Input = $resolvedInput
  Output = $resolvedOutput
  Width = $check.Width
  Height = $check.Height
  PixelFormat = $check.PixelFormat.ToString()
  CornerAlpha = $cornerAlpha
  Bytes = (Get-Item -LiteralPath $resolvedOutput).Length
}
$check.Dispose()
$summary | Format-List
