# Blindtest Buzzer (Local)

## Prérequis

- Buzzers USB branchés au PC
- Un navigateur récent (Chrome/Edge) sur **localhost**

## Mise en route rapide

1. Ouvre ce dossier dans VS Code.
2. Installe l’extension “Live Server” (ou utilise un serveur local équivalent).
3. Lance un serveur local sur http://localhost:5500 (ou autre port).
4. Ouvre la page dans ton navigateur.

## Version desktop (.exe) avec Electron

### Prerequis

- Node.js 20+
- npm

### Lancer l'application en mode desktop

1. Installe les dependances:
	- `npm install`
2. Lance l'application Electron:
	- `npm start`

### Generer un .exe Windows

1. Build installeur Windows:
	- `npm run dist`
2. Le fichier sera genere dans le dossier `release/`.

Note: le dossier `local/` est exclu du package desktop pour eviter d'embarquer de gros fichiers audio. Tu peux toujours charger tes morceaux localement depuis l'application via la selection de dossier.

## Build automatique GitHub Actions

Un workflow est fourni dans `.github/workflows/build-electron.yml`.

- Declenchement automatique sur push vers `main`.
- Declenchement manuel via l'onglet Actions.
- Production d'un installeur Windows `.exe` en artefact telechargeable.

## Attribution des buzzers

1. Clique **Mode attribution**.
2. Appuie sur un bouton du buzzer pour attribuer un joueur.
3. Répète pour les 4 joueurs.

## Utilisation

- **Activer**: autorise le buzz.
- **Réinitialiser**: débloque après un buzz.
- **Réponse OK (+1)** / **Réponse KO**: validation rapide.
- **Annuler dernier point**: retire le dernier point attribué.
- **Reset scores**: remet tous les scores à zéro.
- **Lecture en cours**: contrôler la musique locale (Lire / Pause / Suivant).

## Fichiers locaux + difficulté

Tu charges un **dossier** de MP3 et la difficulté est définie **uniquement par dossier** :

- Place tes fichiers dans des sous‑dossiers `facile/`, `moyen/`, `difficile/`.

L’ordre de lecture peut être **manuel**, **A→Z**, **Z→A** ou **aléatoire**.

Les fichiers sans dossier de difficulté apparaissent dans la colonne “À corriger”.

## Écrans

- **Interface animateur**: [index.html](index.html)
- **Écran joueurs**: [players.html](players.html) (s’ouvre via “Ouvrir écran joueurs”)

## Dépannage

- Si les buzzers ne sont pas détectés, essaye les touches 1-4 du clavier.
- Certains buzzers apparaissent comme “gamepad” uniquement après un premier appui.
- En mode local, ajoute des fichiers audio (mp3, wav, etc.) via le bouton de sélection de dossier.
