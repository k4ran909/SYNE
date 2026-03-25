# O3DN Management Bot

A highly modular and advanced Discord management bot built with TypeScript, Sapphire Framework, Discord.js, and PostgreSQL. Designed for **multi-server scalability** with Discord sharding, Redis caching, and Docker deployment.

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+)
- PostgreSQL 16+
- Redis 7+ (required for production/sharding)

### Local Development
```bash
npm install
# Set up .env from .env.example
npm run prisma:push
npm run dev              # Single instance
npm run dev:sharded      # With shard manager
```

### Docker (Recommended for Production)
```bash
# Set DISCORD_TOKEN and DB_PASSWORD in .env
npm run docker:up        # Starts bot + PostgreSQL + Redis
npm run docker:logs      # View bot logs
npm run docker:down      # Stop everything
```

### PM2 (VPS Alternative)
```bash
npm run pm2:start        # Managed by PM2
npm run pm2:logs         # View logs
npm run pm2:stop         # Stop bot
```

---

## 🛠️ Commands List

### 🛡️ Moderation Commands
| Command | Aliases | Description | Permissions Required |
|---------|---------|-------------|----------------------|
| `/warn` | — | Warn a user with an optional reason. Adds to infraction history. | Timeout Members |
| `/mute` | — | Mute (timeout) a user for a specific duration (e.g., `10m`, `1h`). | Timeout Members |
| `/kick` | — | Kick a user from the server and send them a DM with the reason. | Kick Members |
| `/ban` | — | Ban a user (temporarily or permanently) and optionally purge messages. | Ban Members |
| `/infractions` | — | View the active infractions and warning history for a user. | Timeout Members |
| `/mv` / `!mv` | `!drag`, `!move` | Move a user from their current voice channel to yours. | Move Members |

### 🔐 Security Commands
| Command | Aliases | Description | Permissions Required |
|---------|---------|-------------|----------------------|
| `/lockdown` | — | Manually activate/deactivate Beast Mode to lock down the server during a raid. | Administrator |
| `/antiraid` | — | Configure the heuristic anti-raid scoring threshold and time window. | Administrator |

### 🎭 Role Management
| Command | Aliases | Description | Permissions Required |
|---------|---------|-------------|----------------------|
| `/autorole` | — | Toggle auto-assignment of a role when a new member joins the server. | Manage Roles |
| `/reactionrole` | — | Create a persistent button panel in a channel for users to self-assign a role. | Manage Roles |

### 📋 Logging Configuration
| Command | Aliases | Description | Permissions Required |
|---------|---------|-------------|----------------------|
| `/setlog` | — | Set the destination channel for specific log types (Moderation, Messages, Join/Leave). | Manage Guild |

---

## 🏗️ Architecture

```
┌──────────────────────┐
│   Shard Manager      │  ← src/shard.ts
│   (discord.js)       │
├──────┬───────┬───────┤
│ S0   │  S1   │  S2   │  ← Auto-scaled shards
└──┬───┴───┬───┴───┬───┘
   │       │       │
   ▼       ▼       ▼
┌──────────────────────┐
│     Redis (Pub/Sub)  │  ← Cross-shard state
│     + Config Cache   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   PostgreSQL         │  ← Persistent data
│   (Prisma ORM)       │
└──────────────────────┘
```

---

> **Note:** Whenever a new command is added, please update this README accordingly.
