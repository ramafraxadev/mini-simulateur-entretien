# SuperInterview — Simulateur d'entretien vocal IA

Un mini-simulateur d'entretien d'embauche vocal construit en 24h pour le test technique ProcessIQ. Le candidat parle, l'IA répond vocalement, la conversation se déroule naturellement sans toucher le clavier.

Pipeline : **Web Speech API (STT) → Groq / Llama 3.3-70B (LLM) → Web Speech Synthesis (TTS)**

Démo vidéo : https://drive.google.com/file/d/1tjOkkVGhsLBgKbbWN0UsJUgI3pprGgLu/view?usp=drive_link

---

## Comment tester l'application

> Lis cette section avant de lancer quoi que ce soit.

### Ce qu'il te faut

- **Node.js 18 ou plus** — vérifie avec `node -v`
- **Chrome ou Edge** — obligatoire pour la reconnaissance vocale (Firefox ne supporte pas la Web Speech API)
- **Un micro qui fonctionne** — vérifie qu'il est bien sélectionné dans les paramètres de ton navigateur
- **Une clé API Groq gratuite** — 2 minutes pour en créer une sur [console.groq.com](https://console.groq.com), aucune carte bancaire requise

### Étapes d'installation

**1. Récupérer le projet**

```bash
git clone https://github.com/ton-username/superinterview.git
cd superinterview
```

**2. Installer les dépendances**

```bash
npm install
```

**3. Créer le fichier de config**

```bash
cp .env.example .env.local
```

Ouvre `.env.local` et colle ta clé Groq :

```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

La clé reste côté serveur — elle ne transite jamais dans le navigateur.

**4. Lancer le serveur de développement**

```bash
npm run dev
```

**5. Ouvrir l'application**

Va sur [http://localhost:3000](http://localhost:3000) **dans Chrome ou Edge**.

---

### Comment se déroule un test

1. La page d'accueil s'affiche avec un bouton "Démarrer l'entretien →"
2. Clique dessus — le navigateur va te demander l'autorisation d'accès au micro, accepte
3. L'IA se présente et pose une première question (voix synthétique)
4. Attends qu'elle ait fini de parler, puis clique le bouton micro rond en bas
5. Parle normalement — tu vois ta transcription s'afficher en temps réel
6. Arrête de parler : après 2 secondes de silence, ta réponse est envoyée automatiquement
7. Tu peux aussi cliquer "Envoyer maintenant" si tu préfères ne pas attendre
8. L'IA réfléchit (indicateur visible), puis répond vocalement
9. Le cycle recommence jusqu'à ce que tu cliques "✕ Terminer"

### Ce qu'il faut savoir avant de tester

- Le micro et les boutons sont **volontairement désactivés pendant que l'IA parle** — c'est fait exprès pour éviter les doubles soumissions
- La durée de l'entretien s'affiche en haut à gauche et change de couleur passé 15 minutes
- Si la voix sonne robotique, c'est normal — c'est la Web Speech Synthesis native du navigateur. Une v2 utiliserait ElevenLabs pour quelque chose de plus naturel
- Sur certaines machines, Chrome peut demander la permission micro à chaque rechargement de page

---

## Pourquoi ces choix techniques

### Groq plutôt qu'OpenAI

La contrainte principale du test était la latence. Groq tourne sur des puces dédiées au LLM (LPU) et génère du texte à environ 400 tokens par seconde, contre 80 pour GPT-4o. Ça change vraiment l'expérience — la réponse commence à apparaître quasi instantanément après que l'utilisateur a fini de parler.

C'est aussi gratuit sur le tier free, ce qui simplifiait le déploiement pour un prototype.

### Web Speech API plutôt que Whisper

Pour la transcription, le choix était soit une API cloud (Whisper, Deepgram) soit la Web Speech API native du navigateur. J'ai choisi le natif principalement pour la latence : 0ms de réseau versus 300 à 800ms pour un aller-retour vers une API externe.

La contrepartie c'est la précision — Whisper est meilleur, surtout sur les accents ou le vocabulaire technique. Pour une v2 en production, un streaming WebSocket vers Whisper serait le bon compromis.

### Détection de silence plutôt qu'un bouton

Forcer l'utilisateur à appuyer sur un bouton après chaque réponse casse le rythme d'une conversation. J'ai mis un timer de 2 secondes qui se réinitialise à chaque mot détecté — quand le silence dure, la réponse part automatiquement. Le bouton manuel reste disponible pour ceux qui préfèrent contrôler.

---

## Structure du projet

```
.
├── app/
│   ├── page.tsx                  # point d'entrée
│   ├── layout.tsx
│   ├── globals.css               # variables CSS, thème dark
│   └── api/chat/route.ts         # API Route Next.js → Groq (streaming SSE)
│
├── components/
│   ├── VoiceInterview.tsx        # composant principal, gère toute la logique
│   ├── MessageBubble.tsx         # bulle de message user ou IA
│   └── Waveform.tsx              # animation sonore pendant la synthèse vocale
│
└── lib/
    ├── useSTT.ts                 # hook Speech-to-Text + détection silence 2s
    └── useTTS.ts                 # hook Text-to-Speech + buffer pour le streaming
```

---

## Ce qui pourrait être amélioré

Je liste honnêtement ce que je ferais différemment avec plus de temps :

- **Voix plus naturelle** — la synthèse native du navigateur fait le travail mais ElevenLabs ou Azure Neural TTS rendraient l'expérience beaucoup plus agréable
- **Meilleure précision STT** — Whisper via WebSocket streaming pour les accents et le vocabulaire technique
- **Prompt configurable** — en l'état le persona du recruteur est codé en dur dans `route.ts`, il faudrait une interface pour le modifier
- **Pas d'authentification** — n'importe qui avec le lien peut utiliser ta clé Groq. Pour une mise en production il faudrait protéger l'API Route
- **Pas de sauvegarde** — les entretiens disparaissent au rechargement. Un export PDF ou un historique seraient utiles

---

## Dépendances

```json
{
  "next": "16.1.6",
  "react": "19.2.3",
  "typescript": "^5"
}
```

Aucune lib externe pour STT/TTS — ce sont des APIs Web natives. Aucun SDK Groq — l'API est compatible OpenAI donc un `fetch` standard suffit.