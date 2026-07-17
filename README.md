# Turborepo starter

## VARBET mobile app

The consumer-facing mobile VAR betting UI lives in [`apps/consumer-web`](apps/consumer-web). It is intentionally separated from the Nest API and mock service. It includes the real review video, a match-synchronized clock and score, interpolated prediction-market prices, Phantom Wallet Adapter support, pool discovery, inline order entry, wallet-specific bets and payouts, and automatic settlement.

The app is wallet-gated. Phantom wallets are supported, and development mode also offers a preloaded demo wallet with `1,000 USDC`. Connected users enter the live stream automatically. Stake entry appears with the market when the goal occurs; pressing `GOAL` or `NO GOAL` submits immediately at the displayed odds.

```sh
pnpm install
pnpm --filter consumer-web dev
```

Open `http://localhost:3000`, connect a wallet, and let the supplied match video drive the review through settlement. This is a no-real-money development experience; production payment, identity, market-data, geofencing, and regulatory integrations are intentionally not connected.

### Argentina vs Egypt event timeline

- Video `00:00` / match `57:38`: Argentina trail `0–1`; the pre-goal market signal remains unchanged and betting is closed.
- Video `00:17` / match `57:55`: the ball enters the net, the signal switches, Egypt temporarily lead `0–2`, and betting opens.
- Video `01:07` / match `58:45`: the referee reaches the monitor and the review status changes.
- Video `02:07` / match `59:45`: the announcement closes betting, resolves `NO GOAL`, returns the score to `0–1`, jumps the Polymarket signal to the post-decision observation, and opens a stake/payout/net-result modal.
- Market percentages interpolate between `42.72/53.18`, `23.18/75.57`, and `33.19/66.54` for Argentina/Egypt, then move toward the next post-decision observation.

Copy `apps/consumer-web/.env.example` to `apps/consumer-web/.env.local` to connect the frontend to the Nest API and a Solana RPC endpoint. Without `NEXT_PUBLIC_API_URL`, the timed match experience uses local data.

The API exposes REST endpoints under `/api`, Swagger under `/docs`, and Socket.IO events named `poolUpdated` and `payoutExecuted`.

## Admin dashboard

The operator-facing dashboard is a separate Next.js app in [`apps/admin-web`](apps/admin-web). It visualizes the Argentina–Egypt Polymarket path, pool settlement, risk controls, and scenario 10 Monte Carlo outputs.

```sh
pnpm --filter admin-web dev
```

## VAR betting engine research

The standalone Python order-execution engine and historical simulation are documented in [`research/var-betting-engine`](research/var-betting-engine/README.md).

This Turborepo starter is maintained by the Turborepo core team.

## Using this example

Run the following command:

```sh
npx create-turbo@latest
```

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `docs`: a [Next.js](https://nextjs.org/) app
- `web`: another [Next.js](https://nextjs.org/) app
- `@repo/ui`: a stub React component library shared by both `web` and `docs` applications
- `@repo/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo build
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo build
pnpm dlx turbo build
pnpm exec turbo build
```

You can build a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo build --filter=docs
```

Without global `turbo`:

```sh
npx turbo build --filter=docs
pnpm exec turbo build --filter=docs
pnpm exec turbo build --filter=docs
```

### Develop

To develop all apps and packages, run the following command:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo dev
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo dev
pnpm exec turbo dev
pnpm exec turbo dev
```

You can develop a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo dev --filter=web
```

Without global `turbo`:

```sh
npx turbo dev --filter=web
pnpm exec turbo dev --filter=web
pnpm exec turbo dev --filter=web
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo login
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo login
pnpm exec turbo login
pnpm exec turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo link
```

Without global `turbo`:

```sh
npx turbo link
pnpm exec turbo link
pnpm exec turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.dev/docs/reference/configuration)
- [CLI Usage](https://turborepo.dev/docs/reference/command-line-reference)
