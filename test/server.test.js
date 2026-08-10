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

test("advertises the render and model-observation tools", async (t) => {
  const { client, server } = await connectTestClient();
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const { tools } = await client.listTools();
  assert.equal(tools.length, 2);
  const renderTool = tools.find(({ name }) => name === "show_update_model_context_repro");
  const observationTool = tools.find(({ name }) => name === "report_observed_context");
  assert.equal(renderTool.annotations.readOnlyHint, true);
  assert.equal(renderTool._meta.ui.resourceUri, TEMPLATE_URI);
  assert.equal(renderTool._meta["openai/outputTemplate"], undefined);
  assert.equal(observationTool.annotations.readOnlyHint, true);
  assert.deepEqual(observationTool._meta.ui.visibility, ["model"]);
  assert.deepEqual(observationTool.inputSchema.required.sort(), ["current_test_value", "sequence", "trace_id"]);

  const result = await client.callTool({ name: renderTool.name, arguments: {} });
  assert.deepEqual(result.structuredContent, {
    reproduction: "update-model-context",
    initial_test_value: "INITIAL-SERVER-VALUE",
  });
  assert.match(result.content[0].text, /INITIAL-SERVER-VALUE/);
  assert.equal(result.isError, undefined);

  const observation = await client.callTool({
    name: observationTool.name,
    arguments: { trace_id: "trace-test", current_test_value: "UPDATED-TEST", sequence: 3 },
  });
  assert.equal(observation.structuredContent.type, "model_context_observation");
  assert.equal(observation.structuredContent.trace_id, "trace-test");
  assert.equal(observation.structuredContent.current_test_value, "UPDATED-TEST");
  assert.equal(observation.structuredContent.sequence, 3);
  assert.equal(observation.structuredContent.server_version, "0.4.0");
  assert.match(observation.structuredContent.server_received_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(observation.content[0].text, /MODEL_CONTEXT_OBSERVATION/);
});

test("serves a self-contained widget using the standard MCP Apps bridge", async (t) => {
  const { client, server } = await connectTestClient();
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const widgetSource = await readFile(new URL("../src/widget-app.js", import.meta.url), "utf8");
  assert.match(widgetSource, /\bApp\b/);
  assert.match(widgetSource, /\bPostMessageTransport\b/);
  assert.match(widgetSource, /app\.updateModelContext\(request\)/);
  assert.match(widgetSource, /app\.sendMessage\(/);
  assert.match(widgetSource, /explicit_values_ui_message/);
  assert.match(widgetSource, /fields are supplied directly in this ui\/message positive control/);
  assert.match(widgetSource, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(widgetSource, /window\.openai|\.postMessage\(/);

  const { resources } = await client.listResources();
  assert.equal(resources.length, 1);
  assert.equal(resources[0].uri, TEMPLATE_URI);

  const { contents } = await client.readResource({ uri: TEMPLATE_URI });
  assert.equal(contents.length, 1);
  assert.equal(contents[0].mimeType, "text/html;profile=mcp-app");
  assert.deepEqual(contents[0]._meta.ui.permissions.clipboardWrite, {});
  assert.equal(contents[0].text, WIDGET_HTML);
  assert.match(contents[0].text, /ui\/update-model-context/);
  assert.match(contents[0].text, /MCP_CONTEXT_PROBE/);
  assert.match(contents[0].text, /INITIAL-SERVER-VALUE/);
  assert.match(contents[0].text, /report_observed_context/);
  assert.match(contents[0].text, /Send context-dependent ui\/message/);
  assert.match(contents[0].text, /Send explicit-values positive control/);
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
    version: "0.4.0",
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
