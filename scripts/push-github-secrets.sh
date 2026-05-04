#!/usr/bin/env bash
set -euo pipefail

REPO=""
ENV_FILE=".env.local"
DRY_RUN=false

REQUIRED_SECRETS=(
  "CWS_PUBLISHER_ID"
  "CWS_EXTENSION_ID"
  "GCP_WORKLOAD_IDENTITY_PROVIDER"
  "GCP_SERVICE_ACCOUNT"
)

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Push required GitHub Actions secrets from environment variables or an env file.

Options:
  --repo OWNER/NAME   Target GitHub repository (default: auto-detect from git remote)
  --env-file PATH     Path to env file (default: .env.local)
  --dry-run           Print what would be set without making changes
  -h, --help          Show this help message
EOF
}

get_repo_from_git_remote() {
  local remote
  remote=$(git remote get-url origin 2>/dev/null || true)
  if [[ -z "$remote" ]]; then
    echo "ERROR: Could not detect repository from git remote origin. Pass --repo owner/name." >&2
    exit 1
  fi

  if [[ "$remote" =~ github\.com[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
    echo "${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
  else
    echo "ERROR: Could not parse GitHub repository from origin URL: $remote. Pass --repo owner/name." >&2
    exit 1
  fi
}

load_env_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    return
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"  # trim leading whitespace
    line="${line%"${line##*[![:space:]]}"}"  # trim trailing whitespace

    [[ -z "$line" || "$line" == \#* ]] && continue

    if [[ "$line" == *=* ]]; then
      local name="${line%%=*}"
      local value="${line#*=}"

      name="${name#"${name%%[![:space:]]*}"}"
      name="${name%"${name##*[![:space:]]}"}"
      value="${value#"${value%%[![:space:]]*}"}"
      value="${value%"${value##*[![:space:]]}"}"

      # Strip surrounding quotes
      if [[ ("$value" == '"'*'"') || ("$value" == "'"*"'") ]]; then
        value="${value:1:${#value}-2}"
      fi

      if [[ -n "$name" ]]; then
        export "$name=$value"
      fi
    fi
  done < "$path"
}

require_command() {
  local name="$1"
  if ! command -v "$name" &>/dev/null; then
    if [[ "$name" == "gh" ]]; then
      cat >&2 <<EOF
ERROR: Required command not found: gh

Install GitHub CLI, then authenticate before running this script:

  # Debian/Ubuntu (inside Devcontainer)
  (type -p wget >/dev/null || (sudo apt update && sudo apt install wget -y)) \
    && sudo mkdir -p -m 755 /etc/apt/keyrings \
    && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg \
       | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
    && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && sudo apt update && sudo apt install gh -y

  gh auth login
EOF
    else
      echo "ERROR: Required command not found: $name" >&2
    fi
    exit 1
  fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_command git

load_env_file "$ENV_FILE"

if [[ -z "$REPO" ]]; then
  REPO=$(get_repo_from_git_remote)
fi

if [[ "$DRY_RUN" == false ]]; then
  require_command gh
  gh auth status >/dev/null
fi

missing=()
for secret_name in "${REQUIRED_SECRETS[@]}"; do
  if [[ -z "${!secret_name:-}" ]]; then
    missing+=("$secret_name")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  joined=$(IFS=", "; echo "${missing[*]}")
  echo "ERROR: Missing required secret values: $joined. Set them as environment variables or in $ENV_FILE." >&2
  exit 1
fi

echo "Repository: $REPO"
echo "Secrets: $(IFS=", "; echo "${REQUIRED_SECRETS[*]}")"

for secret_name in "${REQUIRED_SECRETS[@]}"; do
  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] Would set GitHub secret: $secret_name"
    continue
  fi

  printf '%s' "${!secret_name}" | gh secret set "$secret_name" --repo "$REPO"
  echo "Set GitHub secret: $secret_name"
done

echo "Done."
