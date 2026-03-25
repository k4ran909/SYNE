# O3DN Management Bot — Enterprise MVP & Feature Rollout Plan

> **Architecture:** Modular Monolith · **Stack:** Bun + TypeScript + Sapphire (discord.js)  
> **Data:** PostgreSQL (Prisma + pgvector) · **Cache:** Bun Native Redis  
> **Deploy:** Docker (Alpine) → European Bare-Metal/VPS with L7 DDoS Protection

---

## 🚀 Phase 1: The MVP — Security, Moderation & Core Infrastructure
*Goal: Ship a rock-solid, production-ready bot that server admins trust to protect their community on day one.*

---

### 🛡️ 1.1 — Advanced Moderation System `src/modules/moderation/`

| Feature | Implementation Detail |
|---|---|
| **Automod Engine** | Semantic NLP text analysis (not just regex). Catches zero-width char evasion, homoglyph substitution, and contextual harassment. |
| **AI Toxicity Detection** | Lightweight classifier model invoked off the main event loop. Utilizes Discord **Social SDK 1.8 `ModerationMetadata`** to proactively block toxic messages *before* they render on-screen. |
| **Warn / Mute / Kick / Ban** | Slash commands with reason logging, DM notifications to the target user, and automatic Embed dispatch to the moderation log channel. |
| **Temporary Punishments** | Redis TTL-based scheduler. Temp-mutes and temp-bans auto-expire without polling the database. |
| **Escalation Matrix** | Configurable per-guild strike thresholds: `Warn → Temp-Mute → Quarantine Role → Temp-Ban → Perma-Ban`. All states cached in Redis. |
| **Anti-Spam** | Rate-limit detection on `messageCreate` (duplicate content, message velocity, mention spam, emoji flood). |

---

### 🔐 1.2 — Enterprise Security System `src/modules/security/`

| Feature | Implementation Detail |
|---|---|
| **Anti-Nuke** | Monitors `ChannelDelete`, `RoleDelete`, `GuildBanAdd` Gateway events. If destructive actions exceed a configurable threshold within a time window, the bot revokes the actor's permissions instantly. |
| **Anti-Raid (Heuristic Scoring)** | Assigns a real-time risk score to each `GuildMemberAdd` event based on: account age (+5), no avatar (+5), join velocity/row (+10). Breaching the threshold triggers **"Beast Mode"** — autonomous server lockdown. |
| **Role Permission Monitor** | Watches `GuildRoleUpdate` events. Alerts admins instantly if a role gains dangerous permissions (`ADMINISTRATOR`, `BAN_MEMBERS`, `MANAGE_GUILD`) outside of approved actions. |
| **Suspicious Activity Detection** | Flags accounts performing unusual patterns (mass DMs, rapid channel hopping, webhook creation spam). |
| **Server Backup System** | Serializes guild structure (channels, roles, permissions, settings) to a JSON snapshot stored in PostgreSQL. Provides a `/restore` command for disaster recovery. |

---

### 🎭 1.3 — Role Management `src/modules/roles/`

| Feature | Implementation Detail |
|---|---|
| **Auto-Roles on Join** | Leverages the **Community Invites API** to attach `role_id`s directly to invite links — native, instant, zero rate-limit role assignment. |
| **Button / Dropdown Roles** | Persistent `ButtonBuilder` and `StringSelectMenuBuilder` components on role-selection messages. Supports up to 250 roles per message (Carl-bot parity). |
| **Verification Gate** | Button-click verification for basic entry; upgradeable to **OAuth2 SSO** (GitHub, Google, X) or **CAPTCHA** challenge for high-security servers. |
| **Role Hierarchy Protection** | Sapphire `Precondition` guard preventing any user from assigning/removing roles above their own hierarchy position. |
| **Role Sync** | Syncs roles across linked multi-guild setups via Redis Pub/Sub. |

---

### 📊 1.4 — Audit Logging System `src/modules/logging/`

