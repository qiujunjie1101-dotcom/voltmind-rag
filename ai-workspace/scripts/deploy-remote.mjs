// Fixed scripts; every user value is supplied as a separately shell-quoted argument.
const guard = String.raw`
set -eu
base=$1
owner=$2
check_path() {
  part=$base
  while [ "$part" != / ]; do
    [ ! -L "$part" ] || { echo '部署目录及其上级不能是符号链接' >&2; exit 1; }
    part=$(dirname "$part")
  done
}
check_owner() {
  check_path
  [ -f "$base/.ai-workspace-owner" ] && [ ! -L "$base/.ai-workspace-owner" ] && [ "$(cat "$base/.ai-workspace-owner")" = "$owner" ] || { echo '目标目录不属于当前空间，拒绝覆盖' >&2; exit 1; }
  [ -d "$base/releases" ] && [ ! -L "$base/releases" ] || exit 1
}
check_lock() { check_owner; [ ! -L "$base/.deploy-lock" ] && [ "$(cat "$base/.deploy-lock/owner")" = "$3" ] || { echo '部署锁已变化' >&2; exit 1; }; }
check_link() {
  name=$1
  if [ -L "$base/$name" ]; then
    target=$(readlink "$base/$name")
    printf '%s\n' "$target" | grep -Eq '^releases/[0-9]{14}-[a-f0-9]{12}$' || exit 1
    [ -d "$base/$target" ] && [ ! -L "$base/$target" ] && [ -f "$base/$target/index.html" ] || exit 1
    printf '%s' "$target"
  elif [ -e "$base/$name" ]; then echo 'current/previous 必须是本工具管理的版本链接' >&2; exit 1
  fi
}
`
export const inspectRemote = guard + String.raw`
[ "$(uname -s)" = Linux ] || { echo '当前仅支持 Linux 远程主机' >&2; exit 1; }
for tool in sh tar ln mv readlink; do command -v "$tool" >/dev/null || exit 1; done
check_path
if [ -e "$base" ]; then
  if [ -f "$base/.ai-workspace-owner" ]; then check_owner; check_link current >/dev/null; check_link previous >/dev/null
  else [ -d "$base" ] && [ -z "$(ls -A "$base")" ] || { echo '请使用空的专用部署目录，不能覆盖已有网站目录' >&2; exit 1; }; fi
  [ -w "$base" ] || { echo '登录用户没有部署目录写权限' >&2; exit 1; }
fi
if [ "$3" = nginx ]; then
  if [ "$(id -u)" != 0 ]; then sudo -n true || { echo '自动初始化需要 root 或免密 sudo 权限' >&2; exit 1; }; fi
fi
printf 'SSH 连接正常，Linux 发布工具可用\n'
`
export const prepareRemote = guard + String.raw`
lock=$3
release=$4
check_path
if [ ! -e "$base" ]; then
  if [ "$5" = nginx ] && [ "$(id -u)" != 0 ]; then
    sudo -n mkdir -p "$base"
    sudo -n chown "$(id -u):$(id -g)" "$base"
  else mkdir -p "$base"; fi
fi
[ -d "$base" ] || exit 1
if [ ! -e "$base/.ai-workspace-owner" ]; then
  [ -z "$(ls -A "$base")" ] || { echo '部署目录非空且没有空间标识，拒绝接管' >&2; exit 1; }
  (set -C; printf '%s' "$owner" > "$base/.ai-workspace-owner")
  mkdir "$base/releases"
fi
check_owner
mkdir "$base/.deploy-lock" || { echo '另一项部署正在进行；确认没有任务后再清理远程 .deploy-lock' >&2; exit 1; }
printf '%s' "$lock" > "$base/.deploy-lock/owner"
check_link current >/dev/null
check_link previous >/dev/null
if [ "$release" != rollback ]; then mkdir "$base/releases/$release"; fi
chmod a+rx "$base" "$base/releases"
`
export const currentRemote = guard + String.raw`
check_lock "$@"
check_link current
printf '\n'
check_link previous
printf '\n'
`
export const activateRemote = guard + String.raw`
check_lock "$@"
release=$4
expected=$5
old=$(check_link current)
[ "$old" = "$expected" ] || { echo '线上版本已变化，停止切换' >&2; exit 1; }
[ -d "$base/releases/$release" ] && [ ! -L "$base/releases/$release" ] && [ -f "$base/releases/$release/index.html" ] || exit 1
[ ! -e "$base/.current-$3" ] && [ ! -L "$base/.current-$3" ] || exit 1
ln -s "releases/$release" "$base/.current-$3"
mv -Tf "$base/.current-$3" "$base/current"
`
export const finalizeRemote = guard + String.raw`
check_lock "$@"
old=$4
if [ -n "$old" ]; then
  ln -s "$old" "$base/.previous-$3"
  mv -Tf "$base/.previous-$3" "$base/previous"
else
  [ ! -L "$base/previous" ] || rm "$base/previous"
fi
rm -f "$base/.deploy-lock/nginx.conf" "$base/.deploy-lock/nginx.previous" "$base/.deploy-lock/nginx-state"
rm "$base/.deploy-lock/owner"
rmdir "$base/.deploy-lock"
`
export const recoverRemote = guard + String.raw`
check_lock "$@"
failed=$4
old=$5
if [ "$(check_link current)" = "releases/$failed" ]; then
  if [ -n "$old" ]; then ln -s "$old" "$base/.recover-$3"; mv -Tf "$base/.recover-$3" "$base/current"
  else rm "$base/current"; fi
fi
`
export const unlockRemote = guard + String.raw`
check_owner
if [ -d "$base/.deploy-lock" ] && [ ! -L "$base/.deploy-lock" ] && [ "$(cat "$base/.deploy-lock/owner")" = "$3" ]; then
  rm -f "$base/.deploy-lock/nginx.conf" "$base/.deploy-lock/nginx.previous" "$base/.deploy-lock/nginx-state"
  rm "$base/.deploy-lock/owner"; rmdir "$base/.deploy-lock"
fi
`
// Shared with shell regression tests; no persistent repository configuration changes.
export const installRpmNginx = String.raw`
install_rpm_nginx() {
  manager=$1
  if install_output=$(priv env LC_ALL=C "$manager" install -y nginx 2>&1); then
    printf '%s\n' "$install_output"
    return 0
  else
    install_status=$?
  fi
  printf '%s\n' "$install_output" >&2
  if printf '%s\n' "$install_output" | grep -Eiq '(nginx.*filtered out by exclude filtering|filtered out by exclude filtering.*nginx)'; then
    printf 'Nginx 被软件源 exclude 规则过滤，仅本次安装临时禁用过滤后重试（含依赖），不修改软件源配置\n'
    priv env LC_ALL=C "$manager" --disableexcludes=all install -y nginx || {
      echo '临时禁用 exclude 后仍无法安装 Nginx，请检查软件源或手动安装后重试发布' >&2
      return 1
    }
  else
    echo 'Nginx 安装失败，请检查上述软件源、网络或依赖错误' >&2
    return "$install_status"
  fi
}
`
export const initializeNginx = guard + installRpmNginx + String.raw`
check_lock "$@"
port=$4
priv() { if [ "$(id -u)" = 0 ]; then "$@"; else sudo -n "$@"; fi; }
if ! command -v nginx >/dev/null; then
  if command -v apt-get >/dev/null; then priv env DEBIAN_FRONTEND=noninteractive apt-get update -qq; priv env DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
  elif command -v dnf >/dev/null; then install_rpm_nginx dnf
  elif command -v yum >/dev/null; then install_rpm_nginx yum
  else echo '无法自动安装 Nginx，请安装后使用已有网站服务模式' >&2; exit 1; fi
fi
conf=/etc/nginx/conf.d/ai-workspace-$owner.conf
if priv test -e "$conf"; then
  priv test ! -L "$conf" || exit 1
  priv grep -q "^# ai-workspace $owner$" "$conf" || { echo 'Nginx 配置不属于当前空间' >&2; exit 1; }
else
  command -v ss >/dev/null || { echo '需要 ss 命令检测网站端口是否占用' >&2; exit 1; }
  [ -z "$(ss -ltnH "sport = :$port")" ] || { echo '网站端口已占用，请选择其他端口或使用已有网站服务模式' >&2; exit 1; }
fi
staged=$base/.deploy-lock/nginx.conf
cat > "$staged" <<CONF
# ai-workspace $owner
server {
  listen $port;
  server_name _;
  root $base/current;
  index index.html;
  location / { try_files \$uri \$uri/ =404; }
  location = /workspace-release.json { add_header Cache-Control "no-store"; }
  location ~ /\. { deny all; }
}
CONF
backup=$base/.deploy-lock/nginx.previous
if priv test -f "$conf"; then priv cp "$conf" "$backup"; printf existing > "$base/.deploy-lock/nginx-state"
else printf new > "$base/.deploy-lock/nginx-state"; fi
priv mkdir -p /etc/nginx/conf.d
priv cp "$staged" "$conf"
priv nginx -t
if command -v systemctl >/dev/null; then priv systemctl enable nginx; if priv systemctl is-active --quiet nginx; then priv systemctl reload nginx; else priv systemctl start nginx; fi
else priv nginx -s reload || priv nginx; fi
printf '独立 Nginx 站点已就绪\n'
`
export const diagnoseNginx = guard + String.raw`
check_lock "$@"
port=$4
priv() { if [ "$(id -u)" = 0 ]; then "$@"; else sudo -n "$@"; fi; }
printf '\n网站端口监听状态：\n'
ss -ltn "sport = :$port" 2>&1 || true
printf '\n服务器本机 HTTP 检查（不经过公网）：\n'
if command -v curl >/dev/null; then
  curl --noproxy '*' --connect-timeout 3 --max-time 5 -sS -i "http://127.0.0.1:$port/workspace-release.json" 2>&1 || true
else printf '未安装 curl，跳过本机 HTTP 检查\n'; fi
printf '\n主机防火墙状态（云安全组需在云控制台检查）：\n'
if command -v firewall-cmd >/dev/null; then
  priv firewall-cmd --state 2>&1 || true
  priv firewall-cmd --get-active-zones 2>&1 || true
  priv firewall-cmd --list-all-zones 2>&1 || true
else printf '未安装 firewalld；仍可能存在其他主机防火墙规则\n'; fi
if command -v getenforce >/dev/null; then printf '\nSELinux 状态：\n'; getenforce || true; fi
printf '\n本机返回当前版本的 HTTP 200 而公网超时，请检查云防火墙、安全组的 TCP 入站规则、来源范围及本地网络；本机拒绝连接或返回 403/404，请检查监听和站点文件权限。\n'
`
export const restoreNginx = guard + String.raw`
check_lock "$@"
state=$base/.deploy-lock/nginx-state
[ -f "$state" ] || exit 0
priv() { if [ "$(id -u)" = 0 ]; then "$@"; else sudo -n "$@"; fi; }
conf=/etc/nginx/conf.d/ai-workspace-$owner.conf
priv test ! -L "$conf" || exit 1
if priv test -e "$conf"; then priv grep -q "^# ai-workspace $owner$" "$conf" || exit 1; fi
case "$(cat "$state")" in
 existing) priv cp "$base/.deploy-lock/nginx.previous" "$conf" ;;
 new) priv rm -f "$conf" ;;
 *) exit 1 ;;
esac
priv nginx -t
if command -v systemctl >/dev/null; then
  if priv systemctl is-active --quiet nginx; then priv systemctl reload nginx; fi
else priv nginx -s reload; fi
rm "$state"
printf '已恢复发布前的 Nginx 站点配置\n'
`
