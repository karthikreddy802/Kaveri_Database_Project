# Export local Windows Postgres (kaveri) into db/kaveri.sql for Docker + EC2.
$ErrorActionPreference = "Stop"
$out = Join-Path $PSScriptRoot "kaveri.sql"
$db = if ($env:DB_NAME) { $env:DB_NAME } else { "kaveri" }
$user = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
  $candidates = @(
    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { $pgDump = $c; break }
  }
}
if (-not $pgDump) {
  Write-Error "pg_dump not found. Install PostgreSQL client tools or add pg_dump to PATH."
}

Write-Host "Dumping database '$db' as user '$user' -> $out"
& $pgDump -U $user -d $db --no-owner --no-acl -F p -f $out
Write-Host "Done. Copy db/kaveri.sql to EC2, then: docker compose up --build -d"
