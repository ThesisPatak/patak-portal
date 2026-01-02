Add-Type -AssemblyName System.IO.Compression.FileSystem
$src = (Get-Location).Path
$dest = Join-Path $src 'PATAK-PORTAL_full.zip'
if (Test-Path $dest) { Remove-Item $dest -Force }
[IO.Compression.ZipFile]::CreateFromDirectory($src, $dest)
$fi = Get-Item $dest
Write-Output ("ZIP_CREATED|{0}|{1}" -f $fi.FullName, $fi.Length)
