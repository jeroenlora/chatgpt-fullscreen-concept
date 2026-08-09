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
    name: "chatgpt-fullscreen-composer-repro",
    version: "0.1.0",
  });

  registerAppResource(
    server,
    "ChatGPT fullscreen composer reproduction",
    TEMPLATE_URI,
    {
      description: "A static, dependency-free widget used to reproduce a ChatGPT fullscreen composer layout bug.",
    },
    async () => ({
      contents: [
        {
          uri: TEMPLATE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: WIDGET_HTML,
          _meta: {
            ui: { prefersBorder: false },
            "openai/widgetDescription":
              "Minimal reproduction surface for a ChatGPT fullscreen composer viewport bug.",
            "openai/widgetPrefersBorder": false,
          },
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "show_fullscreen_composer_repro",
    {
      title: "Show fullscreen composer reproduction",
      description:
        "Render the minimal widget used to reproduce the ChatGPT fullscreen composer viewport bug. " +
        "Call this tool whenever the user asks to open, show, or test the fullscreen composer reproduction.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: TEMPLATE_URI },
        "openai/outputTemplate": TEMPLATE_URI,
        "openai/toolInvocation/invoking": "Opening the reproduction…",
        "openai/toolInvocation/invoked": "Reproduction ready.",
      },
    },
    async () => ({
      structuredContent: { reproduction: "fullscreen-composer" },
      content: [
        {
          type: "text",
          text: "The minimal fullscreen composer reproduction is ready. Use its button to enter fullscreen.",
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
      name: "chatgpt-fullscreen-composer-repro",
      status: "ok",
      mcpEndpoint: "/mcp",
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

    console.log(`Fullscreen composer reproduction listening at http://${host}:${port}/mcp`);
  });
}

// Vercel recognizes src/server.js and deploys this default Express export as one Function.
export default createHttpApp("0.0.0.0");