| Feature | Implementation Detail |
|---|---|
| **Message Logs** | Captures `messageUpdate` and `messageDelete` events with full content diffs, author, and timestamp. |
| **Moderation Logs** | Every warn/mute/kick/ban action generates an immutable, color-coded Embed citing the specific server rule violated. |
| **Join/Leave Logs** | Logs `GuildMemberAdd`/`GuildMemberRemove` with account age, invite used, and risk score. |
| **Historical Search** | Integrates the **Search Guild Messages** API endpoint for server-wide indexed search, offloading storage costs to Discord's infrastructure. |

---

## ⚡ Phase 2: Community Engagement & Support Tools (V1.5)
*Goal: Equip community managers with AI-assisted support tools and gamification to drive daily retention.*

---

### 🎟️ 2.1 — Pro-Level Ticket System `src/modules/tickets/`

| Feature | Implementation Detail |
|---|---|
| **Button-Based Creation** | Persistent panel with category-specific buttons (e.g., "Bug Report", "Billing", "Partnership"). |
| **Multiple Categories** | Each category has its own channel prefix, staff role assignment, and SLA timer. |
| **AI Triage (RAG)** | Before pinging staff, the bot queries the `pgvector`-powered FAQ knowledge base to attempt instant autonomous resolution. |
| **Staff Assignment** | Round-robin or least-busy assignment algorithm. Staff can `/claim` and `/transfer` tickets. |
| **Transcripts** | Full HTML/PDF transcript generation on ticket close, archived to PostgreSQL with searchable metadata. |
| **Auto-Close** | Configurable inactivity timer. Warns the user, then closes and archives automatically. |
| **Ticket Analytics** | Dashboard-ready metrics: avg resolution time, tickets per category, staff performance, peak hours. |
| **i18n Support** | Multi-language ticket flows via `@sapphire/plugin-i18next`. |

---

### 🎮 2.2 — Leveling & XP System `src/modules/leveling/`

| Feature | Implementation Detail |
|---|---|
| **XP per Message** | Anti-spam cooldown (Redis TTL, e.g., 1 XP event per 60s per user) to prevent farming. |
| **Voice Activity XP** | Tracks `VoiceStateUpdate` events. Calculates XP based on unmuted/camera-on duration. Ignores AFK channels. |
| **Rank Roles** | Auto-assigns configurable milestone roles (e.g., Level 10 → "Regular", Level 50 → "Veteran"). |
| **Leaderboards** | `/leaderboard` command with paginated Embeds. Global and per-server rankings. |
| **Custom Rewards** | Admins define custom rewards redeemable at specific level thresholds. |
| **High-Performance Writes** | XP gains are batched in a **Redis in-memory queue** and bulk-committed to PostgreSQL on a timed interval to prevent I/O bottleneck during chat spikes. |

---

### 📅 2.3 — Events & Automation `src/modules/events/`

| Feature | Implementation Detail |
|---|---|
| **Scheduled Messages** | Cron-based scheduler (Dependency Injected via Sapphire) for recurring announcements. |
| **Event Reminders** | `/event create` with RSVP buttons. Automated reminder DMs at T-24h, T-1h, and T-15m. |
| **Google Calendar Sync** | OAuth2 integration to pull events from a linked Google Calendar and post them automatically. |
| **Twitch/YouTube Alerts** | Webhook listeners for stream go-live and video upload notifications, posted to a configured channel. |

---

## 🧠 Phase 3: AI Engine & Web Control Panel (V2.0)
*Goal: Deploy the differentiating AI knowledge engine and give admins a powerful web-based control panel.*

---

### 🧠 3.1 — AI Knowledge Engine `src/modules/ai/`

