# Deploying to Coolify

The app is TanStack Start with SSR (Nitro + server functions), so it needs a
running Node process — nginx alone cannot serve it. The stack is two
containers:

| Service | Image target | Role |
| --- | --- | --- |
| `app` | `app` | Nitro SSR server on port 3000, internal only |
| `web` | `web` | nginx on port 80 — serves `/_build` and `/assets` off disk, proxies everything else to `app` |

## Coolify setup

1. **New Resource → Docker Compose**, point it at this repository.
2. Compose file: `docker-compose.yml`.
3. Attach your domain to the **`web`** service, port **80**. Leave `app`
   without a domain — Coolify's proxy terminates TLS in front of nginx.
4. Deploy.

## Local check

```bash
docker compose up --build
```

Then hit the `web` container. `GET /nginx-health` returns `ok`.

## Notes

- `NITRO_PRESET=node-server` is forced in the build stage. The Vite config
  defaults Nitro to the Cloudflare target, which produces a Workers bundle
  that will not run on a VPS. The build fails loudly if
  `.output/server/index.mjs` is missing.
- `proxy_buffering off` is required: TanStack Start streams SSR HTML, and
  buffering would hold the shell back until the full document rendered.
- nginx resolves `app` through Docker's embedded DNS (`127.0.0.11`) at request
  time rather than via an `upstream {}` block, so it boots even while `app` is
  still starting.
- No `VITE_*` variables are read by the app today. When you add one, declare
  it as an `ARG`/`ENV` pair in the build stage and as a compose build arg —
  runtime environment variables are too late, Vite inlines these at build time.
- Add a `Content-Security-Policy` in `nginx/security-headers.conf` once the
  external origins the app talks to (map tiles, APIs) are settled.
