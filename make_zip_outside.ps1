Add-Type -AssemblyName System.IO.Compression.FileSystem
$src = (Get-Location).Path
$parent = Split-Path $src -Parent
$dest = Join-Path $parent ('PATAK-PORTAL_full_{0}.zip' -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
[IO.Compression.ZipFile]::CreateFromDirectory($src, $dest)
$fi = Get-Item $dest
Write-Output ("ZIP_CREATED|{0}|{1}" -f $fi.FullName, $fi.Length)
