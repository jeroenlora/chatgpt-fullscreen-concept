import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { TEMPLATE_URI, WIDGET_HTML } from "./widget.js";

export function createMcpServer() {
  const server = new McpServer({
    name: "chatgpt-update-model-context-repro",
    version: "0.2.0",
  });

  registerAppResource(
    server,
    "ChatGPT updateModelContext reproduction",
    TEMPLATE_URI,
    {
      description: "A self-contained MCP Apps widget that reproduces stale or missing updateModelContext delivery.",
    },
    async () => ({
      contents: [
        {
          uri: TEMPLATE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: WIDGET_HTML,
          _meta: {
            ui: { prefersBorder: true },
          },
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "show_update_model_context_repro",
    {
      title: "Show updateModelContext reproduction",
      description:
        "Render the minimal MCP Apps widget used to test whether ui/update-model-context reaches the model. " +
        "Call this tool whenever the user asks to open, show, or run the updateModelContext reproduction.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: TEMPLATE_URI },
      },
    },
    async () => ({
      structuredContent: {
        reproduction: "update-model-context",
        initial_test_value: "INITIAL-SERVER-VALUE",
      },
      content: [
        {
          type: "text",
          text:
            "The updateModelContext reproduction is ready. The initial test value is " +
            '"INITIAL-SERVER-VALUE". The widget lets the user publish a replacement value.',
        },
      ],
    }),
  );

  return server;
}

function methodNotAllowed(res) {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
}

export function createHttpApp(host = process.env.HOST || "127.0.0.1") {
  const app = createMcpExpressApp({ host });

  app.get("/", (_req, res) => {
    res.json({
      name: "chatgpt-update-model-context-repro",
      status: "ok",
      mcpEndpoint: "/mcp",
      version: "0.2.0",
    });
  });

  app.post("/mcp", async (req, res) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP request failed", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error." },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", (_req, res) => methodNotAllowed(res));
  app.delete("/mcp", (_req, res) => methodNotAllowed(res));

  app.use((error, _req, res, next) => {
    console.error("Unhandled HTTP error", error);
    if (res.headersSent) {
      next(error);
      return;
    }

    res.status(500).json({ error: "Internal server error." });
  });

  return app;
}

export function startServer() {
  const host = process.env.HOST || "127.0.0.1";
  const port = Number.parseInt(process.env.PORT || "3000", 10);
  const app = createHttpApp(host);

  return app.listen(port, host, (error) => {
    if (error) {
      console.error("Failed to start server", error);
      process.exitCode = 1;
      return;
    }

    console.log(`updateModelContext reproduction listening at http://${host}:${port}/mcp`);
  });
}

// Vercel recognizes src/server.js and deploys this default Express export as one Function.
export default createHttpApp("0.0.0.0");
