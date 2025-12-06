# Interchat Demo Workspace

Interchat is a multilingual chat workspace built with **Next.js 16**, **Supabase**, and the **OpenAI Responses API**.  
This repository ships with demo data, realtime updates, credit tracking, and an admin-friendly pricing dashboard so you can explore, test, or extend the product quickly.

---

## Key Capabilities

- **Realtime multilingual chat** – Messages are auto-detected, translated, cached, and broadcast to every participant.
- **Supabase-driven auth & data** – Anonymous and password/Google sign-in, RLS-secured tables, and Realtime subscriptions.
- **Credit-based billing** – Each translation consumes credits; the dashboard estimates cost, margin, and recommended retail pricing.
- **Open room explorer** – Users can browse unlocked rooms, join them in one click, and the chat history records join/leave events.
- **Direct messages** – Dedicated 1:1 rooms with realtime pop-up notifications and translation support.
- **System messages** – When a member joins or leaves a group room, the room receives a highlighted activity message automatically.

---

## Project Structure

```
app/
  (app)/rooms        // Dashboard, room explorer, pricing, management views
  (auth)/...         // Auth flows (login, reset, setup)
  actions/           // Server actions (Supabase, Stripe, credits, rooms, translation)
  components/        // Shared UI and client components (chat window, sidebar, pop-ups)
lib/                 // Supabase helpers, pricing logic, translation utilities
supabase/            // SQL migrations, seed data, RPC definitions
public/              // Assets, verification files
```

---

## Prerequisites & Environment Variables

Copy `.env` to `.env.local` and populate the following (remove any unused Stripe IDs if you are not selling credits yet):

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
NEXT_PUBLIC_SITE_URL=https://interchat-eight.vercel.app/
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_AGENT_MODEL=gpt-4o-mini
LINE_AGENT_MEMORY_LIMIT=15
# LINE_AGENT_SYSTEM_PROMPT="Custom instructions for the LINE agent"

# Optional overrides
# OPENAI_TRANSLATION_MODEL=gpt-4o-mini
# OPENAI_DETECTION_MODEL=gpt-4o-mini
# PRICING_TARGET_MARGIN=0.6
# PRICING_MIN_PRICE_PER_CREDIT=0.01
KNOWLEDGE_STORAGE_BUCKET=knowledge-sources
KNOWLEDGE_INGESTION_KEY=your-secure-ingestion-key

# Stripe one-time purchase price IDs (leave blank to disable checkout buttons)
STRIPE_SECRET_KEY=...
STRIPE_PRICE_ID_STARTER=...
STRIPE_PRICE_ID_GROWTH=...
STRIPE_PRICE_ID_BUSINESS=...
```

> You must use the Supabase **service role key** for any server action that inserts messages, translations, or credit records.  
> Google OAuth can be enabled in Supabase Dashboard → Authentication → Providers if you prefer social sign-in.

---

## Getting Started Locally

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Apply schema & seed data**

   ```bash
   set -a
   source .env.local
   npx supabase db push --db-url "$DIRECT_URL"
   ```

3. **Run the development server**

   ```bash
   npm run dev
   ```

4. Visit `http://localhost:3000` to explore the seeded workspace. The demo room `global-collab` includes sample messages and translations so you can understand the experience immediately.

---

## Translation Flow

1. User submits a message from the composer.
2. `sendMessage` server action validates the session and writes to `messages`.
3. The language is auto-detected (or reused from cache).
4. `translation_cache` is checked for identical phrases; cache hits are free.
5. For cache misses, OpenAI is invoked (default model `gpt-4o-mini`), a translation is persisted to `message_translations`, and a cache entry is stored.
6. Credits are deducted (`user_credit_balances`) and usage details logged in `translation_usage_logs`.
7. Supabase Realtime pushes `messages` and `message_translations` inserts to connected clients so every chat window updates instantly.

---

## Credits & Pricing Model

