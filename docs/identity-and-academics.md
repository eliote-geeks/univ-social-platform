# Identité et structure universitaire

L’identité est séparée du profil social : Keycloak sera l’autorité de connexion et cette API ne conserve que son identifiant immuable `keycloakSubject`. Aucun mot de passe n’est stocké par l’API.

Un utilisateur peut avoir une affiliation par université, avec un rôle (`STUDENT`, `TEACHER`, `STAFF`, `ALUMNI`) et un statut de vérification. Cette séparation permet de vérifier un étudiant par e-mail institutionnel, matricule, pièce justificative ou validation manuelle sans mélanger le processus au fournisseur d’identité.

Hiérarchie académique :

```text
Université → Campus → Faculté → Filière/Programme
                    ↘ Affiliation utilisateur vérifiable
```

Routes actuellement implémentées (lecture) :

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`
- `GET /api/v1/users/:username`

Routes planifiées, **pas encore implémentées** (module `universities` à créer) :

- `GET /api/v1/universities`
- `GET /api/v1/universities/:slug`

Les écritures, l’administration universitaire et la synchronisation du premier profil seront ajoutées uniquement après le branchement OIDC/Keycloak et les contrôles de rôles.
