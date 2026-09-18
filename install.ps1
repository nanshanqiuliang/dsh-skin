<#
  dsh-skin 安装 / 更新 / 卸载脚本  （本文件必须保存为 UTF-8 with BOM，Windows PowerShell 5.1 才能正确读中文）

  用法（在 PowerShell 里）：
    powershell -ExecutionPolicy Bypass -File .\install.ps1                 # 安装或更新到 web profile
    powershell -ExecutionPolicy Bypass -File .\install.ps1 -Uninstall      # 卸载
    powershell -ExecutionPolicy Bypass -File .\install.ps1 -Profile web    # 指定别的 profile

  也可以直接双击同目录的「安装皮肤插件.cmd」。
#>
param(
  [string]$Profile = 'web',
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$enc = New-Object System.Text.UTF8Encoding($false)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$profileDir = Join-Path $dshHome "profiles\$Profile"
$manifestPath = Join-Path $profileDir 'package.json'
$target = Join-Path $profileDir 'node_modules\dsh-skin'
$packageName = 'dsh-skin'

Write-Host "dsh home    : $dshHome"
Write-Host "profile     : $profileDir"
Write-Host "plugin dest : $target"
Write-Host ''

if (-not (Test-Path $manifestPath)) {
  Write-Host "找不到 profile 的 package.json：$manifestPath" -ForegroundColor Red
  Write-Host '先运行一次 dsh（例如： dsh web）让它自动初始化 profile，再执行本脚本。' -ForegroundColor Yellow
  exit 1
}

function Read-Manifest {
  return (Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Write-Manifest($manifest) {
  $json = $manifest | ConvertTo-Json -Depth 12
  [System.IO.File]::WriteAllText($manifestPath, $json, $enc)
}

function Set-BundleEntry([bool]$present) {
  $manifest = Read-Manifest
  if ($manifest.PSObject.Properties.Name -notcontains 'dsh') {
    $manifest | Add-Member -NotePropertyName dsh -NotePropertyValue ([pscustomobject]@{})
  }
  if ($manifest.dsh.PSObject.Properties.Name -notcontains 'profile') {
    $manifest.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([pscustomobject]@{})
  }
  $profileNode = $manifest.dsh.profile
  $bundles = @($profileNode.bundles) | Where-Object { $_ -ne '' -and $_ -ne $null }
  if ($present) {
    if ($bundles -notcontains $packageName) { $bundles = @($bundles) + $packageName }
  } else {
    $bundles = @($bundles | Where-Object { $_ -ne $packageName })
  }
  if ($profileNode.PSObject.Properties.Name -contains 'bundles') { $profileNode.bundles = $bundles }
  else { $profileNode | Add-Member -NotePropertyName bundles -NotePropertyValue $bundles }
  if ($profileNode.PSObject.Properties.Name -notcontains 'patchReload') {
    $profileNode | Add-Member -NotePropertyName patchReload -NotePropertyValue 'live'
  }
  Write-Manifest $manifest
}

if ($Uninstall) {
  if (Test-Path $target) { Remove-Item $target -Recurse -Force; Write-Host '已删除插件文件。' -ForegroundColor Green }
  else { Write-Host '插件文件本来就不存在。' }
  Set-BundleEntry $false
  Write-Host '已从 profile 的 bundles 列表移除。' -ForegroundColor Green
  Write-Host "重新启动 dsh 后生效。皮肤素材仍保留在 $(Join-Path $dshHome 'skins')" -ForegroundColor Cyan
  exit 0
}

New-Item -ItemType Directory -Force -Path (Join-Path $target 'lib') | Out-Null
foreach ($file in @('package.json', 'cordis.patch.yml')) {
  Copy-Item (Join-Path $here $file) (Join-Path $target $file) -Force
}
foreach ($file in @('index.js', 'client.js')) {
  Copy-Item (Join-Path $here "lib\$file") (Join-Path $target "lib\$file") -Force
}
Write-Host '插件文件已复制。' -ForegroundColor Green

Set-BundleEntry $true
Write-Host '已写入 profile 的 bundles 列表。' -ForegroundColor Green

$skins = Join-Path $dshHome 'skins'
if (-not (Test-Path $skins)) {
  New-Item -ItemType Directory -Force -Path $skins | Out-Null
  Write-Host "已创建皮肤文件夹：$skins" -ForegroundColor Cyan
}

Write-Host ''
Write-Host '安装完成！' -ForegroundColor Green
Write-Host '1) 重新启动 dsh（关掉正在运行的 dsh web，再重新运行 dsh web）'
Write-Host '2) 打开页面右下角的 🎨 面板切换皮肤'
Write-Host "3) 皮肤素材放在：$skins"