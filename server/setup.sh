#!/usr/bin/env bash
# KnightVerse web server setup for a fresh Ubuntu 24.04 VPS. Safe to run again.
#
#   What it does
#   1. installs updates and turns on automatic security updates
#   2. firewall: only SSH (22), HTTP (80) and HTTPS (443) are open
#   3. fail2ban: blocks addresses that keep guessing SSH passwords
#   4. Caddy web server: HTTPS certificate for knightverse.online (renewed by itself),
#      security headers, www -> knightverse.online
#   5. publishes the site from GitHub, and checks GitHub every 2 minutes for new commits
#   6. SSH: key login only (password login off). Only done when this very session
#      logged in with a key, so nobody gets locked out.
#
#   Run on the server as root:  bash setup.sh
set -euo pipefail

DOMAIN=knightverse.online
REPO=https://github.com/alduiin26/knightverse.git
BRANCH=main
DEPLOY_USER=kvdeploy
HOME_DIR=/opt/knightverse
WEB=/var/www/knightverse

say()  { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
ok()   { printf '   \033[32mOK\033[0m %s\n' "$*"; }
warn() { printf '   \033[31m!!\033[0m %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run this as root."; exit 1; }
# shellcheck disable=SC1091
. /etc/os-release
[ "${ID:-}" = ubuntu ] || warn "This script was written for Ubuntu 24.04, found: ${PRETTY_NAME:-unknown}"

export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
APT=(apt-get -y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)

say "1/6 Updates"
apt-get update -q
"${APT[@]}" upgrade
"${APT[@]}" install ufw fail2ban python3-systemd unattended-upgrades git rsync curl ca-certificates gnupg
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
ok "system up to date, security updates install every day"

say "2/6 Firewall"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'HTTP' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
ufw allow 443/udp comment 'HTTP/3' >/dev/null
ufw --force enable >/dev/null
ok "open ports: 22, 80, 443"

say "3/6 fail2ban"
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled = true
EOF
systemctl enable -q fail2ban
systemctl restart fail2ban
ok "5 wrong SSH logins in 10 minutes = 1 hour ban"

say "4/6 Caddy web server"
if ! command -v caddy >/dev/null; then
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    -o /etc/apt/sources.list.d/caddy-stable.list
  chmod 644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  "${APT[@]}" install caddy
fi
mkdir -p "$WEB" /var/log/caddy
chown caddy:caddy /var/log/caddy
cat > /etc/caddy/Caddyfile <<EOF
# KnightVerse - written by server/setup.sh (edit there, then run it again)
$DOMAIN {
	root * $WEB
	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
	}
	header -Server
	@page not path /admin.html
	header @page X-Frame-Options "SAMEORIGIN"
	@admin path /admin.html
	header @admin {
		X-Frame-Options "DENY"
		X-Robots-Tag "noindex, nofollow"
	}

	# pictures, video, music and 3D models change rarely; pages and code are checked every visit
	@media path /assets/img/* /assets/media/* /assets/docs/* /arena/models/*
	header @media Cache-Control "public, max-age=86400"
	@code not path /assets/img/* /assets/media/* /assets/docs/* /arena/models/*
	header @code Cache-Control "no-cache"

	# old GitHub Pages style links: /knightverse/arena.html -> /arena.html
	@old path_regexp old ^/knightverse/?(.*)$
	redir @old /{re.old.1} permanent

	file_server {
		hide .*
	}

	handle_errors {
		header -Server
		@notfound expression {err.status_code} == 404
		handle @notfound {
			rewrite * /404.html
			file_server
		}
		respond "{err.status_code} {err.status_text}"
	}

	log {
		output file /var/log/caddy/access.log {
			roll_size 20MiB
			roll_keep 5
		}
	}
}

www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}
EOF
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
caddy fmt --overwrite /etc/caddy/Caddyfile
systemctl enable -q caddy
systemctl reload caddy 2>/dev/null || systemctl restart caddy
ok "Caddy is serving $DOMAIN (HTTPS certificate is fetched automatically)"

say "5/6 Publishing the site from GitHub"
id "$DEPLOY_USER" >/dev/null 2>&1 \
  || useradd --system --home-dir "$HOME_DIR" --create-home --shell /usr/sbin/nologin "$DEPLOY_USER"
mkdir -p "$HOME_DIR"
chown "$DEPLOY_USER:$DEPLOY_USER" "$HOME_DIR" "$WEB"
chmod 755 "$WEB"
cat > /usr/local/bin/kv-deploy <<EOF
#!/usr/bin/env bash
# Publishes the newest commit of the KnightVerse repo to $WEB.
# Runs every 2 minutes (kv-deploy.timer). By hand: sudo systemctl start kv-deploy
set -euo pipefail
SRC=$HOME_DIR/repo
STATE=$HOME_DIR/deployed
if [ ! -d "\$SRC/.git" ]; then
  git clone -q --depth 1 --branch $BRANCH $REPO "\$SRC"
fi
git -C "\$SRC" fetch -q --depth 1 origin $BRANCH
new=\$(git -C "\$SRC" rev-parse FETCH_HEAD)
old=\$(cat "\$STATE" 2>/dev/null || true)
if [ "\$new" = "\$old" ] && [ "\${1:-}" != "--force" ]; then exit 0; fi
git -C "\$SRC" reset -q --hard "\$new"
git -C "\$SRC" clean -qfdx
# only what visitors need: no git data, server code, design sources, tools or notes
rsync -a --delete --delete-excluded --delay-updates --chmod=D755,F644 \\
  --exclude=.git/ --exclude=.gitignore --exclude=/supabase/ --exclude=/server/ \\
  --exclude=/tools/ --exclude=/design/ --exclude='*.md' --exclude='*.py' --exclude='*.sh' \\
  "\$SRC"/ $WEB/
echo "\$new" > "\$STATE"
echo "published \${new:0:7}"
EOF
chmod 755 /usr/local/bin/kv-deploy
cat > /etc/systemd/system/kv-deploy.service <<EOF
[Unit]
Description=Publish KnightVerse site from GitHub
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=$DEPLOY_USER
Group=$DEPLOY_USER
Environment=HOME=$HOME_DIR
ExecStart=/usr/local/bin/kv-deploy
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=$HOME_DIR $WEB
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
EOF
cat > /etc/systemd/system/kv-deploy.timer <<'EOF'
[Unit]
Description=Check GitHub for a new KnightVerse version every 2 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=2min

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl start kv-deploy.service
systemctl enable -q --now kv-deploy.timer
ok "site published: $(cut -c1-7 "$HOME_DIR/deployed"), new commits go live within 2 minutes"

say "6/6 SSH login"
client_ip=${SSH_CLIENT:-}
client_ip=${client_ip%% *}
logged_in_with_key() {
  [ -s /root/.ssh/authorized_keys ] || return 1
  [ -n "${client_ip:-}" ] || return 1
  { journalctl -q --no-pager --since "3 hours ago" SYSLOG_IDENTIFIER=sshd SYSLOG_IDENTIFIER=sshd-session 2>/dev/null || true
    tail -n 3000 /var/log/auth.log 2>/dev/null || true
  } | grep -F "Accepted publickey for root from $client_ip " >/dev/null
}
if logged_in_with_key || [ "${KV_FORCE_KEYONLY:-}" = 1 ]; then
  cat > /etc/ssh/sshd_config.d/00-knightverse.conf <<'EOF'
# KnightVerse: key login only. Files in this folder are read in name order and
# the first value wins, so this file overrides the provider's defaults.
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 4
LoginGraceTime 30
X11Forwarding no
EOF
  mkdir -p /run/sshd
  if sshd -t; then
    systemctl try-reload-or-restart ssh
    if sshd -T 2>/dev/null | grep -x 'passwordauthentication no' >/dev/null; then
      ok "password login is OFF, only your key can log in (the provider's web console still works)"
    else
      warn "sshd still allows passwords; check /etc/ssh/sshd_config"
    fi
  else
    rm -f /etc/ssh/sshd_config.d/00-knightverse.conf
    warn "SSH settings were rejected and removed; password login is unchanged"
  fi
else
  warn "this session did not log in with a key, so password login stays ON for now"
fi

say "Check"
for unit in caddy fail2ban kv-deploy.timer; do
  printf '   %-16s %s\n' "$unit" "$(systemctl is-active "$unit")"
done
code=000
for _ in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$DOMAIN/" || true)
  [ "$code" = 200 ] && break
  sleep 3
done
if [ "$code" = 200 ]; then
  ok "https://$DOMAIN/ answers 200"
else
  warn "https://$DOMAIN/ answered $code (the certificate may need another minute; DNS must point here)"
fi
[ -f /var/run/reboot-required ] && warn "a restart is needed for the new kernel: run  reboot"
echo
echo "Done."