| Feature | Implementation Detail |
|---|---|
| **ChatGPT-like Assistant** | LLM integration (OpenAI / local model) invoked via isolated worker threads to keep the Gateway event loop unblocked. |
| **Auto FAQ (RAG)** | Server wikis, rules, and past tickets are chunked, embedded (OpenAI `text-embedding-3-small`), and stored in PostgreSQL via `pgvector`. The bot performs cosine similarity search to answer user questions with zero hallucination. |
| **AI Moderation v2** | Deep semantic toxicity analysis replaces the Phase 1 lightweight classifier. Understands sarcasm, coded language, and social engineering. |
| **Memory (User Context)** | Per-user conversation history stored in PostgreSQL. The bot remembers prior interactions for personalized, contextual responses. |
| **Image Generation** | Integrates a diffusion model API (Stability AI / DALL-E) for `/imagine` commands. Results delivered as Discord attachments. |
| **`/summarize`** | Extracts sentiment, action items, and key decisions from lengthy threads, delivering a concise executive summary. |

---

### 🌐 3.2 — Web Dashboard `src/modules/dashboard/`

| Feature | Implementation Detail |
|---|---|
| **Internal REST API** | Exposed from within the same Bun process via `@sapphire/plugin-api`. Zero inter-service latency. |
| **Frontend** | React/Next.js SPA with Discord OAuth2 login. |
| **Config Management** | Toggle modules on/off, configure automod thresholds, set log channels — all from the browser. |
| **Log Viewer** | Searchable, filterable web-based moderation and message logs. |
| **Analytics Charts** | Server growth, member activity heatmaps, moderation action trends, XP distribution graphs. |
| **HMR Updates** | Bot commands and configs can be hot-reloaded via `@sapphire/plugin-hmr` without dropping the WebSocket. |

---

### 🧩 3.3 — Custom Command Builder `src/modules/custom-commands/`

| Feature | Implementation Detail |
|---|---|
| **Dashboard Command Creator** | WYSIWYG interface to create text responses, custom Embeds, and button actions without writing code. |
| **Variables System** | Template variables like `{user.name}`, `{server.memberCount}`, `{channel.name}` for dynamic responses. |
| **Trigger Types** | Prefix commands, slash commands, keyword triggers, and regex matchers. |

---

## 🎉 Phase 4: Economy, Gamification & Scale (V3.0)
*Goal: Add heavyweight entertainment features that drive daily active usage and prepare for massive scale.*

---

### 💰 4.1 — Economy System `src/modules/economy/`

| Feature | Implementation Detail |
|---|---|
| **Currency** | Global and per-server virtual currency. Configurable name and symbol. |
| **Shop System** | Admins create purchasable items (custom roles, profile badges, XP boosts). |
| **Daily Rewards** | Streak-based daily claims with escalating bonuses. |
| **Gambling / Mini-Games** | Coinflip, Blackjack, Slots, and Dice — all using **atomic PostgreSQL transactions** to prevent currency duplication and double-spend exploits. |
| **Transfers & Trading** | Peer-to-peer currency transfers with transaction logging. |

---

### 🎉 4.2 — Fun & Engagement `src/modules/fun/`

| Feature | Implementation Detail |
|---|---|
| **Memes & Jokes** | Reddit API / custom meme feed integration. |
| **Trivia** | Multi-category trivia with leaderboard integration. |
| **Giveaways** | Resilient giveaway manager. Active giveaways persist in PostgreSQL, surviving bot restarts. Supports requirements (minimum level, specific role, account age). |
| **Music** | Optional Lavalink/Shoukaku integration for voice channel music playback. |

---

## 🌟 Phase 5: SaaS & Differentiation (V4.0)
*Goal: Transform the bot into a unique, monetizable platform.*

---

### ⚡ 5.1 — Advanced Differentiators `src/modules/advanced/`

