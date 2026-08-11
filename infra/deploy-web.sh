#!/usr/bin/env bash
set -euo pipefail

# Déploie le frontend sur le VPS — même patron sûr que deploy.sh (voir son en-tête pour le
# pourquoi) : build -> transfert vers containerd -> apply k8s -> vérification santé ->
# commit du manifeste seulement si tout a réussi.
#
# Particularité frontend : NEXT_PUBLIC_API_BASE_URL est inliné dans le bundle JS au moment du
# build (Next.js ne le lit jamais au runtime), donc fourni ici en --build-arg, pas en variable
# d'environnement du Deployment.
#
# Usage :
#   infra/deploy-web.sh              # bump automatique du patch (0.1.0 -> 0.1.1)
#   infra/deploy-web.sh 0.2.0        # version explicite

REMOTE_HOST="ubuntu@79.137.32.27"
NAMESPACE="univ-social"
IMAGE_REPO="univ-social/web"
MANIFEST="infra/25-web.yaml"
WEB_DIR="frontend"
PUBLIC_API_BASE_URL="https://api-univ-social.79.137.32.27.nip.io/api/v1"

cd "$(dirname "$0")/.."

current_version=$(grep -oP "(?<=${IMAGE_REPO}:)[0-9]+\.[0-9]+\.[0-9]+" "$MANIFEST")
if [[ -z "$current_version" ]]; then
  echo "Impossible de trouver la version actuelle dans ${MANIFEST}" >&2
  exit 1
fi

if [[ $# -ge 1 ]]; then
  new_version="$1"
else
  IFS='.' read -r major minor patch <<<"$current_version"
  new_version="${major}.${minor}.$((patch + 1))"
fi
image="${IMAGE_REPO}:${new_version}"

if [[ -n "$(git status --porcelain -- "$MANIFEST")" ]]; then
  echo "${MANIFEST} a des changements non commités. Commite ou stash d'abord." >&2
  exit 1
fi

echo "==> Build ${image} (NEXT_PUBLIC_API_BASE_URL=${PUBLIC_API_BASE_URL})"
docker build --network=host \
  --build-arg "NEXT_PUBLIC_API_BASE_URL=${PUBLIC_API_BASE_URL}" \
  -t "$image" "$WEB_DIR"

echo "==> Transfert de l'image vers ${REMOTE_HOST} (containerd, namespace k8s.io)"
docker save "$image" | ssh "$REMOTE_HOST" "sudo k3s ctr images import -"

echo "==> Mise à jour du manifeste (${current_version} -> ${new_version})"
sed -i "s#${IMAGE_REPO}:${current_version}#${image}#" "$MANIFEST"

echo "==> Application sur le cluster"
ssh "$REMOTE_HOST" "sudo kubectl apply -f -" <"$MANIFEST"

echo "==> Attente du rollout"
if ! ssh "$REMOTE_HOST" "sudo kubectl rollout status deployment/web -n ${NAMESPACE} --timeout=120s"; then
  echo "❌ Rollout en échec, retour à ${current_version}" >&2
  ssh "$REMOTE_HOST" "sudo kubectl rollout undo deployment/web -n ${NAMESPACE}"
  git checkout -- "$MANIFEST"
  exit 1
fi

echo "==> Vérification santé (/sign-in doit répondre 200)"
health_check='require("http").get("http://localhost:3000/sign-in", r => process.exit(r.statusCode===200?0:1)).on("error",()=>process.exit(1))'
if ! ssh "$REMOTE_HOST" "sudo kubectl exec -n ${NAMESPACE} deploy/web -- node -e '${health_check}'"; then
  echo "❌ Health check en échec après rollout, retour à ${current_version}" >&2
  ssh "$REMOTE_HOST" "sudo kubectl rollout undo deployment/web -n ${NAMESPACE}"
  git checkout -- "$MANIFEST"
  exit 1
fi

echo "==> Commit du manifeste"
git add "$MANIFEST"
git commit -m "chore(deploy): release web ${new_version}"

echo "✅ Déployé et vérifié : ${image}"
echo "   https://univ-social.79.137.32.27.nip.io"
