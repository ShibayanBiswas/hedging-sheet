# Stops everything the dev and test commands leave behind, then deletes the build and test caches.
#   npm run clean:dev
# Only this project's tooling is stopped: Cursor, its MCP servers and your own browsers are left alone.
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot

$toolPatterns = @(
  "next[\\/]dist[\\/]bin", "\bnext (dev|start|build)\b", "playwright[\\/ ].*\btest\b", "\bvitest\b",
  "e2e-server", "test-run\.ts", "\blhci\b", "lighthouse", "mongodb-memory-server"
)
# Cursor, VS Code extensions and MCP servers are never stopped, whatever their command line says.
$editorPattern = "\\\.cursor\\|\\cursor\\resources\\|\\\.vscode\\|_npx\\|mcp"
$stopped = @()

Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object {
  $cmd = [string]$_.CommandLine
  if ($cmd -match $editorPattern) { return }
  $ours = $cmd -like "*$root*" -or ($toolPatterns | Where-Object { $cmd -match $_ })
  if ($ours) { Stop-Process -Id $_.ProcessId -Force; $stopped += "node $($_.ProcessId)" }
}

# Playwright's own browsers live under ms-playwright; mongod and the headless shell only ever come from the tests.
Get-CimInstance Win32_Process | Where-Object {
  $_.Name -in @("chrome-headless-shell.exe", "mongod.exe") -or ([string]$_.ExecutablePath -match "ms-playwright")
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; $stopped += "$($_.Name) $($_.ProcessId)" }

foreach ($port in 3000, 3001, 3005, 3006, 9323) {
  Get-NetTCPConnection -LocalPort $port -State Listen | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force; $stopped += "port $port"
  }
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
  foreach ($image in "mcr.microsoft.com/playwright", "mongo") {
    docker ps -q --filter "ancestor=$image" | ForEach-Object { docker stop $_ | Out-Null; $stopped += "docker $_" }
  }
}

$folders = ".next\cache", "test-results", "reports", "playwright-report", "coverage", "node_modules\.cache", ".lighthouseci"
foreach ($f in $folders) {
  $path = Join-Path $root $f
  if (Test-Path $path) { Remove-Item -Recurse -Force $path; Write-Output "Deleted $f" }
}

if ($stopped.Count) { Write-Output "Stopped: $($stopped -join ', ')" } else { Write-Output "Nothing was running." }
