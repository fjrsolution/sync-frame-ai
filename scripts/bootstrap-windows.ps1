param([switch]$Check)
$ErrorActionPreference = 'Stop'
try {
    Set-Location (Split-Path $PSScriptRoot -Parent)
    if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') {
        throw 'Paket AI memerlukan Windows 10/11 x64 (Intel/AMD), bukan ARM atau 32-bit.'
    }
    New-Item -ItemType Directory -Force '.runtime', 'logs' | Out-Null
    Start-Transcript -Path 'logs/bootstrap-windows.log' -Append | Out-Null
    $runtime = (Resolve-Path '.runtime').Path
    $uv = Join-Path $runtime 'uv.exe'
    # Pinned official release; no global PATH changes or remote installer scripts.
    if (-not (Test-Path -LiteralPath $uv)) {
        Write-Host 'Mengunduh installer Python lokal (uv)...'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $asset = 'uv-x86_64-pc-windows-msvc.zip'
        $base = "https://github.com/astral-sh/uv/releases/download/0.8.22/$asset"
        $zip = Join-Path $runtime $asset
        $checksum = "$zip.sha256"
        for ($attempt = 1; $attempt -le 3; $attempt++) {
            try {
                Invoke-WebRequest -UseBasicParsing -Uri $base -OutFile $zip -TimeoutSec 180
                Invoke-WebRequest -UseBasicParsing -Uri "$base.sha256" -OutFile $checksum -TimeoutSec 60
                break
            } catch { if ($attempt -eq 3) { throw }; Start-Sleep -Seconds 2 }
        }
        $expected = ((Get-Content -LiteralPath $checksum -Raw).Trim() -split '\s+')[0]
        if ($expected -notmatch '^[a-fA-F0-9]{64}$' -or (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $expected) {
            throw 'Checksum uv tidak cocok. Jalankan ulang untuk mengunduh kembali.'
        }
        $unpack = Join-Path $runtime 'uv-unpack'
        Expand-Archive -LiteralPath $zip -DestinationPath $unpack -Force
        Copy-Item -LiteralPath (Join-Path $unpack 'uv.exe') -Destination $uv -Force
    }
    $env:UV_PYTHON_INSTALL_DIR = Join-Path $runtime 'python'
    $env:UV_CACHE_DIR = Join-Path $runtime 'uv-cache'
    $env:UV_PYTHON_INSTALL_REGISTRY = '0'
    $env:UV_PYTHON_INSTALL_BIN = '0'
    $env:UV_NO_CONFIG = '1'
    $env:FRAMESYNC_UV = $uv
    $env:PYTHONUTF8 = '1'
    if (-not (Test-Path "$env:WINDIR\System32\vcruntime140_1.dll") -or -not (Test-Path "$env:WINDIR\System32\msvcp140.dll")) {
        Write-Host 'Memasang Microsoft Visual C++ Runtime. Izinkan installer jika Windows meminta.'
        $redist = Join-Path $runtime 'vc_redist.x64.exe'
        Invoke-WebRequest -UseBasicParsing 'https://aka.ms/vs/17/release/vc_redist.x64.exe' -OutFile $redist -TimeoutSec 180
        $signature = Get-AuthenticodeSignature -LiteralPath $redist
        if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
            throw 'Tanda tangan installer Microsoft tidak valid.'
        }
        $installer = Start-Process -FilePath $redist -ArgumentList '/install', '/passive', '/norestart' -WindowStyle Hidden -Wait -PassThru
        if ($installer.ExitCode -eq 3010) { throw 'Runtime terpasang. Restart Windows, lalu jalankan launcher lagi.' }
        if ($installer.ExitCode -notin @(0, 1638)) { throw "Instalasi Visual C++ gagal: $($installer.ExitCode)" }
    }
    Write-Host 'Menyiapkan Python 3.11 khusus project (tanpa instal manual)...'
    & $uv python install 3.11
    if ($LASTEXITCODE -ne 0) { throw 'Unduhan Python gagal. Periksa internet dan ruang disk.' }
    $python = & $uv python find --managed-python 3.11
    if ($LASTEXITCODE -ne 0) { throw 'Python lokal tidak ditemukan.' }
    if ($Check) { & $python 'scripts/launcher.py' '--check' }
    else { & $python 'scripts/launcher.py' }
    $result = $LASTEXITCODE
    Stop-Transcript | Out-Null
    exit $result
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    try { Stop-Transcript | Out-Null } catch {}
    exit 1
}
