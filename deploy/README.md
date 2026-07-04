# Deploy

Redeploys the app to the Azure VM at
`https://setlist2playlist-46687.westeurope.cloudapp.azure.com`.

## Usage

```powershell
cd C:\personal\setlist2playlist\deploy

# Full redeploy (rebuild all containers)
.\deploy.ps1

# Rebuild only one service
.\deploy.ps1 -Service backend
.\deploy.ps1 -Service frontend

# Deploy to a different host / SSH key
.\deploy.ps1 -VmHost my-vm.westeurope.cloudapp.azure.com -SshKey C:\keys\id_rsa
```

## What it does

1. Runs `git add -A && git commit -m "<datetime> deployment" && git push`
   (env files stay excluded via `.gitignore`).
2. Stages the repo (excluding `.git`, `node_modules`, `__pycache__`, `build`, `deploy`).
3. Overlays `docker-compose.prod.yml` and `Caddyfile`.
4. Rewrites `client/.env` so the React build points at the public HTTPS URL:
   - `REACT_APP_SPOTIFY_REDIRECT_URI=https://<VmHost>/callback`
   - `REACT_APP_BACKEND_URL=https://<VmHost>/api`
5. `scp`s a tarball to the VM.
6. On the VM: extracts and runs `docker compose -f docker-compose.prod.yml up -d --build`.

Spotify credentials are read from your local `client/.env`.

## Architecture on the VM

Caddy (auto Let's Encrypt on 80/443) →
- `/api/*` → backend (FastAPI)
- `/*`     → frontend (nginx serving the React build)

## Prereqs

- SSH private key at `%LOCALAPPDATA%\Temp\s2p-deploy\id_rsa` (created during initial provisioning).
- `tar`, `ssh`, `scp` on PATH (bundled with modern Windows 10/11).
- Azure VM `s2p-vm` in RG `setlist2playlist-rg` already provisioned with Docker + Caddy stack.
