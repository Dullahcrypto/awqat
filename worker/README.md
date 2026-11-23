# Awqat worker (Cloudflare, free plan)

The worker keeps your Anthropic API key off the website and handles three things:

| Endpoint | What it does |
|---|---|
| `POST /scan` | Reads a photo of a prayer timetable with Claude and returns the times as JSON |
| `GET /news` | Pulls Islamic news from RSS feeds (Google News "Islam" for Nigeria by default) |
| `GET /videos` | Pulls the latest videos from the YouTube channels you list |

## Set it up in the browser (no terminal needed)

1. Go to **dash.cloudflare.com**, sign up (free), open **Workers & Pages → Create → Create Worker**.
2. Name it `awqat`, click **Deploy**, then **Edit code**.
3. Delete the sample code, paste everything from `worker.js`, click **Deploy**.
4. Open the worker's **Settings → Variables and Secrets** and add:
   - `ANTHROPIC_API_KEY`: type **Secret**, value = your key from console.anthropic.com
   - `ALLOWED_ORIGIN`: `https://dullahcrypto.github.io`
   - optional `YT_CHANNELS`: YouTube channel IDs (start with `UC…`), comma-separated
   - optional `NEWS_FEEDS`: RSS links, comma-separated (replaces the defaults)
5. Copy the worker link (looks like `https://awqat.<you>.workers.dev`).
6. In Awqat, either paste it in **Settings → Awqat worker link**, or put it in `config.js` → `WORKER_URL` so every user gets it.

## Or with the terminal

```bash
cd worker
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```

Each scan is one Claude request with one image, so the cost is small. You can set a monthly spend limit at console.anthropic.com.
