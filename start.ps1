$ErrorActionPreference = "Stop"

$ScriptDir = $PSScriptRoot
$ImageName = "jupyterlab-custom"
$ContainerName = "jupyterlab-custom"
$Port = 8888
$DockerDesktopExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

function Test-DockerReady {
    docker info *> $null
    return $LASTEXITCODE -eq 0
}

function Install-Docker {
    Write-Host "Docker not found - installing Docker Desktop..."
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements
    } else {
        Write-Host "winget not available - downloading the Docker Desktop installer directly..."
        $installerPath = Join-Path $env:TEMP "DockerDesktopInstaller.exe"
        Invoke-WebRequest -Uri "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" -OutFile $installerPath
        Start-Process -FilePath $installerPath -ArgumentList @("install", "--quiet", "--accept-license") -Wait
        Remove-Item $installerPath -ErrorAction SilentlyContinue
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Install-Docker
}

if (-not (Test-DockerReady)) {
    if (Test-Path $DockerDesktopExe) {
        Write-Host "Starting Docker Desktop..."
        Start-Process -FilePath $DockerDesktopExe
    }

    Write-Host "Waiting for the Docker daemon to become ready..."
    $maxWaitSeconds = 180
    $elapsed = 0
    while (-not (Test-DockerReady)) {
        if ($elapsed -ge $maxWaitSeconds) {
            Write-Error "Docker did not become ready within $maxWaitSeconds seconds. Start Docker Desktop manually (it may need a system restart or WSL2 setup after a fresh install) and re-run this script."
            exit 1
        }
        Start-Sleep -Seconds 5
        $elapsed += 5
    }
}

Write-Host "Building image..."
docker build -t $ImageName $ScriptDir

Write-Host "Starting container..."
try { docker rm -f $ContainerName 2>$null | Out-Null } catch {}

$NotebooksDir = Join-Path $ScriptDir "notebooks"
New-Item -ItemType Directory -Force -Path $NotebooksDir | Out-Null

docker run -d --name $ContainerName -p "${Port}:8888" -v "${NotebooksDir}:/home/jovyan/work" $ImageName

Write-Host "JupyterLab is running at http://localhost:$Port"
