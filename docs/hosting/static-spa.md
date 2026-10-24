# Static SPA hosting handoff

The frontend build is a static `dist` directory produced by `npm run build`. No Django server, database, email delivery, payment gateway or deployment is configured by this task. These are hosting examples for review; no provider, domain, TLS certificate or live deployment has been created.

The Vite configuration currently assumes the application is served at the origin root (`/`). Hosting below a subdirectory requires a coordinated Vite base and router configuration change plus rebuilt assets and deep-link tests; changing an upload folder alone is insufficient.

## Build and local production preview

From the checkout with the pinned Node/npm versions:

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run preview -- --port 4176 --strictPort
```

Open the local preview on port 4176. The Playwright development journeys use port 4173; keeping preview separate avoids confusing the development source server with built output. Vite preview is a local smoke server and should not be treated as production hosting.

TASK-039 execution evidence is recorded in [production verification](../testing/production.md), [performance review](../testing/performance.md) and [implementation progress](../implementation-progress.md) when actually completed. Its verification must identify the source copy, frozen install, executed checks, built output and preview URL/commands. A build succeeding alone does not prove deep-link, asset-loading, authentication or purchase behavior.

The recorded local preview uses Vite's generic fallback: an absent asset URL can return HTTP 200 HTML. The final host must apply the asset exclusions below; do not infer production asset-404 behavior from Vite preview.

A production-host smoke check should cover:

- Direct `/product/panels-550-1`, `/products` and policy URLs, followed by reload, with real rendered content and loaded JavaScript/styles/images.
- Direct `/account/profile` or an owned order URL: a guest reaches sign-in with the safe original path preserved, while a same-origin demo session restores its owned content.
- An unknown application route renders the React page-not-found recovery. A fallback commonly returns HTTP 200 for that entry document; a client-rendered 404 message is not an HTTP 404 response.
- Missing `/assets/...` and `/images/...` resources return 404 rather than the SPA HTML document. Incorrect fallback can otherwise produce MIME errors or hide missing chunks.

## Routing and fallback

Serve existing files first. Send application navigation requests such as `/product/:slug`, `/account/orders/:id` and `/contact` to `index.html` so React Router can resolve them. Exclude asset paths and any future backend prefix from the navigation fallback. A future `/api/` service must be explicitly routed to its backend, not rewritten to an HTML entry document.

The following Nginx example uses a placeholder filesystem location. Adapt it to the reviewed host configuration; it has not been installed or tested as a running Nginx service in this environment.

```nginx
server {
    listen 80;
    server_name _;
    root /srv/bdsolarenergy/dist;
    index index.html;

    location ^~ /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location ^~ /images/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=3600";
    }

    location = /index.html {
        try_files $uri =404;
        add_header Cache-Control "no-cache" always;
    }

    location ^~ /api/ {
        return 404;
    }

    location ~* \.(?:js|css|svg|png|jpe?g|webp|avif|ico|woff2?|map|json)$ {
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

A Caddy equivalent can separate static files from the final navigation fallback. This is also an unapplied configuration example, using a local illustrative port.

```caddyfile
:8080 {
    root * /srv/bdsolarenergy/dist
    encode zstd gzip

    @hashed path /assets/*
    handle @hashed {
        header Cache-Control "public, max-age=31536000, immutable"
        file_server
    }

    @images path /images/*
    handle @images {
        header Cache-Control "public, max-age=3600"
        file_server
    }

    @api path /api/*
    handle @api {
        respond "Not found" 404
    }

    @static path_regexp static \.(js|css|svg|png|jpe?g|webp|avif|ico|woff2?|map|json)$
    handle @static {
        file_server
    }

    handle {
        try_files {path} /index.html
        header Cache-Control "no-cache"
        file_server
    }
}
```

For a managed static host, configure the same behavior in its routing rules: existing files first, missing assets as 404, then application paths to the entry document. A blanket wildcard rewrite without asset exclusions is not equivalent to these examples.

## Caching and update behavior

Vite hashes the JavaScript/CSS files under `assets`; long immutable caching is appropriate for those versioned names. The entry HTML should revalidate so it references the current build. The image illustrations under `images` have stable names, so use shorter caching or rename/version them when their content changes. Do not apply immutable caching to a stable filename that may be overwritten.

Publish a complete build consistently. A page already open during an update can still request an older lazy-route chunk; retaining prior hashed assets during an update avoids breaking that session. Route failures must retain their visible retry/home recovery rather than being treated as a successful empty response.

Demo persistence is origin-scoped and remains in the browser after a static file update. It is not uploaded to the host. Switching protocol, hostname or port creates a different browser-storage origin. Known data versions migrate where supported; incompatible newer versions remain intact until the user explicitly confirms reset from settings or the public footer. Never clear unrelated browser keys as part of hosting setup.

## Environment and bundle contents

[`.env.example`](../../.env.example) documents the optional build-time values. Omitted `VITE_DATA_SOURCE` selects `json`; only that adapter mode is implemented. `VITE_API_BASE_URL` is reserved and unused, so setting a URL does not create a backend integration. Unsupported data-source values fail explicitly instead of falling back silently.

All `VITE_*` values must be treated as public. They belong in the browser build and must never contain authentication secrets, private keys, database credentials or server-only tokens. Changing a host-side environment file after the bundle is built does not alter deployed JavaScript; rebuild with reviewed public configuration.

The catalogue, sample users, public demo passphrase, shipping/coupon choices and draft content are intentionally public fixture data. Never replace those fixtures with real private customer records. Registered demo verifier/session/profile/address/order data is generated in browser storage, and no live credentials should be entered into the demonstration. Static source maps or build artifacts must not be used as a place to hide private configuration.

## Release scope

Public product facts, contacts, policies, tax, payment/shipping providers, host/domain and server security still require the appropriate production decisions. Local browser identity and reservation checks are not server authorization or distributed inventory controls. Firefox/WebKit execution remains blocked by the documented official-download HTTP 403 responses; see [browser journey evidence](../testing/browser-journeys.md) for exact rerun commands and the pre-release gate.

Production readiness evidence must distinguish the built local preview from a deployed service and retain the [accessibility limits](../testing/accessibility.md#limits). This handoff does not authorize publishing a live merchant site.
