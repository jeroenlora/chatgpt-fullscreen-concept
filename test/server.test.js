import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import vercelApp, { createHttpApp, createMcpServer } from "../src/server.js";
import { TEMPLATE_URI, WIDGET_HTML } from "../src/widget.js";

async function connectTestClient() {
  const server = createMcpServer();
  const client = new Client({ name: "repro-contract-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, server };
}

test("default-exports the Express app for Vercel", () => {
  assert.equal(typeof vercelApp, "function");
});

test("advertises one read-only render tool with the widget resource", async (t) => {
  const { client, server } = await connectTestClient();
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const { tools } = await client.listTools();
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "show_fullscreen_composer_repro");
  assert.equal(tools[0].annotations.readOnlyHint, true);
  assert.equal(tools[0]._meta.ui.resourceUri, TEMPLATE_URI);
  assert.equal(tools[0]._meta["openai/outputTemplate"], TEMPLATE_URI);

  const result = await client.callTool({ name: tools[0].name, arguments: {} });
  assert.deepEqual(result.structuredContent, { reproduction: "fullscreen-composer" });
  assert.equal(result.isError, undefined);
});

test("serves a self-contained MCP Apps HTML resource", async (t) => {
  const { client, server } = await connectTestClient();
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const { resources } = await client.listResources();
  assert.equal(resources.length, 1);
  assert.equal(resources[0].uri, TEMPLATE_URI);

  const { contents } = await client.readResource({ uri: TEMPLATE_URI });
  assert.equal(contents.length, 1);
  assert.equal(contents[0].mimeType, "text/html;profile=mcp-app");
  assert.equal(contents[0].text, WIDGET_HTML);
  assert.match(contents[0].text, /requestDisplayMode\(\{ mode: "fullscreen" \}\)/);
  assert.doesNotMatch(contents[0].text, /fetch\(|XMLHttpRequest|WebSocket/);
  assert.doesNotMatch(contents[0].text, /^\s*(?:min-|max-)?height\s*:/im);
  assert.doesNotMatch(contents[0].text, /\b(?:d?vh|svh|lvh)\b/i);
});

test("accepts MCP initialization over Streamable HTTP", async (t) => {
  const httpServer = createHttpApp().listen(0, "127.0.0.1");
  await once(httpServer, "listening");

  t.after(async () => {
    httpServer.closeAllConnections();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  const address = httpServer.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const healthResponse = await fetch(`${baseUrl}/`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), {
    name: "chatgpt-fullscreen-composer-repro",
    status: "ok",
    mcpEndpoint: "/mcp",
  });

  const initializeResponse = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "http-contract-test", version: "1.0.0" },
      },
    }),
  });

  assert.equal(initializeResponse.status, 200);
  assert.match(await initializeResponse.text(), /chatgpt-fullscreen-composer-repro/);
});
