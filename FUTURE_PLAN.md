# Plan d'actions futures — Rahiq

## Contexte

Rahiq est une plateforme e-learning avec :
- Pipeline OCR → DOCX → JSON enrichi (Claude)
- Format de sortie : `{ objectives, concepts, takeaways, applications }` par chunk
- 158 modules FiqhNafs à terme + autres cours

L'objectif est de construire le **module d'affichage/apprentissage** pour présenter le contenu enrichi aux étudiants.

---

## Actions futures

### Phase 1 — Module d'affichage des cours (priorité haute)

**1.1 — Lecteur de module enrichi**
- Afficher un module avec ses chunks enrichis
- Montrer : objectifs,概念-clé, points clés, applications
- Navigation entre chunks (précédent/suivant)
- Progression de lecture

**1.2 — Vue d'ensemble du cours**
- Liste des modules/unités
- Barre de progression (% de chunks lus + enrichis)
- Filtres par statut (lu/non lu/enrichi)

**1.3 — Mode revision**
- Afficher uniquement les points clés et applications
- Mode quiz flashcard pour les concepts

---

### Phase 2 — Quiz & Évaluation (priorité moyenne)

**2.1 — Génération de quiz automatique**
- Générer des QCM à partir des `objectives` et `concepts`
- API route `/api/quiz` qui utilise Claude
- Questions ouvertes aussi

**2.2 — Score et suivi**
- Stocker les résultats de quiz en localStorage
- Tableau de bord的个人isé

---

### Phase 3 — Export & Partage (priorité basse)

**3.1 — Export SCORM**
- Générer un package SCORM pour LMS (Moodle, etc.)

**3.2 — Export PDF enrichi**
- Exporter un module avec objectifs, concepts, points clés intégrés

**3.3 — Partage**
- Lien de partage public pour un module
- Mode présentation

---

### Phase 4 — Plateforme complète (vision long terme)

**4.1 — Authentification**
- Connexion utilisateur
- Synchronisation Cloud des progrès

**4.2 — Base de données**
- Migrer de localStorage vers une DB (Supabase, PlanetScale, etc.)
- Stocker les cours, progresso, quiz

**4.3 — Multi-utilisateur**
- Admin : créer/gérer des cours
- Étudiant : suivre des cours

**4.4 — Recherche sémantique**
- Chercher dans les concepts et objectifs
- Trouver le module pertinent pour une question

---

## Suggestions pour la prochaine action

Je recommande de commencer par **1.1** : le lecteur de module enrichi. C'est le cœur de l'application — afficher le contenu que vous avez créé avec l'enrichissement.

Voulez-vous qu'on travaille sur le lecteur de module maintenant ?
