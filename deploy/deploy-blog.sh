#!/usr/bin/env bash
set -Eeuo pipefail

BLOG_USER="${BLOG_USER:-blog}"
REPO_DIR="${REPO_DIR:-/srv/blog}"
SERVICE_NAME="${SERVICE_NAME:-blog.service}"
READY_URL="${READY_URL:-http://127.0.0.1:4321/ready}"
LOCK_FILE="${LOCK_FILE:-/run/lock/blog-deploy.lock}"
TARGET_REF="${TARGET_REF:-origin/main}"
READY_ATTEMPTS="${READY_ATTEMPTS:-30}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "请使用root运行：sudo bash deploy/deploy-blog.sh" >&2
  exit 1
fi

for command in git npm systemctl curl sudo flock; do
  command -v "${command}" >/dev/null || { echo "缺少命令：${command}" >&2; exit 1; }
done

id "${BLOG_USER}" >/dev/null 2>&1 || { echo "用户不存在：${BLOG_USER}" >&2; exit 1; }
[[ -d "${REPO_DIR}/.git" ]] || { echo "不是Git仓库：${REPO_DIR}" >&2; exit 1; }

exec 9>"${LOCK_FILE}"
flock -n 9 || { echo "已有部署任务正在运行" >&2; exit 1; }

as_blog() {
  sudo -u "${BLOG_USER}" -- "$@"
}

git_blog() {
  as_blog git -C "${REPO_DIR}" "$@"
}

npm_blog() {
  as_blog npm --prefix "${REPO_DIR}" "$@"
}

wait_ready() {
  local attempt
  for ((attempt = 1; attempt <= READY_ATTEMPTS; attempt += 1)); do
    if curl --fail --silent --show-error --max-time 3 "${READY_URL}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

rebuild_commit() {
  local commit="$1"
  git_blog reset --hard "${commit}"
  npm_blog ci
  npm_blog run build
}

rollback_service() {
  local commit="$1"
  echo "部署失败，正在回退到${commit}"
  rebuild_commit "${commit}"
  systemctl restart "${SERVICE_NAME}"
  wait_ready || { echo "回退后服务仍未就绪，请立即检查${SERVICE_NAME}" >&2; return 1; }
  echo "已回退并恢复服务"
}

status="$(git_blog status --short)" || {
  echo "无法读取工作区，请检查${REPO_DIR}权限" >&2
  exit 1
}
if [[ -n "${status}" ]]; then
  echo "工作区不干净，停止部署：" >&2
  printf '%s\n' "${status}" >&2
  exit 1
fi

old_commit="$(git_blog rev-parse HEAD)"
echo "当前提交：${old_commit}"
git_blog fetch origin main
target_commit="$(git_blog rev-parse "${TARGET_REF}")"

if [[ "${old_commit}" == "${target_commit}" ]]; then
  echo "已经是最新提交：${target_commit}"
else
  git_blog merge --ff-only "${TARGET_REF}"
fi

if ! npm_blog ci || ! npm_blog run build; then
  echo "构建失败，服务未重启" >&2
  rebuild_commit "${old_commit}" || echo "旧版本工作区重建失败，但现有服务未重启" >&2
  exit 1
fi

if ! systemctl restart "${SERVICE_NAME}" || ! wait_ready; then
  rollback_service "${old_commit}"
  exit 1
fi

new_commit="$(git_blog rev-parse HEAD)"
echo "部署完成：${new_commit}"
systemctl --no-pager --full status "${SERVICE_NAME}" | sed -n '1,8p'
