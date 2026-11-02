# Stops what this repo's dev and test commands leave behind, then deletes the build and test caches.
#   npm run clean:dev
# Other apps on this laptop keep running, including their own node, Playwright browsers and mongod. A process is stopped only if:
#   - its command line names this folder, or it is mongodb-memory-server or the mongod that package downloads, or
#   - it was started by such a process, as the browsers a Playwright run opens are.
# A browser whose runner has already gone cannot be told from another app's, so it is left alone.
# Cursor, VS Code extensions, the editor's TypeScript server, MCP servers and the shell running this script are never stopped.
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$editorPattern = "\\\.cursor\\|\\cursor\\resources\\|\\\.vscode\\|_npx\\|mcp|tsserver|typingsInstaller"
$stopped = @()

$all = @(Get-CimInstance Win32_Process)

# This script and whatever started it: npm, and the shell or agent that ran npm.
$self = @{}
for ($id = $PID; $id -and -not $self.ContainsKey($id); $id = [int]($all | Where-Object ProcessId -eq $id).ParentProcessId) { $self[$id] = $true }

$ours = @{}
foreach ($p in $all) {
  $cmd = [string]$p.CommandLine
  $exe = [string]$p.ExecutablePath
  if ($self.ContainsKey([int]$p.ProcessId) -or $cmd -match $editorPattern -or $p.Name -notmatch "^(node|esbuild|mongod.*)\.exe$") { continue }
  # mongodb-memory-server downloads its mongod, named mongod-x64-win32-<version>.exe, into a mongodb-binaries folder.
  if ($cmd -like "*$root*" -or $exe -like "*$root*" -or $cmd -like "*mongodb-memory-server*" -or $exe -like "*\mongodb-binaries\*") {
    $ours[[int]$p.ProcessId] = $p
  }
}

# Children of the processes above, however deep; a process id reused by an unrelated program is ruled out by its start time.
$added = $true
while ($added) {
  $added = $false
  foreach ($p in $all) {
    $id = [int]$p.ProcessId
    if ($ours.ContainsKey($id) -or $self.ContainsKey($id) -or ([string]$p.CommandLine) -match $editorPattern) { continue }
    $parent = $ours[[int]$p.ParentProcessId]
    if ($parent -and $p.CreationDate -ge $parent.CreationDate) {
      $ours[$id] = $p
      $added = $true
    }
  }
}

foreach ($p in $ours.Values) {
  Stop-Process -Id $p.ProcessId -Force
  $stopped += "$($p.Name) $($p.ProcessId)"
}

# The ports this repo uses: test:local, dev and start, the Playwright server, the HTML report. 3000 is shared with other apps on this laptop.
foreach ($port in 3000, 3005, 3006, 9323) {
  Get-NetTCPConnection -LocalPort $port -State Listen | ForEach-Object {
    if ($ours.ContainsKey([int]$_.OwningProcess)) { return }
    Write-Output "Port $port belongs to another app: left alone."
  }
}

# Only the container scripts/visual-baselines.ts names; other Playwright or mongo containers are not ours.
if (Get-Command docker -ErrorAction SilentlyContinue) {
  $container = docker ps -q --filter "name=^hedging-sheet-visual$"
  if ($container) { docker stop $container | Out-Null; $stopped += "docker hedging-sheet-visual" }
}

$folders = ".next\cache", "test-results", "reports", "playwright-report", "coverage", "node_modules\.cache", ".lighthouseci"
foreach ($f in $folders) {
  $path = Join-Path $root $f
  if (Test-Path $path) { Remove-Item -Recurse -Force $path; Write-Output "Deleted $f" }
}

if ($stopped.Count) { Write-Output "Stopped: $($stopped -join ', ')" } else { Write-Output "Nothing was running." }
