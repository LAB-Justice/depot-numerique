# Rétention et purge

Les durées de conservation ne sont pas encore validées. Cette page décrit les données concernées et
le mécanisme attendu sans inventer de valeur réglementaire. Les durées finales doivent être approuvées
par le métier, la sécurité, le DPO et les responsables juridiques compétents.

## Inventaire à couvrir

| Donnée                              | Stockage prévu          | Durée actuelle |
| ----------------------------------- | ----------------------- | -------------- |
| document original                   | MinIO                   | à définir      |
| texte extrait et intermédiaires     | MinIO                   | à définir      |
| document corrigé ou généré          | MinIO                   | à définir      |
| preuve ou copie déposée             | MinIO                   | à définir      |
| artefacts Playwright                | MinIO, rétention courte | à définir      |
| métadonnées et statuts              | PostgreSQL              | à définir      |
| historique des transitions          | PostgreSQL              | à définir      |
| sessions et vérifications SSO       | PostgreSQL              | expiration technique configurée |
| jobs et tentatives de dépôt         | PostgreSQL/Redis        | à définir      |
| logs techniques et audit            | système de logs cible   | à définir      |
| exports administratifs              | MinIO/PostgreSQL        | à définir      |

Une expiration de session ou de réservation SAML n'équivaut pas encore à une purge automatique des
lignes expirées. Un job de nettoyage technique devra être prévu.

## Principes

- conserver uniquement ce qui répond à un besoin métier, légal, de preuve ou d'exploitation ;
- distinguer document brut, version corrigée, preuve de dépôt et artefact technique ;
- minimiser davantage les artefacts de diagnostic ;
- ne pas prolonger une conservation par simple présence d'une sauvegarde ;
- documenter le point de départ de chaque durée : réception, succès, clôture ou dernier événement ;
- suspendre une purge uniquement selon une procédure légitime et auditée ;
- anonymiser les statistiques lorsque l'identité n'est plus nécessaire.

## Clés MinIO

Les clés ne doivent contenir ni nom, prénom, adresse, email ni numéro de dossier. Une forme cible est :

```text
jurisdiction=<code>/service=<code>/year=<yyyy>/month=<mm>/day=<dd>/document=<documentId>/original.pdf
```

Les buckets ou préfixes séparent originaux, extractions, générations, preuves, rejets, artefacts
Playwright et exports. Les politiques de cycle de vie MinIO ne doivent être activées qu'après avoir
défini la cohérence avec PostgreSQL et les obligations d'audit.

## Exécution d'une purge

Une purge documentaire doit être idempotente et traçable :

1. sélectionner en PostgreSQL les entités éligibles selon une politique versionnée ;
2. réserver un lot et enregistrer une exécution de purge ;
3. supprimer les objets MinIO associés ;
4. anonymiser ou supprimer les données PostgreSQL selon le besoin de preuve restant ;
5. retirer ou laisser expirer les jobs Redis associés ;
6. écrire un bilan sans donnée personnelle ;
7. signaler toute suppression partielle pour reprise.

L'ordre exact dépendra des contraintes de clés étrangères et de la stratégie de reprise. Une panne
entre deux systèmes ne doit pas laisser la purge considérée comme réussie.

## Sauvegardes et logs

Les sauvegardes suivent une rétention propre, documentée avec leur chiffrement et leur destruction.
La restauration d'une sauvegarde ancienne doit relancer les purges devenues exigibles.

Les logs applicatifs ne doivent pas contenir le document ni les claims SSO complets. Leur rétention
peut être différente des traces d'audit, mais les deux nécessitent un accès restreint et une purge
automatique.

## Tests attendus

- aucune donnée avant la date d'éligibilité ;
- suppression de tous les objets et lignes associés ;
- reprise après panne MinIO ou PostgreSQL ;
- exécution répétée sans erreur ni effet incohérent ;
- respect d'une suspension légitime ;
- anonymisation des statistiques conservées ;
- restauration d'une sauvegarde puis rattrapage des purges ;
- bilan d'exécution ne révélant aucune donnée personnelle.

## Décisions à obtenir

- durées exactes par catégorie et environnement ;
- données nécessaires comme preuve après dépôt ;
- cas de suspension et responsables autorisés ;
- règles d'anonymisation statistique ;
- rétention des sauvegardes, logs, audits et artefacts ;
- délai d'exécution et preuve fournie à une demande d'effacement.
