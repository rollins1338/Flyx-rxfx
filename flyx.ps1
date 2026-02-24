###############################################################################
# Flyx 2.0 - Self-Hosted Setup & Launcher (Windows)
#
# Usage (run as Administrator for DNS setup):
#   .\flyx.ps1          - Full setup + start (first time)
#   .\flyx.ps1 start    - Start all services
#   .\flyx.ps1 stop     - Stop all services
#   .\flyx.ps1 restart  - Restart all services
#   .\flyx.ps1 status   - Show service status
#   .\flyx.ps1 logs     - Tail logs
#   .\flyx.ps1 dns      - Re-configure DNS only
#   .\flyx.ps1 clean    - Stop + remove volumes + undo DNS
###############################################################################

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "restart", "status", "logs", "dns", "clean", "")]
    [string]$Command = "start"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $ScriptDir "docker\.env"
$EnvExample = Join-Path $ScriptDir "docker\.env.example"
$ComposeFile = Join-Path $ScriptDir "docker-compose.yml"
$HostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"
$HostsMarker = "# flyx-self-hosted"
$Domain = "flyx.local"

function Write-Log { param([string]$Msg) Write-Host "[flyx] $Msg" -ForegroundColor Green }
function Write-Warn { param([string]$Msg) Write-Host "[flyx] $Msg" -ForegroundColor Yellow }
function Write-Err { param([string]$Msg) Write-Host "[flyx] $Msg" -ForegroundColor Red }

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-LanIP {
    # Get the primary LAN IP (not loopback, not virtual)
    $ip = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.InterfaceAlias -notmatch "Loopback|vEthernet|WSL|Docker" -and
            $_.IPAddress -notmatch "^127\." -and
            $_.IPAddress -notmatch "^169\.254\." -and
            $_.PrefixOrigin -ne "WellKnown"
        } |
        Sort-Object -Property InterfaceMetric |
        Select-Object -First 1).IPAddress

    if (-not $ip) {
        $ip = "127.0.0.1"
        Write-Warn "Could not detect LAN IP, falling back to 127.0.0.1"
    }
    return $ip
}

function Get-UpstreamDNS {
    $dns = (Get-DnsClientServerAddress -AddressFamily IPv4 |
        Where-Object { $_.InterfaceAlias -notmatch "Loopback|vEthernet|WSL|Docker" } |
        Select-Object -First 1).ServerAddresses |
        Select-Object -First 1

    if (-not $dns -or $dns -eq "127.0.0.1") { $dns = "8.8.8.8" }
    return $dns
}

function Set-HostsEntry {
    param([string]$IP)

    if (-not (Test-Admin)) {
        Write-Warn "Need Administrator privileges to modify hosts file."
        Write-Warn "Re-run this script as Administrator, or manually add to $HostsFile :"
        Write-Host "  $IP  $Domain" -ForegroundColor Cyan
        return
    }

    $content = Get-Content $HostsFile -ErrorAction SilentlyContinue
    $entry = "$IP  $Domain $HostsMarker"

    if ($content -match [regex]::Escape($HostsMarker)) {
        Write-Log "Updating hosts file entry for $Domain -> $IP"
        $content = $content -replace ".*$([regex]::Escape($HostsMarker)).*", $entry
        Set-Content -Path $HostsFile -Value $content -Force
    } else {
        Write-Log "Adding $Domain -> $IP to hosts file"
        Add-Content -Path $HostsFile -Value "`n$entry" -Force
    }

    # Flush DNS cache
    ipconfig /flushdns | Out-Null
    Write-Log "DNS cache flushed"
}

function Remove-HostsEntry {
    if (-not (Test-Admin)) {
        Write-Warn "Need Administrator privileges to modify hosts file."
        return
    }

    $content = Get-Content $HostsFile -ErrorAction SilentlyContinue
    if ($content -match [regex]::Escape($HostsMarker)) {
        Write-Log "Removing $Domain from hosts file"
        $content = $content | Where-Object { $_ -notmatch [regex]::Escape($HostsMarker) }
        Set-Content -Path $HostsFile -Value $content -Force
        ipconfig /flushdns | Out-Null
    }
}