| Feature | Implementation Detail |
|---|---|
| **AI Server Moderator** | Fully autonomous moderation decisions (auto-escalate, auto-de-escalate) with human-reviewable audit trail. |
| **Voice Channel Manager** | Auto-creates temporary voice channels on join ("Join to Create") and auto-deletes when empty. |
| **Community Reputation** | Cross-server reputation score based on moderation history, helpfulness (ticket resolutions), and community contributions. |
| **Plugin Marketplace** | Third-party developers can publish custom modules loaded at runtime via a sandboxed plugin loader. |
| **Multi-Server SaaS** | Centralized admin panel to manage multiple guilds from a single dashboard with per-guild billing. |
| **Premium/Monetization** | Stripe integration for premium tier subscriptions. Gated features (AI, advanced analytics) behind a paywall. |

---

## 🛠️ Enterprise Tech Stack Summary

| Layer | Technology | Justification |
|---|---|---|
| **Runtime** | **Bun** | Near-instant cold starts, native TS execution, built-in Redis client (7.9x faster than `ioredis`). |
| **Language** | **TypeScript** (Strict) | Compile-time type safety across all 12+ modules. |
| **Framework** | **Sapphire** | OOP modular monolith. Enforces strict separation of Commands, Listeners, Preconditions, and Services. Plugins for HMR, REST API, and i18n. |
| **Primary DB** | **PostgreSQL** + **Prisma** | Relational integrity for guilds, users, infractions, economy. |
| **Vector Store** | **pgvector** (PostgreSQL ext.) | Native cosine similarity search for RAG/AI features. No external vector DB needed. |
| **Cache/State** | **Redis** (Bun Native) | Ephemeral state: cooldowns, rate limits, XP queues, temp-ban TTLs, cross-shard Pub/Sub. |
| **Containerization** | **Docker** (Alpine, multi-stage) | Minimal image size, non-root execution, `dumb-init` for graceful SIGTERM handling. |
| **Hosting** | **OVHcloud / EUGameHost** | European bare-metal with L7 Game DDoS protection, single-digit ms latency to Discord Gateway. |

---

## ⚡ Performance Optimization Strategy

| Strategy | Detail |
|---|---|
| **Event-Driven Architecture** | Internal `EventEmitter` + Redis Pub/Sub for decoupled inter-module communication. |
| **Aggressive Caching** | Redis caches guild configs, user permissions, and cooldown states. TTL-based auto-expiry. |
| **Sharding** | `discord.js` built-in `ShardingManager` for horizontal scaling beyond 2,500 guilds. |
| **Lazy-Loading Modules** | Sapphire's `@sapphire/plugin-hmr` loads modules on demand. Disabled modules consume zero resources. |
| **Batched DB Writes** | High-frequency events (XP, message logs) are queued in Redis and bulk-flushed to PostgreSQL on intervals. |
| **Worker Threads** | Heavy AI inference is offloaded to isolated worker threads, never blocking the Gateway event loop. |

---

## 📁 Modular Monolith Directory Structure

```
src/
├── client/              # Extended Sapphire Client, startup, graceful shutdown
├── modules/
│   ├── moderation/      # Automod, punishments, escalation
│   ├── security/        # Anti-nuke, anti-raid, beast mode, backups
│   ├── roles/           # Reaction roles, auto-roles, OAuth2 verification
│   ├── logging/         # Audit logs, message logs, join/leave
│   ├── tickets/         # Ticket system, RAG triage, transcripts
│   ├── leveling/        # XP, ranks, leaderboards, voice tracking
│   ├── events/          # Scheduled messages, reminders, alerts
│   ├── ai/              # LLM assistant, RAG, image gen, summarize
│   ├── dashboard/       # REST API, web panel backend
│   ├── custom-commands/ # User-created commands, embed builder
│   ├── economy/         # Currency, shop, gambling, trades
│   ├── fun/             # Memes, trivia, giveaways, music
│   └── advanced/        # Voice manager, reputation, plugins, SaaS
├── commands/            # Slash command presentation layer
├── guards/              # Preconditions (permissions, cooldowns, premium)
├── events/              # Gateway event listeners → route to modules
├── locales/             # i18n translation files
└── lib/                 # Shared utilities, constants, types
```
