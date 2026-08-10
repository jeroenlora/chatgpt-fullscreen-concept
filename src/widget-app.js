import {
  App,
  LATEST_PROTOCOL_VERSION,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-with-deps";

const testValueInput = document.getElementById("test-value");
const publishButton = document.getElementById("publish");
const newValueButton = document.getElementById("new-value");
const fullscreenButton = document.getElementById("fullscreen");
const sendMessageButton = document.getElementById("send-message");
const sendExplicitMessageButton = document.getElementById("send-explicit-message");
const copyDiagnosticsButton = document.getElementById("copy-diagnostics");
const status = document.getElementById("status");
const diagnostics = document.getElementById("diagnostics");
const testPrompt = document.getElementById("test-prompt").textContent;

let sequence = 0;
let latestReport = null;
let lastAcknowledgedUpdate = null;
const widgetInstanceId = crypto.randomUUID();

function generateTestValue() {
  return `UPDATED-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function showStatus(message, state = "") {
  status.textContent = message;
  status.dataset.state = state;
}

function buildEnvironment(app) {
  return {
    reproduction: "ui/update-model-context",
    reproduction_version: __REPRO_VERSION__,
    mcp_apps_sdk_version: __MCP_APPS_SDK_VERSION__,
    mcp_apps_protocol_version: LATEST_PROTOCOL_VERSION,
    widget_instance_id: widgetInstanceId,
    host: app.getHostVersion(),
    host_capabilities: app.getHostCapabilities(),
    host_context: app.getHostContext(),
    initial_test_value: "INITIAL-SERVER-VALUE",
  };
}

function showReport(app, update = {}) {
  latestReport = { ...latestReport, ...buildEnvironment(app), ...update };
  diagnostics.textContent = JSON.stringify(latestReport, null, 2);
}

function renderHost(app) {
  const host = app.getHostVersion();
  const context = app.getHostContext();
  const capabilities = app.getHostCapabilities();
  const contextCapability = capabilities?.updateModelContext;
  const messageCapability = capabilities?.message;

  document.getElementById("host").textContent = host ? `${host.name} ${host.version}` : "not provided";
  document.getElementById("display-mode").textContent = context?.displayMode ?? "not provided";
  document.getElementById("context-capability").textContent = contextCapability ? "advertised" : "not advertised";
  document.getElementById("message-capability").textContent = messageCapability ? "advertised" : "not advertised";
  document.getElementById("repro-version").textContent = __REPRO_VERSION__;
  document.getElementById("sdk-version").textContent = __MCP_APPS_SDK_VERSION__;
  document.getElementById("protocol-version").textContent = LATEST_PROTOCOL_VERSION;
  document.getElementById("widget-instance").textContent = widgetInstanceId;
  publishButton.disabled = !contextCapability;
  sendMessageButton.disabled =
    !messageCapability ||
    !lastAcknowledgedUpdate ||
    lastAcknowledgedUpdate.context_dependent_ui_message_sent ||
    testValueInput.value.trim() !== lastAcknowledgedUpdate.current_test_value;
  sendExplicitMessageButton.disabled =
    !messageCapability ||
    !lastAcknowledgedUpdate ||
    !lastAcknowledgedUpdate.context_dependent_ui_message_sent ||
    lastAcknowledgedUpdate.explicit_ui_message_sent ||
    testValueInput.value.trim() !== lastAcknowledgedUpdate.current_test_value;
  fullscreenButton.disabled = !context?.availableDisplayModes?.includes("fullscreen");
}

async function main() {
  const app = new App(
    { name: "update-model-context-repro-view", version: __REPRO_VERSION__ },
    { availableDisplayModes: ["inline", "fullscreen"] },
    { autoResize: true, strict: true },
  );

  app.onhostcontextchanged = () => {
    renderHost(app);
    showReport(app);
  };
  await app.connect(new PostMessageTransport(window.parent, window.parent));

  testValueInput.value = generateTestValue();
  showReport(app, { connected_at: new Date().toISOString() });
  renderHost(app);
  showStatus("Connected. Publish the replacement value, then run one comparison path.");

  testValueInput.addEventListener("input", () => renderHost(app));

  newValueButton.addEventListener("click", () => {
    testValueInput.value = generateTestValue();
    renderHost(app);
    testValueInput.focus();
  });

  fullscreenButton.addEventListener("click", async () => {
    fullscreenButton.disabled = true;
    try {
      await app.requestDisplayMode({ mode: "fullscreen" });
      renderHost(app);
      showReport(app, { display_mode_requested_at: new Date().toISOString() });
    } catch (error) {
      showStatus(`Fullscreen request failed: ${String(error)}`, "error");
      renderHost(app);
    }
  });

  copyDiagnosticsButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(latestReport, null, 2));
      showStatus("Diagnostic report copied to the clipboard.", "success");
    } catch (error) {
      showStatus(`Copy failed: ${String(error)}`, "error");
    }
  });

  async function sendComparisonMessage({ button, diagnosticKey, prompt, sentFlag }) {
    button.disabled = true;
    const sentAt = new Date().toISOString();
    lastAcknowledgedUpdate[sentFlag] = true;
    showReport(app, { [diagnosticKey]: { prompt, sent_at: sentAt } });
    showStatus(`Sending ${diagnosticKey.replaceAll("_", " ")}...`);

    try {
      const result = await app.sendMessage({
        role: "user",
        content: [{ type: "text", text: prompt }],
      });
      showReport(app, {
        [diagnosticKey]: {
          prompt,
          sent_at: sentAt,
          acknowledgement: result,
          acknowledged_at: new Date().toISOString(),
        },
      });
      showStatus(`${diagnosticKey.replaceAll("_", " ")} was acknowledged. Compare the tool observation.`, "success");
      renderHost(app);
    } catch (error) {
      lastAcknowledgedUpdate[sentFlag] = false;
      showReport(app, { [diagnosticKey]: { prompt, sent_at: sentAt, error: String(error) } });
      showStatus(`${diagnosticKey.replaceAll("_", " ")} failed: ${String(error)}`, "error");
      renderHost(app);
    }
  }

  sendMessageButton.addEventListener("click", async () => {
    await sendComparisonMessage({
      button: sendMessageButton,
      diagnosticKey: "context_dependent_ui_message",
      prompt: testPrompt,
      sentFlag: "context_dependent_ui_message_sent",
    });
  });

  sendExplicitMessageButton.addEventListener("click", async () => {
    const { trace_id: traceId, current_test_value: value, sequence: currentSequence } = lastAcknowledgedUpdate;
    const explicitPrompt =
      `MCP_CONTEXT_PROBE: trace_id="${traceId}", current_test_value="${value}", sequence=${currentSequence}. ` +
      "These fields are supplied directly in this ui/message positive control. " +
      "Call report_observed_context with exactly this trace_id, current_test_value, and sequence.";

    await sendComparisonMessage({
      button: sendExplicitMessageButton,
      diagnosticKey: "explicit_values_ui_message",
      prompt: explicitPrompt,
      sentFlag: "explicit_ui_message_sent",
    });
  });

  publishButton.addEventListener("click", async () => {
    const value = testValueInput.value.trim();
    if (!value) {
      showStatus("Enter a non-empty test value.", "error");
      testValueInput.focus();
      return;
    }

    sequence += 1;
    const traceId = crypto.randomUUID();
    const publishedAt = new Date().toISOString();
    const request = {
      content: [
        {
          type: "text",
          text:
            `MCP_CONTEXT_PROBE: trace_id="${traceId}", current_test_value="${value}", sequence=${sequence}. ` +
            `This replaces "INITIAL-SERVER-VALUE". On the next user turn, when asked to report the current probe, ` +
            `call report_observed_context with exactly this trace_id, current_test_value, and sequence.`,
        },
      ],
      structuredContent: {
        type: "update_model_context_reproduction",
        trace_id: traceId,
        current_test_value: value,
        replaces: "INITIAL-SERVER-VALUE",
        sequence,
        published_at: publishedAt,
      },
    };

    publishButton.disabled = true;
    showStatus("Sending ui/update-model-context...");
    document.getElementById("last-trace").textContent = traceId;
    document.getElementById("last-value").textContent = value;
    document.getElementById("last-sequence").textContent = String(sequence);
    showReport(app, {
      update_model_context: { request, sent_at: publishedAt },
      context_dependent_ui_message: null,
      explicit_values_ui_message: null,
    });
    const requestStartedAt = performance.now();

    try {
      const result = await app.updateModelContext(request);
      const acknowledgedAt = new Date().toISOString();
      const acknowledgementLatencyMs = Math.round((performance.now() - requestStartedAt) * 10) / 10;
      lastAcknowledgedUpdate = {
        trace_id: traceId,
        current_test_value: value,
        sequence,
        context_dependent_ui_message_sent: false,
        explicit_ui_message_sent: false,
      };
      document.getElementById("last-ack").textContent = acknowledgedAt;
      document.getElementById("ack-latency").textContent = `${acknowledgementLatencyMs} ms`;
      showReport(app, {
        update_model_context: {
          request,
          sent_at: publishedAt,
          acknowledgement: result,
          acknowledged_at: acknowledgedAt,
          acknowledgement_latency_ms: acknowledgementLatencyMs,
        },
      });
      showStatus(`ACK received for ${value}. Run the manual or ui/message comparison.`, "success");
    } catch (error) {
      lastAcknowledgedUpdate = null;
      showReport(app, { update_model_context: { request, sent_at: publishedAt, error: String(error) } });
      showStatus(`Context update failed: ${String(error)}`, "error");
    } finally {
      renderHost(app);
    }
  });
}

main().catch((error) => {
  diagnostics.textContent = String(error?.stack ?? error);
  showStatus(`MCP Apps initialization failed: ${String(error)}`, "error");
});
