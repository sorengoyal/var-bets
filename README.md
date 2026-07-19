# VAR Bets

Live prediction markets for football VAR reviews. Place bets on whether a VAR decision will confirm or overturn an on-field call — all in real-time with video-synced odds.

Built as a hackathon prototype on the **TxLINE World Cup** free tier (Solana Mainnet).
Transaction for token creation - https://solscan.io/tx/5C4E4mdNR2yyE9u5dKCYK8FDy3JUYTPB9YpiZaQ2NAyM4BYJG69Q7uQcpNCUypXpFdPkcbcpPLKizYm3YMZCvytW

## Architecture

| Layer | App | Port | Stack |
|---|---|---|---|
| Mock data stream | `apps/mock-service` | 4000 | Express + TypeScript |
| Backend API | `apps/api` | 3000 | NestJS + TypeORM + PostgreSQL |
| Consumer UI | `apps/consumer-web` | 3001 | Next.js + Phantom Wallet |

**TxLINE stream is mocked** via `apps/mock-service` — a virtual clock replays pre-recorded fixture and score events. The original score stream for the Argentina Vs Egypt was missing a "goal" event which was needed for our demo. The mock service lets us **reset and replay** the full VAR lifecycle (goal → review → decision → payout) on demand for demo purposes.

The backend polls the mock service every 10 seconds, creating pools on goal events and resolving them on VAR decisions. Real-time updates flow to the frontend via Socket.IO (`poolUpdated`, `payoutExecuted`).

## Running locally

### Prerequisites

- Node 24
- pnpm 11
- Docker

### 0. Create environment files

Each app has a `.env.example` — copy and adjust as needed:

```sh
cp apps/mock-service/.env.example apps/mock-service/.env
cp apps/api/.env.example apps/api/.env
cp apps/consumer-web/.env.example apps/consumer-web/.env
```

### 1. Install & start the services

```sh
pnpm install
docker compose up -d
turbo start
```

Open `http://localhost:3001`, click **Use demo wallet**, and play the video to trigger the VAR betting flow.