function Ensure-EnvFile {
    param([string]$IP, [string]$UpstreamDNS)

    if (-not (Test-Path $EnvFile)) {
        Write-Log "Creating docker/.env from template..."
        Copy-Item $EnvExample $EnvFile

        Write-Warn "Edit docker\.env and add your TMDB API key before continuing."
        Write-Warn "Get a free key at: https://www.themoviedb.org/settings/api"
        Write-Host ""
        Read-Host "Press Enter after editing docker/.env (or Ctrl+C to abort)"
    }

    # Read current content
    $content = Get-Content $EnvFile -Raw

    # Update or add HOST_IP
    if ($content -match "^HOST_IP=") {
        $content = $content -replace "(?m)^HOST_IP=.*", "HOST_IP=$IP"
    } else {
        $content += "`n# Auto-detected by flyx.ps1`nHOST_IP=$IP"
    }

    # Update or add UPSTREAM_DNS
    if ($content -match "^UPSTREAM_DNS=") {
        $content = $content -replace "(?m)^UPSTREAM_DNS=.*", "UPSTREAM_DNS=$UpstreamDNS"
    } else {
        $content += "`nUPSTREAM_DNS=$UpstreamDNS"
    }

    Set-Content -Path $EnvFile -Value $content -NoNewline
}

function Show-NetworkInfo {
    param([string]$IP)

    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host "  Flyx is running at: " -NoNewline
    Write-Host "http://flyx.local" -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  This machine: " -NoNewline -ForegroundColor White
    Write-Host "http://flyx.local works automatically"
    Write-Host ""
    Write-Host "  Other devices on your network:" -ForegroundColor White
    Write-Host "  Option A: Set device DNS to $IP (uses built-in DNS server)"
    Write-Host "  Option B: Access directly at http://$IP"
    Write-Host ""
    Write-Host "  DNS server: ${IP}:53 (resolves flyx.local, forwards everything else)"
    Write-Host ""
    Write-Host "  To set DNS on other devices:" -ForegroundColor White
    Write-Host "    iPhone/iPad: Settings > Wi-Fi > (i) > Configure DNS > Manual > $IP"
    Write-Host "    Android:     Settings > Wi-Fi > long-press network > Modify > DNS > $IP"
    Write-Host "    Windows:     Network Settings > Change adapter > IPv4 > DNS > $IP"
    Write-Host "    Mac:         System Preferences > Network > Advanced > DNS > $IP"
    Write-Host ""
    Write-Host "  Or set it network-wide:" -ForegroundColor White
    Write-Host "    Router admin > DHCP settings > Primary DNS > $IP"
    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Cyan
}

function Start-Flyx {
    $ip = Get-LanIP
    $upstreamDns = Get-UpstreamDNS

    Write-Log "Detected LAN IP: $ip"
    Write-Log "Detected upstream DNS: $upstreamDns"

    Ensure-EnvFile -IP $ip -UpstreamDNS $upstreamDns
    Set-HostsEntry -IP $ip

    Write-Log "Starting Flyx services..."
    docker compose -f $ComposeFile up -d --build

    Write-Log "Waiting for services to be healthy..."
    $retries = 0
    while ($retries -lt 30) {
        try {
            $null = Invoke-WebRequest -Uri "http://localhost:8787/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            break
        } catch {
            Start-Sleep -Seconds 2
            $retries++
        }
    }

    if ($retries -lt 30) {
        Write-Log "All services are up!"
    } else {
        Write-Warn "Services are starting but may not be fully ready yet."
        Write-Warn "Run 'docker compose logs -f' to check progress."
    }

    Show-NetworkInfo -IP $ip
}

function Stop-Flyx {
    Write-Log "Stopping Flyx services..."
    docker compose -f $ComposeFile down
    Write-Log "Stopped."
}

function Clean-Flyx {
    Write-Log "Stopping services and cleaning up..."
    docker compose -f $ComposeFile down -v
    Remove-HostsEntry
    Write-Log "Cleaned up. Volumes removed, hosts file restored."
}

# Main
switch ($Command) {
    "start"   { Start-Flyx }
    "stop"    { Stop-Flyx }
    "restart" { Stop-Flyx; Start-Flyx }
    "status"  { docker compose -f $ComposeFile ps }
    "logs"    { docker compose -f $ComposeFile logs -f }
    "dns"     { $ip = Get-LanIP; Write-Log "Detected LAN IP: $ip"; Set-HostsEntry -IP $ip }
    "clean"   { Clean-Flyx }
    ""        { Start-Flyx }
}
