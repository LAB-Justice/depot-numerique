# Automatisation Playwright

Playwright fait partie de la cible, mais aucune automatisation de dépôt n'est encore implémentée dans
le dépôt. Cette page fixe les contraintes à respecter lorsque le parcours de la plateforme interne
sera connu.

## Responsabilité du worker

L'automatisation doit vivre dans un worker séparé de l'API :

- une requête HTTP ne doit pas attendre un navigateur ;
- chaque job possède un contexte de navigateur isolé ;
- plusieurs workers peuvent traiter la queue avec une concurrence contrôlée ;
- un redémarrage ne doit pas perdre l'état métier de la tentative.

L'API crée un enregistrement persistant de dépôt puis publie un job léger contenant des identifiants,
pas le document ni les credentials.

## Étapes cibles

1. verrouiller ou réserver atomiquement la tentative ;
2. charger le document depuis MinIO avec un droit temporaire minimal ;
3. obtenir les credentials depuis Vault ;
4. ouvrir un contexte Playwright neuf ;
5. s'authentifier sur la plateforme interne ;
6. naviguer avec des sélecteurs stables ;
7. téléverser le fichier et confirmer le dossier cible ;
8. collecter un identifiant ou une preuve de succès ;
9. persister le résultat avant d'acquitter le job ;
10. fermer le contexte et révoquer les secrets temporaires.

## Idempotence

Un retry ne doit pas créer un second dépôt. Avant chaque tentative, le worker devra vérifier l'état
persisté et, si la plateforme le permet, rechercher une preuve ou un identifiant de dépôt existant.

Les états minimaux à distinguer sont :

- jamais tenté ;
- tentative réservée ;
- en cours ;
- succès confirmé ;
- échec récupérable ;
- échec définitif ou résultat incertain.

Un timeout après clic final est un résultat incertain, pas automatiquement un échec : le système doit
vérifier la plateforme avant de rejouer.

## Sélecteurs et robustesse

Préférer, dans cet ordre :

- attributs de test ou identifiants stables convenus avec l'équipe de la plateforme ;
- rôles et noms accessibles ;
- labels de formulaire ;
- sélecteurs CSS simples et structuraux en dernier recours.

Éviter les délais fixes. Attendre un événement précis : navigation, réponse réseau, élément visible
ou état final. Chaque étape doit avoir un timeout nommé et produire une erreur métier compréhensible.

## Secrets et isolation

- aucun mot de passe dans le job, le code, les fixtures ou les logs ;
- credentials obtenus à la demande et renouvelés ;
- contexte navigateur neuf par job ;
- téléchargements limités à un répertoire temporaire dédié ;
- permissions Linux et capabilities minimales ;
- accès réseau restreint aux services nécessaires ;
- effacement des fichiers temporaires après traitement.

## Artefacts et logs

Les traces, captures et vidéos peuvent contenir des données personnelles. Elles doivent être
désactivées par défaut en succès et limitées aux échecs utiles. Les artefacts sont stockés dans un
bucket dédié avec accès restreint et rétention courte.

Les logs contiennent `documentId`, `jobId`, `attemptId`, l'étape et une catégorie d'erreur. Ils ne
contiennent ni document, mot de passe, cookie, token, numéro de dossier complet ni capture encodée.

## Retry et erreurs

Les erreurs doivent être classées :

- transitoires : réseau, indisponibilité, limite de concurrence ;
- fonctionnelles : dossier introuvable, fichier refusé, droit absent ;
- techniques non récupérables : changement de page ou sélecteur invalide ;
- résultat incertain : action envoyée mais confirmation absente.

BullMQ appliquera un nombre de tentatives et un backoff adaptés à la catégorie. Les échecs définitifs
restent visibles dans une file ou une table de supervision et ne sont jamais supprimés silencieusement.

## Tests attendus

- tests unitaires de classification et de transitions ;
- tests du processor avec navigateur simulé ;
- environnement de test contrôlé pour le parcours Playwright réel ;
- tests de retry, timeout et résultat incertain ;
- test de changement de sélecteur ;
- test garantissant l'absence de doublon ;
- test de purge des fichiers et artefacts temporaires.

## Informations manquantes

- URL et environnements de la plateforme interne ;
- méthode d'authentification et gestion des comptes robots ;
- écrans, champs, limites de fichier et preuve de succès ;
- identifiants stables disponibles dans le DOM ;
- règles de concurrence et protections anti-robot ;
- procédure fonctionnelle en cas de dépôt incertain.
