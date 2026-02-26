# SuperInterview — Simulateur d'entretien vocal par IA

> **Test Technique Lead Dev IA – ProcessIQ**  
> Pipeline complet **STT → LLM → TTS** en temps réel, conçu pour minimiser la latence perçue.

---

##  Demo

```
Parole utilisateur → Web Speech API (STT) → Groq/Llama 3.3-70B (LLM streaming) → Web Speech Synthesis (TTS)
```

---

## ⚙️ Stack & Choix Technologiques

### STT — Web Speech API (navigateur natif)
**Pourquoi pas Whisper ou Deepgram ?**

| Critère | Web Speech API | Whisper/Deepgram |
|---|---|---|
| Latence | **0 ms** (local) | 300–800 ms (réseau) |
| Coût | Gratuit | Payant |
| Résultats interims | ✅ Oui | ❌ Non (ou WebSocket custom) |
| Précision FR | Bonne (Chrome) | Excellente |

La Web Speech API tourne entièrement dans le navigateur. Pas de round-trip réseau pour la transcription → latence quasi-nulle. Les **résultats interims** permettent d'afficher le transcript en temps réel pendant que l'utilisateur parle.

**Détection de silence automatique** : un `setTimeout` de 2s se réinitialise à chaque token de parole reçu. À expiration, la réponse est soumise automatiquement — sans aucune intervention utilisateur. Le bouton manuel reste disponible en secours.

> **Limitation connue** : non supporté sur Firefox. Chrome et Edge uniquement.

---

### LLM — Llama 3.3-70B via Groq
**Pourquoi Groq plutôt qu'OpenAI ou Gemini ?**

Groq utilise des **LPU** (Language Processing Units) au lieu de GPU, ce qui donne des vitesses de génération de **300–500 tokens/seconde** — soit 5–10× plus rapide qu'OpenAI GPT-4.

| Critère | Groq (Llama 3.3-70B) | OpenAI GPT-4o | Gemini Flash |
|---|---|---|---|
| Vitesse tokens/s | **~400** | ~80 | ~150 |
| Coût | **Gratuit** (tier free) | ~$5/1M tokens | ~$0.10/1M |
| Qualité FR | Très bonne | Excellente | Bonne |
| Streaming SSE | ✅ | ✅ | ✅ |

L'API Groq est **compatible OpenAI** — drop-in replacement sans SDK spécial, juste un `fetch` vers `api.groq.com`.

**Streaming token par token** : la réponse est affichée et envoyée au TTS au fur et à mesure (`enqueue`), sans attendre la fin de la génération.

---

### TTS — Web Speech Synthesis API (navigateur natif)
**Pourquoi pas ElevenLabs ou Azure TTS ?**

Même logique que pour le STT : zéro latence réseau. La synthèse commence **dès que le dernier token arrive** (`flush` après `[DONE]`).

Le texte est nettoyé avant synthèse (suppression du markdown que Llama peut émettre : `**bold**`, `*italic*`, `` `code` ``, `### heading`).

> Pour une v2 production : ElevenLabs ou Azure Neural TTS pour une voix plus naturelle, avec streaming audio WebSocket pour maintenir la faible latence.

---

##  Architecture

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
│   ├── page.tsx                  # Entry point
│   ├── layout.tsx
│   ├── globals.css               # CSS variables (thème dark)
│   └── api/
│       └── chat/
│           └── route.ts          # POST /api/chat — SSE stream Groq
│
├── components/
│   ├── VoiceInterview.tsx        # Composant principal (state machine)
│   ├── MessageBubble.tsx         # Bulle de message user/IA
│   ├── Waveform.tsx              # Animation audio pendant TTS
│   └── StatusBar.tsx             # Indicateur de phase
│
└── lib/
    ├── useSTT.ts                 # Hook STT + détection silence 2s
    └── useTTS.ts                 # Hook TTS + buffer/flush streaming
```

---

##  Installation & Lancement

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
# Éditer .env.local et renseigner GROQ_API_KEY=gsk_...

# 4. Lancer en développement
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) dans **Chrome** ou **Edge**.
🎥 Vidéo démo : https://drive.google.com/file/d/1tjOkkVGhsLBgKbbWN0UsJUgI3pprGgLu/view?usp=drive_link

### Variables d'environnement

```bash
# .env.local
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

> La clé n'est jamais exposée côté client. Elle est utilisée uniquement dans l'API Route Next.js côté serveur.

---

##  Gestion de la latence — Décisions clés

### 1. Silence Detection côté client
Plutôt que d'attendre un bouton, un timer de **2 secondes** se réinitialise à chaque token de parole. Cela évite un round-trip "appuyer sur envoyer" et maintient une conversation naturelle.

### 2. Streaming SSE bout en bout
Le LLM envoie les tokens un par un via **Server-Sent Events**. Le composant React affiche chaque token immédiatement, et le TTS commence à parler **sans attendre la fin de la réponse complète**.

### 3. Pas de réseau pour STT/TTS
Les deux étapes les plus fréquentes (écoute et parole) fonctionnent **hors ligne** dans le navigateur. Seul le LLM nécessite un appel réseau.

### 4. `max_tokens: 300` sur le LLM
Le system prompt impose des réponses courtes (2–4 phrases). Moins de tokens = fin de génération plus rapide = TTS démarre plus tôt.

### 5. Machine d'état explicite
```
idle → listening → thinking → speaking → idle
```
Chaque transition est claire. Les boutons sont désactivés pendant `thinking` et tant que `tts.isSpeaking === true` pour éviter les soumissions parasites.

---

## 🔒 Sécurité

- La clé API Groq est stockée **uniquement** dans `.env.local` (côté serveur)
- Aucune clé n'est jamais envoyée au navigateur
- L'API Route Next.js fait office de proxy sécurisé

---

## 🛣️ Améliorations V2

- **STT** : Remplacer Web Speech API par Whisper via WebSocket pour une meilleure précision multilingue
- **TTS** : ElevenLabs ou Azure Neural TTS pour une voix plus naturelle
- **LLM** : Prompt configurable selon le poste visé
- **Auth** : Protéger l'API Route avec un token utilisateur
- **Analytics** : Durée d'entretien, nombre d'échanges, score automatique

---

## 📦 Dépendances principales

| Package | Version | Rôle |
|---|---|---|
| `next` | 16.1.6 | Framework React fullstack |
| `react` | 19.2.3 | UI |
| `typescript` | ^5 | Typage statique |

**Aucune dépendance externe pour STT/TTS** — Web APIs natives du navigateur.  
**Aucun SDK Groq** — l'API est compatible OpenAI, un simple `fetch` suffit.

---

## 👤 Auteur

Développé dans le cadre du test technique **Lead Dev IA – ProcessIQ**  
Délai : 24h | Stack : Next.js 16 · React 19 · TypeScript · Groq · Web Speech API
