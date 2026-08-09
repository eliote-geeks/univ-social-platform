# Univ Social Platform

Socle du nouveau réseau social universitaire. Ce produit est distinct de Campus Connect (Chamilo LMS) et de tous les autres projets hébergés sur le VPS.

## État initial

- Namespace Kubernetes : `univ-social`
- Aucun workload applicatif déployé à ce stade
- Quotas, limites de conteneur et réseau fermé par défaut déjà appliqués
- Aucune base, identité ou donnée partagée avec les projets existants

## Étapes de livraison

1. Services isolés : PostgreSQL, Redis, stockage médias et sauvegardes.
2. Identité dédiée : Keycloak, domaine et rôles.
3. API : comptes, affiliations universitaires, profils, publications et fil.
4. Adaptation des écrans Webestica au vrai contrat d’API.
5. Messagerie, notifications, modération, supervision et tests de charge.

Les manifestes de ce dossier sont la source de vérité de l’infrastructure. Aucun secret n’est stocké dans Git.
