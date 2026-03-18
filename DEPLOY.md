# Money Matriz — Deployment Guide

This guide covers deploying the application on a fresh Raspberry Pi (or any Debian/Ubuntu ARM64 system) with Cloudflare Tunnel for public HTTPS access.

---

## Prerequisites

- Raspberry Pi with Raspberry Pi OS (64-bit recommended)
- Internet connection
- A domain managed on Cloudflare
- PostgreSQL installed and running
- The git repository cloned on the Pi

---

## Step 1 — Install NVM and Node.js 24

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 24
nvm use 24
node -v   # should print v24.x.x
```

---

## Step 2 — Install system packages

```bash
sudo apt update
sudo apt install -y nginx git postgresql postgresql-contrib
```

Install PM2 globally:

```bash
npm install -g pm2
```

---

## Step 3 — Clone the repository

```bash
git clone git@github.com:dayananda143/money-matriz.git ~/Documents/projects/money-matriz
cd ~/Documents/projects/money-matriz
```

---

## Step 4 — Set up PostgreSQL

```bash
sudo -u postgres psql
```

Inside the psql shell:

```sql
CREATE USER moneymatriz WITH PASSWORD 'mm_secure_2024';
CREATE DATABASE moneymatriz OWNER moneymatriz;
GRANT ALL PRIVILEGES ON DATABASE moneymatriz TO moneymatriz;
\q
```

---

## Step 5 — Set up the backend

```bash
cd ~/Documents/projects/money-matriz/backend
npm install
```

Create a `.env` file (or set environment variables):

```bash
nano .env
```

```
DATABASE_URL=postgresql://moneymatriz:mm_secure_2024@localhost:5432/moneymatriz
JWT_SECRET=your_jwt_secret_here
PORT=3003
```

Run database migrations:

```bash
node src/db/migrate.js
node src/db/migrate2.js
```

**Default super admin credentials (change after first login):**
- Email: `admin@moneymatriz.com`
- Password: `Admin@1234`

---

## Step 6 — Build the frontend

```bash
cd ~/Documents/projects/money-matriz/frontend
npm install
bash -c 'unset npm_config_prefix && export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 24 && npm run build'
```

The built files will be in `frontend/dist/`.

---

## Step 7 — Start the backend with PM2

```bash
cd ~/Documents/projects/money-matriz/backend
pm2 start src/index.js --name moneymatriz-backend
pm2 save
pm2 startup   # follow the printed command to enable auto-start on boot
```

Verify it's running:

```bash
pm2 list
curl http://localhost:3003/api/auth/me   # should return 401 (not 404/connection refused)
```

---

## Step 8 — Configure nginx

Create the nginx site config:

```bash
sudo nano /etc/nginx/sites-available/money-matriz
```

Paste the following (replace `your-subdomain.your-domain.com` with your actual subdomain):

```nginx
server {
    listen 80;
    server_name your-subdomain.your-domain.com;

    root /home/raspbi/Documents/projects/money-matriz/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3003/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/money-matriz /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

---

## Step 9 — Install and configure Cloudflare Tunnel (cloudflared)

### Install cloudflared

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

### Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser — log in and select your domain. A `cert.pem` file will be saved to `~/.cloudflared/`.

### Create the tunnel

```bash
cloudflared tunnel create money-matriz
```

Note the tunnel ID printed (e.g. `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

### Create the tunnel config

```bash
nano ~/.cloudflared/config.yml
```

```yaml
tunnel: <your-tunnel-id>
credentials-file: /home/raspbi/.cloudflared/<your-tunnel-id>.json

ingress:
  - hostname: your-subdomain.your-domain.com
    service: http://127.0.0.1:80
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

### Add the DNS route

```bash
cloudflared tunnel route dns money-matriz your-subdomain.your-domain.com
```

### Run cloudflared as a background process

```bash
nohup cloudflared tunnel --config ~/.cloudflared/config.yml run &
```

To restart after config changes, kill the process and relaunch:

```bash
pkill cloudflared
nohup cloudflared tunnel --config ~/.cloudflared/config.yml run &
```

---

## Step 10 — Configure Cloudflare dashboard

In your Cloudflare dashboard for the domain:

1. **SSL/TLS → Overview** → set mode to **Flexible**
2. **SSL/TLS → Edge Certificates** → **Always Use HTTPS** → **ON**

---

## Step 11 — Verify everything works

Open `https://your-subdomain.your-domain.com` in a browser. You should see the login page with a padlock (HTTPS).

Log in with `admin@moneymatriz.com` / `Admin@1234` and immediately change the password.

---

## Updating the app (after code changes)

```bash
cd ~/Documents/projects/money-matriz
git pull

# Rebuild frontend
cd frontend
bash -c 'unset npm_config_prefix && export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 24 && npm run build'

# Restart backend if backend files changed
pm2 restart moneymatriz-backend

# Run new migrations if any
cd ../backend
node src/db/migrate.js
node src/db/migrate2.js
```

---

## Changing the subdomain

1. Edit `~/.cloudflared/config.yml` — update the `hostname` field
2. Run: `cloudflared tunnel route dns money-matriz new-subdomain.your-domain.com`
3. Kill and relaunch cloudflared: `pkill cloudflared && nohup cloudflared tunnel --config ~/.cloudflared/config.yml run &`
4. Edit `/etc/nginx/sites-available/money-matriz` — update `server_name`
5. Run: `sudo nginx -t && sudo systemctl reload nginx`

---

## Service management reference

| Task | Command |
|------|---------|
| Backend status | `pm2 list` |
| Backend logs | `pm2 logs moneymatriz-backend` |
| Restart backend | `pm2 restart moneymatriz-backend` |
| Run migrations | `cd backend && node src/db/migrate.js` |
| Nginx status | `sudo systemctl status nginx` |
| Nginx reload | `sudo systemctl reload nginx` |
| Tunnel restart | `pkill cloudflared && nohup cloudflared tunnel --config ~/.cloudflared/config.yml run &` |
