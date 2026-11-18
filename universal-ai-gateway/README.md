# Universal AI Gateway

Standalone Cloudflare Worker that exposes one authenticated, OpenAI-style chat endpoint for multiple projects.

## Status

Foundation implementation. Not deployed. No provider secrets are configured. Paid API routes and OpenRouter are disabled by default.

## API

- `GET /health`
- `POST /v1/chat/completions`

Example request:

```http
Authorization: Bearer <project-token>
Content-Type: application/json
```

```json
{
  "provider": "cloudflare",
  "routeMode": "auto",
  "messages": [{ "role": "user", "content": "Hello" }]
}
```

Each project receives its own token. Configure `GATEWAY_PROJECT_KEYS` as a Worker secret containing a JSON object such as `{"unique-design-studio":"long-random-token","another-project":"another-long-random-token"}`. Never put project tokens or provider API keys in browser code or commit them to Git.

## Free-first configuration

The checked-in defaults use Cloudflare Workers AI, disable OpenRouter, and disable direct paid APIs. To enable the free OpenRouter route intentionally, set `OPENROUTER_ENABLED=true` and add `OPENROUTER_API_KEY` as a Worker secret. The implementation pins requests to `openrouter/free`; clients cannot supply a model name.

OpenAI and Anthropic direct APIs require all of: `AI_BILLING_MODE=api`, `AI_DIRECT_PROVIDERS_ENABLED=true`, and the respective server-side secret. These APIs can incur separate charges and must remain disabled unless the account owner explicitly chooses to enable them.

## Routing behavior

- `routeMode=primary`: call only the selected primary provider.
- `routeMode=auto`: call the selected primary provider; only a detected quota/rate-limit error (HTTP 429 or recognized quota message) triggers the configured OpenRouter Free fallback.
- `routeMode=openrouter`: use only the fixed OpenRouter Free route.
- Non-quota errors do not silently change providers.
- If no allowed route is available, return a sanitized error.

## Deploy

From this directory, with Wrangler authenticated to the intended Cloudflare account:

```sh
npx wrangler deploy
npx wrangler secret put GATEWAY_PROJECT_KEYS
# Optional, only after explicit decision to use OpenRouter Free:
npx wrangler secret put OPENROUTER_API_KEY
```

No deployment or secret creation is performed by this repository change.
