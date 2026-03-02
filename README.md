# SuperInterview

Simulateur d'entretien vocal construit en 24h pour le test technique ProcessIQ. Tu parles, l'IA répond à voix haute, pas besoin de toucher le clavier.

Pipeline : Web Speech API → Groq / Llama 3.3-70B → Web Speech Synthesis

Demo : https://drive.google.com/file/d/1tjOkkVGhsLBgKbbWN0UsJUgI3pprGgLu/view?usp=drive_link

---

## Tester l'appli

### Avant de commencer

- Node.js 18+ (`node -v` pour vérifier)
- Chrome ou Edge obligatoire — Firefox ne supporte pas la Web Speech API
- Un micro actif et sélectionné dans ton navigateur
- Une clé API Groq — gratuite sur [console.groq.com](https://console.groq.com), pas besoin de CB

### Installation

```bash
git clone https://github.com/ton-username/superinterview.git
cd superinterview
npm install
cp .env.example .env.local
```

Ouvre `.env.local` et colle ta clé :

```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

```bash
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000) dans Chrome ou Edge.

### Déroulement

1. Page d'accueil, clique "Demarrer l'entretien"
2. Le navigateur demande l'accès au micro, accepte
3. L'IA se présente et pose une première question
4. Attends qu'elle finisse, puis clique le bouton micro en bas
5. Parle — la transcription s'affiche en direct
6. Silence de 2 secondes = envoi automatique. Ou clique "Envoyer" si tu préfères
7. L'IA répond vocalement, le cycle recommence
8. Clique "Terminer" pour arrêter

### Quelques précisions

Le micro est désactivé pendant que l'IA parle, c'est voulu pour éviter les doubles soumissions. La durée s'affiche en haut et passe en orange à 15min. La voix est la synthèse native du navigateur donc un peu robotique — c'est une limitation connue, ElevenLabs serait mieux mais ça aurait ajouté de la complexité pour un proto 24h.

---

## Choix techniques

### Pourquoi Groq

La latence était le critère principal. Groq utilise des puces dédiées (LPU) et sort environ 400 tokens/sec contre 80 pour GPT-4o. En pratique la réponse commence à apparaître presque instantanément. C'est aussi gratuit sur le free tier ce qui évitait de gérer la facturation pour un test.

### Pourquoi la Web Speech API

J'avais le choix entre Whisper/Deepgram et la Web Speech API native. J'ai pris le natif pour la latence — 0ms de réseau contre 300-800ms pour un aller-retour cloud. La contrepartie c'est la précision, Whisper est nettement meilleur sur les accents et le vocabulaire technique. Pour une v2 sérieuse je partirais sur du Whisper en WebSocket streaming.

### Pourquoi la détection de silence

Un bouton "envoyer" à chaque échange casse le rythme. J'ai mis un timer à 2 secondes qui se réinitialise à chaque mot détecté. Le bouton manuel reste là pour ceux qui veulent contrôler.

---

## Structure

```
app/
  api/chat/route.ts    → appel Groq, streaming SSE
  page.tsx
  globals.css

components/
  VoiceInterview.tsx   → logique principale, machine d'état
  MessageBubble.tsx
  Waveform.tsx

lib/
  useSTT.ts            → speech-to-text + timer silence
  useTTS.ts            → text-to-speech + buffer streaming
```

---

## Ce que je ferais avec plus de temps

- Voix ElevenLabs ou Azure Neural TTS à la place de la synthèse native
- Whisper WebSocket pour une meilleure transcription
- Prompt configurable depuis l'interface plutôt que hardcodé dans route.ts
- Auth sur l'API Route pour éviter que n'importe qui utilise la clé
- Sauvegarde des entretiens, export PDF

---

## Deps

```json
{
  "next": "16.1.6",
  "react": "19.2.3",
  "typescript": "^5"
}
```

Pas de lib externe pour STT/TTS, pas de SDK Groq — juste un fetch standard vu que leur API est compatible OpenAI.
