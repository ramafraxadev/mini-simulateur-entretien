# SuperInterview — Simulateur d'entretien vocal

Pipeline **STT → LLM → TTS** conçu pour un test technique chez ProcessIQ. L'objectif principal : minimiser la latence perçue à chaque étape de la conversation.

---

## Demo

```
Parole utilisateur → Web Speech API (STT) → Groq/Llama 3.3-70B (LLM streaming) → Web Speech Synthesis (TTS)
```

---

## Stack & Choix techniques

### STT — Web Speech API

J'ai choisi la Web Speech API native plutôt que Whisper ou Deepgram pour une raison simple : zéro latence réseau. Tout se passe dans le navigateur, pas de round-trip pour la transcription.

| Critère | Web Speech API | Whisper/Deepgram |
|---|---|---|
| Latence | **0 ms** (local) | 300–800 ms (réseau) |
| Coût | Gratuit | Payant |
| Résultats interims | ✅ Oui | ❌ Non (ou WebSocket custom) |
| Précision FR | Bonne (Chrome) | Excellente |

Les résultats interims permettent d'afficher la transcription en direct pendant que l'utilisateur parle — ça donne un feedback immédiat et rend l'interface beaucoup plus vivante.

Pour la **détection de fin de parole**, j'ai mis en place un `setTimeout` de 2 secondes qui se réinitialise à chaque nouveau token reçu. Quand le timer expire, la réponse est soumise automatiquement. Ça évite d'avoir à appuyer sur un bouton et rend la conversation plus naturelle. Le bouton manuel reste là en secours.

> **Limitation** : Web Speech API ne fonctionne que sur Chrome et Edge, pas Firefox.

---

### LLM — Llama 3.3-70B via Groq

Groq tourne sur des **LPU** (Language Processing Units) plutôt que des GPU classiques, ce qui se traduit par des vitesses de génération de 300 à 500 tokens/seconde — soit environ 5× plus rapide qu'OpenAI GPT-4. C'était le critère décisif pour ce projet.

| Critère | Groq (Llama 3.3-70B) | OpenAI GPT-4o | Gemini Flash |
|---|---|---|---|
| Vitesse tokens/s | **~400** | ~80 | ~150 |
| Coût | **Gratuit** (tier free) | ~$5/1M tokens | ~$0.10/1M |
| Qualité FR | Très bonne | Excellente | Bonne |
| Streaming SSE | ✅ | ✅ | ✅ |

L'API Groq est compatible OpenAI, donc pas besoin de SDK spécifique — un simple `fetch` vers `api.groq.com` suffit.

Le streaming token par token permet d'afficher la réponse au fur et à mesure et surtout de démarrer le TTS sans attendre la fin de la génération.

---

### TTS — Web Speech Synthesis API

Même logique que pour le STT : en restant dans le navigateur, on évite toute latence réseau. La synthèse démarre dès que le dernier token arrive.

Le texte est nettoyé avant synthèse pour retirer le markdown que Llama peut émettre (`**bold**`, `*italic*`, backticks, `### heading`).

> Pour une v2 : ElevenLabs ou Azure Neural TTS pour une voix plus naturelle, avec streaming audio via WebSocket.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (Next.js)                      │
│                                                           │
│  useSTT ──────────────────────────────────────────────►  │
│  (Web Speech API)   transcript                            │
│       │                                                   │
│       ▼                                                   │
│  VoiceInterview.tsx                                       │
│  (state machine: idle → listening → thinking → speaking)  │
│       │                                                   │
│       ▼ fetch SSE                                         │
├───────────────────────────────────────────────────────────┤
│                  Next.js API Route                        │
│  /api/chat ──► Groq API (Llama 3.3-70B, streaming)       │
│                token by token → SSE → browser             │
├───────────────────────────────────────────────────────────┤
│                    Browser                                │
│  useTTS ◄─── tokens (enqueue) ─── flush on [DONE]        │
│  (Web Speech Synthesis API)                               │
└──────────────────────────────────────────────────────────┘
```

---

## Structure du projet

```
.
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   ├── globals.css               # CSS variables (thème dark)
│   └── api/
│       └── chat/
│           └── route.ts          # POST /api/chat — SSE stream Groq
│
├── components/
│   ├── VoiceInterview.tsx        # Composant principal (state machine)
│   ├── MessageBubble.tsx         # Bulles de message user/IA
│   ├── Waveform.tsx              # Animation audio pendant TTS
│   └── StatusBar.tsx             # Indicateur de phase
│
└── lib/
    ├── useSTT.ts                 # Hook STT + détection silence 2s
    └── useTTS.ts                 # Hook TTS + buffer/flush streaming
```

---

## Installation

### Prérequis

- Node.js 18+
- Clé API Groq gratuite : [console.groq.com](https://console.groq.com)

### Setup

```bash
# 1. Cloner le repo
git clone https://github.com/ton-username/superinterview.git
cd superinterview

# 2. Installer les dépendances
npm install

# 3. Configurer la clé API
cp .env.example .env.local
# Éditer .env.local : GROQ_API_KEY=gsk_...

# 4. Lancer
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) dans **Chrome** ou **Edge**.

Vidéo démo : https://drive.google.com/file/d/1tjOkkVGhsLBgKbbWN0UsJUgI3pprGgLu/view?usp=drive_link

### Variables d'environnement

```bash
# .env.local
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

La clé n'est jamais exposée côté client — elle passe uniquement par l'API Route Next.js côté serveur.

---

## Décisions techniques sur la latence

**Détection de silence côté client** — plutôt qu'un bouton, le timer de 2s maintient une conversation fluide et naturelle.

**Streaming SSE bout en bout** — les tokens arrivent un par un, s'affichent immédiatement, et le TTS commence sans attendre la fin de la génération complète.

**STT et TTS sans réseau** — les deux étapes les plus fréquentes tournent entièrement dans le navigateur. Seul le LLM fait un appel réseau.

**`max_tokens: 300`** — le system prompt force des réponses courtes (2 à 4 phrases). Moins de tokens générés = TTS qui démarre plus tôt.

**Machine d'état explicite** :
```
idle → listening → thinking → speaking → idle
```
Les boutons sont désactivés pendant `thinking` et tant que `tts.isSpeaking === true` pour éviter les soumissions en double.

---

## Sécurité

La clé API Groq est stockée uniquement dans `.env.local` côté serveur. L'API Route Next.js sert de proxy — rien ne transite par le navigateur.

---

## Pistes pour une v2

- **STT** : Whisper via WebSocket pour une meilleure précision multilingue
- **TTS** : ElevenLabs ou Azure Neural TTS pour une voix plus naturelle
- **LLM** : Prompt configurable selon le poste visé
- **Auth** : Protéger l'API Route avec un token utilisateur
- **Analytics** : Durée d'entretien, nombre d'échanges, score automatique

---

## Dépendances principales

| Package | Version | Rôle |
|---|---|---|
| `next` | 16.1.6 | Framework React fullstack |
| `react` | 19.2.3 | UI |
| `typescript` | ^5 | Typage statique |

Pas de dépendance externe pour STT/TTS (Web APIs natives), pas de SDK Groq (simple `fetch`).
