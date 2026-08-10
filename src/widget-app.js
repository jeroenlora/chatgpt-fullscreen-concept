import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-with-deps";

const testValueInput = document.getElementById("test-value");
const publishButton = document.getElementById("publish");
const newValueButton = document.getElementById("new-value");
const fullscreenButton = document.getElementById("fullscreen");
const status = document.getElementById("status");
const diagnostics = document.getElementById("diagnostics");

let sequence = 0;
let hostSnapshot = null;

function generateTestValue() {
  return `UPDATED-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function showStatus(message, state = "") {
  status.textContent = message;
  status.dataset.state = state;
}

function renderHost(app) {
  const host = app.getHostVersion();
  const context = app.getHostContext();
  const capability = app.getHostCapabilities()?.updateModelContext;

  document.getElementById("host").textContent = host ? `${host.name} ${host.version}` : "not provided";
  document.getElementById("display-mode").textContent = context?.displayMode ?? "not provided";
  document.getElementById("capability").textContent = capability ? "advertised" : "not advertised";
  publishButton.disabled = !capability;
  fullscreenButton.disabled = !context?.availableDisplayModes?.includes("fullscreen");
}

async function main() {
  const app = new App(
    { name: "update-model-context-repro-view", version: "0.2.0" },
    { availableDisplayModes: ["inline", "fullscreen"] },
    { autoResize: true, strict: true },
  );

  app.onhostcontextchanged = () => renderHost(app);
  await app.connect(new PostMessageTransport(window.parent, window.parent));

  testValueInput.value = generateTestValue();
  hostSnapshot = {
    host: app.getHostVersion(),
    capabilities: app.getHostCapabilities(),
  };
  diagnostics.textContent = JSON.stringify(hostSnapshot, null, 2);
  renderHost(app);
  showStatus("Connected. Publish the replacement value, then ask ChatGPT the test question.");

  newValueButton.addEventListener("click", () => {
    testValueInput.value = generateTestValue();
    testValueInput.focus();
  });

  fullscreenButton.addEventListener("click", async () => {
    fullscreenButton.disabled = true;
    try {
      await app.requestDisplayMode({ mode: "fullscreen" });
      renderHost(app);
    } catch (error) {
      showStatus(`Fullscreen request failed: ${String(error)}`, "error");
      renderHost(app);
    }
  });

  publishButton.addEventListener("click", async () => {
    const value = testValueInput.value.trim();
    if (!value) {
      showStatus("Enter a non-empty test value.", "error");
      testValueInput.focus();
      return;
    }

    sequence += 1;
    const publishedAt = new Date().toISOString();
    const request = {
      content: [
        {
          type: "text",
          text:
            `MCP_CONTEXT_PROBE: The current test value is "${value}". ` +
            `It replaces "INITIAL-SERVER-VALUE". If the user asks for the current test value ` +
            `on their next turn, reply with exactly "${value}".`,
        },
      ],
      structuredContent: {
        type: "update_model_context_reproduction",
        current_test_value: value,
        replaces: "INITIAL-SERVER-VALUE",
        sequence,
        published_at: publishedAt,
      },
    };

    publishButton.disabled = true;
    showStatus("Sending ui/update-model-context...");
    document.getElementById("last-value").textContent = value;
    diagnostics.textContent = JSON.stringify({ ...hostSnapshot, request }, null, 2);

    try {
      const result = await app.updateModelContext(request);
      const acknowledgedAt = new Date().toISOString();
      document.getElementById("last-ack").textContent = acknowledgedAt;
      diagnostics.textContent = JSON.stringify(
        { ...hostSnapshot, request, acknowledgement: result, acknowledged_at: acknowledgedAt },
        null,
        2,
      );
      showStatus(`ACK received for ${value}. Now ask ChatGPT the test question.`, "success");
    } catch (error) {
      diagnostics.textContent = JSON.stringify({ ...hostSnapshot, request, error: String(error) }, null, 2);
      showStatus(`Context update failed: ${String(error)}`, "error");
    } finally {
      publishButton.disabled = false;
    }
  });
}

main().catch((error) => {
  diagnostics.textContent = String(error?.stack ?? error);
  showStatus(`MCP Apps initialization failed: ${String(error)}`, "error");
});
