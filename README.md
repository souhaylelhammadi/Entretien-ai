# Entretien AI - Plateforme d'Entretiens Vidéo Automatisés

## Description du Projet
Interview AI est une plateforme innovante qui révolutionne le processus de recrutement en automatisant les entretiens d'embauche grâce à l'intelligence artificielle. Cette solution permet aux candidats de passer des entretiens vidéo asynchrones tout en offrant aux recruteurs des outils d'évaluation avancés basés sur l'IA.

### Fonctionnalités Principales

#### 1. Entretiens Vidéo Asynchrones
- Enregistrement des réponses à son rythme
- Interface intuitive pour la navigation entre les questions
- Possibilité de reprendre l'enregistrement si nécessaire
- Prévisualisation des réponses avant soumission

#### 2. Transcription et Analyse
- Transcription automatique des réponses avec Whisper
- Analyse détaillée des réponses par Grok AI
- Détection des mots-clés et des compétences
- Évaluation de la clarté et de la pertinence des réponses

#### 3. Rapports d'Évaluation
- Génération automatique de rapports détaillés
- Analyse des points forts et des points à améliorer
- Score global et scores par compétence
- Recommandations personnalisées

## Architecture Technique

### Frontend
- **Framework** : React.js avec Redux
- **Styling** : Tailwind CSS
- **Capture Vidéo** : WebRTC et MediaRecorder API
- **Gestion d'État** : Redux Toolkit
- **Routing** : React Router
- **Validation** : Formik et Yup

### Backend
- **Framework** : Flask (Python)
- **Base de Données** : MongoDB
- **Transcription** : Whisper
- **Analyse IA** : Grok AI
- **Authentification** : JWT
- **API** : RESTful

### Fonctionnalités Techniques Détaillées

#### 1. Capture et Enregistrement Vidéo
- Utilisation de WebRTC pour l'accès à la caméra
- Enregistrement en format WebM haute qualité
- Gestion des permissions navigateur
- Compression optimisée des vidéos

#### 2. Système de Transcription
- Intégration de Whisper pour la transcription
- Traitement asynchrone des vidéos
- Support multilingue
- Stockage des transcriptions

#### 3. Analyse par Intelligence Artificielle
- Évaluation par Grok AI
- Analyse des compétences techniques
- Évaluation des soft skills
- Détection des mots-clés

#### 4. Gestion des Données
- Stockage structuré dans MongoDB
- Gestion des métadonnées
- Stockage sécurisé des vidéos
- Système de backup automatique

## Installation et Configuration

### Prérequis
- Node.js 16+
- Python 3.8+
- MongoDB 4.4+
- FFmpeg

### Installation Frontend
```bash
cd client
npm install
npm start
```

### Installation Backend
```bash
cd server
python -m venv venv
source venv/bin/activate  # ou `venv\Scripts\activate` sur Windows
pip install -r requirements.txt
python app.py
```

## Fonctionnalités Avancées

### 1. Gestion des Entretiens
- Création d'entretiens personnalisés
- Templates d'entretiens prédéfinis
- Gestion des délais et des deadlines
- Système de rappels automatiques

### 2. Analyse des Candidats
- Profils de compétences détaillés
- Historique des entretiens
- Comparaison entre candidats
- Suggestions de questions de suivi

### 3. Rapports et Analytics
- Tableaux de bord personnalisés
- Statistiques détaillées
- Export des données
- Visualisation des tendances

## Contribution
Les contributions sont les bienvenues ! Veuillez suivre les étapes suivantes :
1. Fork le projet
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request
