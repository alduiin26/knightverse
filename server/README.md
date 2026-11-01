# Web server (knightverse.online)

The site runs on our own VPS (Ubuntu 24.04) behind Cloudflare. `setup.sh` sets the
whole server up and can be run again at any time after changing it.

## First setup (from Windows PowerShell)

1. Make a login key (press Enter at the questions):
   `ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\knightverse" -C knightverse`
2. Put the public half on the server (asks for the server password one last time):
   `type "$env:USERPROFILE\.ssh\knightverse.pub" | ssh root@94.138.210.180 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && tr -d '\r' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"`
3. Run the setup with the key:
   `ssh -i "$env:USERPROFILE\.ssh\knightverse" root@94.138.210.180 "curl -fsSL https://raw.githubusercontent.com/alduiin26/knightverse/main/server/setup.sh -o /root/setup.sh && bash /root/setup.sh"`

After step 3, password login is off; only the key in step 1 can log in. The
provider's web console (noVNC) still works with the root password.

## What runs on the server

| Part | What it does |
| --- | --- |
| Caddy | Serves `/var/www/knightverse` on https://knightverse.online, gets and renews the certificate, adds security headers, sends www and old `/knightverse/...` links to the right address |
| kv-deploy.timer | Every 2 minutes checks GitHub; a new commit on `main` is published (no git data, `supabase/`, `server/`, `tools/`, `design/` or notes) |
| ufw | Only ports 22, 80 and 443 are open |
| fail2ban | 5 wrong SSH logins in 10 minutes = 1 hour ban |
| unattended-upgrades | Security updates every day |

## Handy commands (on the server)

- Publish now: `systemctl start kv-deploy`
- Publish log: `journalctl -u kv-deploy -n 20`
- Web server log: `journalctl -u caddy -n 50`, visits in `/var/log/caddy/access.log`
- Status: `systemctl status caddy kv-deploy.timer fail2ban`
