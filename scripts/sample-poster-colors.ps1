Add-Type -AssemblyName System.Drawing
$path = Join-Path $PSScriptRoot "..\public\susongseon-game-poster.png"
if (-not (Test-Path $path)) {
  Write-Error "Missing: $path"
  exit 1
}
$bmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $path))
$w = $bmp.Width
$h = $bmp.Height

function Hex([System.Drawing.Color]$c) {
  return ('#{0:X2}{1:X2}{2:X2}' -f $c.R, $c.G, $c.B)
}

function Avg($points) {
  $rs = 0; $gs = 0; $bs = 0; $n = $points.Count
  foreach ($p in $points) {
    $c = $bmp.GetPixel($p.x, $p.y)
    $rs += $c.R; $gs += $c.G; $bs += $c.B
  }
  $r = [int]($rs / $n); $g = [int]($gs / $n); $b = [int]($bs / $n)
  return [pscustomobject]@{ R = $r; G = $g; B = $b; Hex = ('#{0:X2}{1:X2}{2:X2}' -f $r, $g, $b) }
}

# 우주 배경: 상단 좌·우 (제목/중앙 노란색 피함)
$spacePts = @(
  @{ x = [int]($w * 0.06); y = [int]($h * 0.06) },
  @{ x = [int]($w * 0.12); y = [int]($h * 0.14) },
  @{ x = [int]($w * 0.20); y = [int]($h * 0.22) },
  @{ x = [int]($w * 0.94); y = [int]($h * 0.06) },
  @{ x = [int]($w * 0.88); y = [int]($h * 0.14) },
  @{ x = [int]($w * 0.80); y = [int]($h * 0.22) },
  @{ x = [int]($w * 0.06); y = [int]($h * 0.28) },
  @{ x = [int]($w * 0.94); y = [int]($h * 0.28) }
) | ForEach-Object {
  [pscustomobject]@{ x = [Math]::Min([Math]::Max($_.x, 0), $w - 1); y = [Math]::Min([Math]::Max($_.y, 0), $h - 1) }
}
$spaceAvg = Avg $spacePts

# 콘솔 패널(회색-라벤더): 하단 중앙 평면 부분 (손/오렌지 버튼 피해 x 중앙대)
$tablePts = @()
foreach ($y in @( [int]($h * 0.76), [int]($h * 0.82), [int]($h * 0.88) )) {
  foreach ($x in @( [int]($w * 0.46), [int]($w * 0.50), [int]($w * 0.54) )) {
    $tablePts += [pscustomobject]@{ x = [Math]::Min($x, $w - 1); y = [Math]::Min($y, $h - 1) }
  }
}
$tableAvg = Avg $tablePts

Write-Output "Image size: ${w}x${h}"
Write-Output ""
Write-Output "=== 우주(배경) 대표색 — 상단 9점 평균 ==="
Write-Output $spaceAvg
Write-Output ""
Write-Output "=== 테이블/콘솔 패널 — 하단 중앙 9점 평균 ==="
Write-Output $tableAvg
Write-Output ""
Write-Output "개별 샘플 (우주):"
foreach ($p in $spacePts) {
  $c = $bmp.GetPixel($p.x, $p.y)
  Write-Output ("  ({0},{1}) {2}" -f $p.x, $p.y, (Hex $c))
}
Write-Output "개별 샘플 (테이블):"
foreach ($p in $tablePts) {
  $c = $bmp.GetPixel($p.x, $p.y)
  Write-Output ("  ({0},{1}) {2}" -f $p.x, $p.y, (Hex $c))
}

$bmp.Dispose()
