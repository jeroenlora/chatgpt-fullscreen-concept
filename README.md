# ChatGPT fullscreen composer reproduction

This repository is a minimal, non-sensitive reproduction of a ChatGPT web layout bug affecting Apps SDK/MCP
Apps widgets in fullscreen mode.

When ChatGPT's native composer grows from one line to multiple lines, the fullscreen host thread can become taller
than the browser viewport. The composer is then partially or completely pushed below the visible window. Selecting
composer text can also expose host-level scrollbars.

## Why this reproduction is intentionally small

The widget contains:

- one read-only MCP tool;
- one self-contained HTML resource;
- one button that requests ChatGPT fullscreen mode; and
- a blue frame showing the exact iframe viewport owned by the MCP application; and
- a few read-only diagnostics for the iframe and documented host values.

It has no React runtime, authentication, persistence, API calls, external assets, application data, scroll
container, or viewport-height CSS. This isolates the behavior from application-specific layout code.

## Requirements

- Node.js 20 or newer
- pnpm 10 or newer

## Run locally

```bash
pnpm install
pnpm start
```

The Streamable HTTP MCP endpoint is available at `http://127.0.0.1:3000/mcp`. A small health response is available
at `http://127.0.0.1:3000/`.

To make the endpoint reachable by ChatGPT during development, expose port 3000 through an HTTPS tunnel such as
ngrok:

```bash
ngrok http 3000
```

Use the resulting endpoint in ChatGPT, including the `/mcp` path:

```text
https://YOUR-TUNNEL.example/mcp
```

For a conventional hosted process, bind to all interfaces:

```bash
HOST=0.0.0.0 PORT=3000 pnpm start
```

PowerShell equivalent:

```powershell
$env:HOST = "0.0.0.0"
$env:PORT = "3000"
pnpm start
```

## Deploy on Vercel

Vercel recognizes the default Express export in `src/server.js` and deploys the complete app as one Function. No
custom build command, output directory, environment variable, or `vercel.json` is required.

1. Push this repository to GitHub.
2. In Vercel, create a project and import the GitHub repository.
3. Leave the detected project settings at their defaults and deploy.
4. Verify `https://YOUR-PROJECT.vercel.app/` and use `https://YOUR-PROJECT.vercel.app/mcp` as the ChatGPT MCP URL.

## Reproduce in ChatGPT

1. Enable developer mode in ChatGPT and add the HTTPS MCP endpoint as a connector/app.
2. Start a new conversation with the app enabled.
3. Ask: `Open the fullscreen composer reproduction.`
4. When the widget appears, click **Enter fullscreen**.
5. If necessary, reduce the browser window height.
6. Type into ChatGPT's native composer until the text wraps onto a second line. Do not submit the message.
7. Observe that the composer can extend below the viewport.
8. Optionally select some composer text and check whether host-level scrollbars appear.

## Expected behavior

ChatGPT's native composer remains fixed, fully visible, and grows upward without changing the fullscreen document
height.

## Actual behavior

The outer ChatGPT thread becomes taller than the browser viewport. The composer can move partly or completely below
the visible viewport. This happens while the widget iframe remains within its assigned dimensions and has no
internal overflow.

## Useful host DOM evidence

In a confirmed reproduction on ChatGPT web:

- the native composer wrapper was `#thread-bottom-container`;
- its class list contained both `fixed` and `relative`;
- its computed `position` was `relative`;
- growing the composer increased the outer ChatGPT thread height beyond the viewport; and
- the widget iframe continued to match its assigned viewport exactly.

The selector and class names are implementation details and may change, but the geometry is the important evidence.

## Automated verification

```bash
pnpm check
```

The tests verify that the server exposes exactly one read-only render tool, serves the expected MCP Apps resource,
and that the widget contains no network calls, scroll container, height declaration, or viewport-height unit.

## Related public report

- [ChatGPT app fullscreen mode composer issue](https://community.openai.com/t/chatgpt-app-fullscreen-mode-composer-issue/1380657)

## Security and privacy

This reproduction requires no credentials and handles no user or business data. Before sending browser recordings,
console output, or HAR files to support, inspect them and remove cookies, authorization headers, private URLs, and
personal information.