- **Welcome credits:** Non-anonymous users receive **30 credits** automatically via `ensureProfile`.
- **Conversion:** `TOKENS_PER_CREDIT = 30` (adjust in `lib/pricing.ts` if your business model changes).
- **Packages:** Only three one-time purchase packages remain (`Starter`, `Growth`, `Business`) as defined in `lib/credits.ts`. Monthly subscriptions are disabled by default.
- **Dashboard:** `/rooms/pricing` aggregates usage logs, estimates cost per credit, and suggests retail price points based on configurable margin.

To adjust an existing user’s balance, update the `user_credit_balances` table or call the `addCredits` / `spendCredits` RPCs provided by Supabase.

---

## Rooms & Membership

- **Explore open rooms:** `/rooms/explore` lists all unlocked group rooms the user is not already in. Search works on name, slug, and description.
- **Joining rooms:** Clicking “Join room” triggers `joinRoom` – it verifies the room is unlocked, adds the user to `room_members`, and posts a system notification (`🔔 username joined the room.`).
- **Leaving rooms:** When a user leaves via the sidebar context menu, `deleteOrLeaveRoom` posts a `👋 username left the room.` message before removing the membership.
- **Direct messages:** Real-time pop-up notifications appear when a DM arrives, letting the recipient jump straight into the conversation.

To enforce “open room only” behaviour, ensure the `is_locked` field is managed through the management UI or Supabase dashboard.

---

## Knowledge Ingestion

1. Users submit URL / PDF / YouTube sources from `/knowledge`. Each entry lands in `knowledge_sources` with `status = pending`.
2. Run the ingestion worker by calling:

   ```bash
   curl -X POST \
     -H "Authorization: Bearer $KNOWLEDGE_INGESTION_KEY" \
     https://your-domain.com/api/knowledge/process
   ```

   (Replace `your-domain.com` with localhost or your Vercel deployment. Add `?limit=5` to process more items per run.)
3. The worker fetches content, chunks it, writes to `knowledge_chunks`, and marks sources `ready` or `error`. Schedule this endpoint via Vercel Cron or any job runner to automate ingestion.

PDF uploads are stored in the Supabase Storage bucket named in `KNOWLEDGE_STORAGE_BUCKET`.

---

## Deployment Notes

- The project is configured for **Next.js 16 + Turbopack**. When deploying to Vercel, make sure environment variables match `.env.local`.
- Fonts (Geist) are loaded via `next/font`. Ensure the build machine has outbound network access during `next build`.
- If you need internationalisation on URLs, adapt Next.js routing or add middleware. For now, translations are handled per user preference within the chat.

---

## Useful Supabase Functions / Tables

| Table / RPC                    | Purpose                                               |
|--------------------------------|-------------------------------------------------------|
| `messages`, `message_translations` | Store raw text + translated text                    |
| `line_agent_logs`              | Memory + audit log for the LINE OA sales agent        |
| `knowledge_sources`            | Queue of URL / PDF / YouTube sources for ingestion    |
| `knowledge_chunks`             | Processed text chunks ready for retrieval             |
| `translation_cache`            | Prevent duplicate OpenAI calls                        |
| `translation_usage_logs`       | Tracking tokens, cost, credits                        |
| `user_credit_balances`, `user_credit_transactions` | Credit wallet & audit trail             |
| `joinRoom` (server action)     | Validates unlocked room, inserts membership, posts system message |
| `deleteOrLeaveRoom` (server action) | Handles membership removal / deletion + system message |
| `ensureProfile`                | Creates profile + grants welcome credits              |

---

## Contributing / Extending

- **PWA or mobile:** The layout is responsive, but you can enhance it further or package business logic for reuse in React Native / Expo.
- **Push notifications:** Integrate Supabase Edge Functions or Expo notifications for richer mobile experiences.
- **Moderation:** Extend `translation_usage_logs` and `reports` tables to track misuse or add AI moderation.

Feel free to fork, experiment, and adapt Interchat to your own multilingual collaboration needs!
