import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
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

test("advertises one read-only render tool with an initial stale value", async (t) => {
  const { client, server } = await connectTestClient();
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const { tools } = await client.listTools();
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "show_update_model_context_repro");
  assert.equal(tools[0].annotations.readOnlyHint, true);
  assert.equal(tools[0]._meta.ui.resourceUri, TEMPLATE_URI);
  assert.equal(tools[0]._meta["openai/outputTemplate"], undefined);

  const result = await client.callTool({ name: tools[0].name, arguments: {} });
  assert.deepEqual(result.structuredContent, {
    reproduction: "update-model-context",
    initial_test_value: "INITIAL-SERVER-VALUE",
  });
  assert.match(result.content[0].text, /INITIAL-SERVER-VALUE/);
  assert.equal(result.isError, undefined);
});

test("serves a self-contained widget using the standard MCP Apps bridge", async (t) => {
  const { client, server } = await connectTestClient();
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const widgetSource = await readFile(new URL("../src/widget-app.js", import.meta.url), "utf8");
  assert.match(widgetSource, /App, PostMessageTransport/);
  assert.match(widgetSource, /app\.updateModelContext\(request\)/);
  assert.doesNotMatch(widgetSource, /window\.openai|\.postMessage\(/);

  const { resources } = await client.listResources();
  assert.equal(resources.length, 1);
  assert.equal(resources[0].uri, TEMPLATE_URI);

  const { contents } = await client.readResource({ uri: TEMPLATE_URI });
  assert.equal(contents.length, 1);
  assert.equal(contents[0].mimeType, "text/html;profile=mcp-app");
  assert.equal(contents[0].text, WIDGET_HTML);
  assert.match(contents[0].text, /ui\/update-model-context/);
  assert.match(contents[0].text, /MCP_CONTEXT_PROBE/);
  assert.match(contents[0].text, /INITIAL-SERVER-VALUE/);
  assert.match(contents[0].text, /What is the current test value\?/);
  assert.doesNotMatch(contents[0].text, /<(?:script|link|img)[^>]+(?:src|href)=/i);
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
    name: "chatgpt-update-model-context-repro",
    status: "ok",
    mcpEndpoint: "/mcp",
    version: "0.2.0",
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
  assert.match(await initializeResponse.text(), /chatgpt-update-model-context-repro/);
});
