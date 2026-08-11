#!/usr/bin/env bash
set -euo pipefail

# Déploie l'API sur le VPS en une seule étape atomique :
# build -> transfert vers containerd -> apply k8s -> vérification santé -> commit du manifeste.
#
# Objectif : empêcher le dérapage déjà arrivé une fois — une image buildée mais dont le
# Deployment k8s n'a jamais été mis à jour, laissant tourner une ancienne version cassée
# pendant 18h en CrashLoopBackOff. Avec ce script, le numéro de version dans
# infra/20-api.yaml et l'image réellement construite/déployée changent toujours ensemble,
# et le manifeste n'est commité qu'après vérification que le déploiement est sain.
#
# Usage :
#   infra/deploy.sh              # bump automatique du patch (0.2.2 -> 0.2.3)
#   infra/deploy.sh 0.3.0        # version explicite

REMOTE_HOST="ubuntu@79.137.32.27"
NAMESPACE="univ-social"
IMAGE_REPO="univ-social/api"
MANIFEST="infra/20-api.yaml"
BACKEND_DIR="backend"

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

echo "==> Build ${image}"
# --network=host : le bridge docker par défaut coupe les connexions longues vers registry.npmjs.org
# dans cet environnement (ECONNRESET / EIDLETIMEOUT observés en cours de build) ; le réseau host
# contourne ce NAT/conntrack pour les étapes RUN du build.
docker build --network=host -t "$image" "$BACKEND_DIR"

echo "==> Transfert de l'image vers ${REMOTE_HOST} (containerd, namespace k8s.io)"
docker save "$image" | ssh "$REMOTE_HOST" "sudo k3s ctr images import -"

echo "==> Mise à jour du manifeste (${current_version} -> ${new_version})"
sed -i "s#${IMAGE_REPO}:${current_version}#${image}#" "$MANIFEST"

echo "==> Application sur le cluster"
ssh "$REMOTE_HOST" "sudo kubectl apply -f -" <"$MANIFEST"

echo "==> Attente du rollout"
if ! ssh "$REMOTE_HOST" "sudo kubectl rollout status deployment/api -n ${NAMESPACE} --timeout=120s"; then
  echo "❌ Rollout en échec, retour à ${current_version}" >&2
  ssh "$REMOTE_HOST" "sudo kubectl rollout undo deployment/api -n ${NAMESPACE}"
  git checkout -- "$MANIFEST"
  exit 1
fi

echo "==> Vérification santé (/api/v1/health/ready)"
health_check='require("http").get("http://localhost:4000/api/v1/health/ready", r => process.exit(r.statusCode===200?0:1)).on("error",()=>process.exit(1))'
if ! ssh "$REMOTE_HOST" "sudo kubectl exec -n ${NAMESPACE} deploy/api -- node -e '${health_check}'"; then
  echo "❌ Health check en échec après rollout, retour à ${current_version}" >&2
  ssh "$REMOTE_HOST" "sudo kubectl rollout undo deployment/api -n ${NAMESPACE}"
  git checkout -- "$MANIFEST"
  exit 1
fi

echo "==> Commit du manifeste"
git add "$MANIFEST"
git commit -m "chore(deploy): release api ${new_version}"

echo "✅ Déployé et vérifié : ${image}"
