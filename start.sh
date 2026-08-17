#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="jupyterlab-custom"
CONTAINER_NAME="jupyterlab-custom"
PORT=8888

DOCKER_CMD="docker"

install_docker() {
    echo "Docker not found — installing via get.docker.com..."
    if ! command -v curl >/dev/null 2>&1; then
        echo "curl is required to install Docker. Install curl and re-run this script." >&2
        exit 1
    fi
    curl -fsSL https://get.docker.com | sh

    if command -v systemctl >/dev/null 2>&1; then
        sudo systemctl enable --now docker
    fi

    if [ "$(id -u)" -ne 0 ] && ! groups "$USER" | grep -qw docker; then
        sudo usermod -aG docker "$USER" || true
        echo "Added $USER to the docker group (takes effect on next login)."
        echo "Using sudo for the rest of this run."
        DOCKER_CMD="sudo docker"
    fi
}

if ! command -v docker >/dev/null 2>&1; then
    install_docker
elif ! docker info >/dev/null 2>&1; then
    if sudo docker info >/dev/null 2>&1; then
        DOCKER_CMD="sudo docker"
    else
        echo "Docker is installed but the daemon isn't reachable. Is it running?" >&2
        exit 1
    fi
fi

echo "Building image..."
$DOCKER_CMD build -t "$IMAGE_NAME" "$SCRIPT_DIR"

echo "Starting container..."
$DOCKER_CMD rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

NOTEBOOKS_DIR="$SCRIPT_DIR/notebooks"
mkdir -p "$NOTEBOOKS_DIR"

$DOCKER_CMD run -d \
    --name "$CONTAINER_NAME" \
    -p "$PORT:8888" \
    -v "$NOTEBOOKS_DIR:/home/jovyan/work" \
    "$IMAGE_NAME"

echo "JupyterLab is running at http://localhost:$PORT"
