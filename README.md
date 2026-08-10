# ChatGPT `updateModelContext` reproduction

This repository is a minimal, non-sensitive reproduction of ChatGPT acknowledging an MCP Apps
`ui/update-model-context` request without reliably making that context available to the model on the next user turn.

The server exposes one read-only tool and one self-contained HTML resource. There is no authentication, persistence,
application API, external asset, CDN, or proprietary `window.openai` communication path.

## What the test isolates

The render tool initially tells the model:

```text
INITIAL-SERVER-VALUE
```

The widget then connects with the official `App` and `PostMessageTransport` classes from
`@modelcontextprotocol/ext-apps`. A button publishes a generated replacement such as:

```text
UPDATED-12AB34CD
```

The request contains both a text content block and equivalent `structuredContent`. The widget displays the request,
the host's advertised capability, and the successful acknowledgement returned by ChatGPT.

## Requirements

- Node.js 20 or newer
- pnpm 10 or newer

## Run locally

```bash
pnpm install
pnpm start
```

The Streamable HTTP MCP endpoint is `http://127.0.0.1:3000/mcp`. The health endpoint is
`http://127.0.0.1:3000/`.

The small build step bundles the official browser SDK into the widget so the reproduction does not depend on an
external script host or an extra CSP domain.

## Deploy on Vercel

Vercel recognizes the default Express export in `src/server.js`. No environment variables or `vercel.json` are
required. The GitHub repository is connected to Vercel, so pushing `main` deploys the reproduction.

Use the deployed MCP URL in ChatGPT, including `/mcp`:

```text
https://YOUR-PROJECT.vercel.app/mcp
```

## Reproduce in ChatGPT web

1. Add the deployed `/mcp` endpoint as a plugin in ChatGPT developer mode.
2. Start a new conversation with the plugin enabled.
3. Ask: `Open the updateModelContext reproduction.`
4. Do not refresh the ChatGPT page after the widget is rendered.
5. Optionally click **Enter fullscreen** to match a fullscreen MCP workspace.
6. Click **Publish through updateModelContext**.
7. Confirm that the widget reports `ACK received` and note the generated `UPDATED-...` value.
8. In ChatGPT's normal composer, type:

   ```text
   What is the current test value? Reply with only the value.
   ```

Expected: ChatGPT returns the exact `UPDATED-...` value.

Failure: ChatGPT returns `INITIAL-SERVER-VALUE`, says it cannot see the value, or gives another stale/missing answer
despite the successful acknowledgement.

For lifecycle comparison, repeat once after a full ChatGPT page refresh. Public developer reports indicate that
rehydrated widgets can behave differently from widgets rendered live in the current turn.

## Automated verification

```bash
pnpm check
```

The tests verify that the server exposes exactly one tool, returns the deliberate initial value, serves a
self-contained widget, and that the widget source uses the official MCP Apps bridge without `window.openai` or raw
`postMessage` calls.

## Related report

- [ui/update-model-context ACKs but follow-up turns use stale or missing app context](https://community.openai.com/t/ui-update-model-context-acks-but-follow-up-turns-use-stale-or-missing-app-context/1383304)

## Security and privacy

The generated values are random test markers and contain no user data. Before sharing recordings, console output, or
HAR files, remove cookies, authorization headers, private URLs, and account identifiers.
