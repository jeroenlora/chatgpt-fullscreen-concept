import { WIDGET_SCRIPT } from "./widget-bundle.generated.js";

export const TEMPLATE_URI = "ui://update-model-context-repro/probe-v3.html";

export const WIDGET_HTML = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>updateModelContext reproduction</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      body { margin: 0; background: Canvas; color: CanvasText; }
      main { width: min(48rem, 100%); padding: 20px; }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0 0 14px; line-height: 1.45; }
      label { display: block; margin-bottom: 6px; font-weight: 650; }
      input { width: 100%; padding: 9px 10px; border: 1px solid ButtonBorder; border-radius: 7px; font: inherit; }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
      button { padding: 9px 12px; border: 1px solid ButtonBorder; border-radius: 7px; background: ButtonFace; color: ButtonText; font: inherit; font-weight: 650; cursor: pointer; }
      button:disabled { cursor: default; opacity: 0.6; }
      #status { margin-top: 14px; padding: 10px; border-left: 4px solid #777; background: color-mix(in srgb, CanvasText 6%, Canvas); }
      #status[data-state="success"] { border-color: #16803c; }
      #status[data-state="error"] { border-color: #c62828; }
      .test-step { margin-top: 16px; padding-top: 14px; border-top: 1px solid ButtonBorder; }
      .test-step h2 { margin: 0 0 7px; font-size: 16px; }
      .prompt { display: block; padding: 9px 10px; overflow-wrap: anywhere; background: color-mix(in srgb, CanvasText 6%, Canvas); }
      dl { display: grid; grid-template-columns: max-content 1fr; gap: 5px 10px; margin: 16px 0; font-size: 13px; }
      dt { font-weight: 700; }
      dd { margin: 0; overflow-wrap: anywhere; }
      details { margin-top: 14px; }
      pre { overflow: auto; padding: 10px; background: color-mix(in srgb, CanvasText 6%, Canvas); font: 12px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; }
      code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    </style>
  </head>
  <body>
    <main>
      <h1><code>ui/update-model-context</code> reproduction</h1>
      <p>
        The tool result told ChatGPT that the initial value is <code>INITIAL-SERVER-VALUE</code>.
        Publish the replacement below, then compare the manual and app-message observation paths.
      </p>

      <label for="test-value">Replacement test value</label>
      <input id="test-value" autocomplete="off" spellcheck="false">
      <div class="actions">
        <button id="publish" type="button" disabled>Publish through updateModelContext</button>
        <button id="new-value" type="button">Generate another value</button>
        <button id="fullscreen" type="button" disabled>Enter fullscreen</button>
        <button id="copy-diagnostics" type="button">Copy diagnostic report</button>
      </div>

      <div id="status" role="status" aria-live="polite">Connecting to the MCP Apps host...</div>

      <dl>
        <dt>Host</dt><dd id="host">unknown</dd>
        <dt>Display mode</dt><dd id="display-mode">unknown</dd>
        <dt>Context capability</dt><dd id="context-capability">unknown</dd>
        <dt>Message capability</dt><dd id="message-capability">unknown</dd>
        <dt>Reproducer</dt><dd id="repro-version">unknown</dd>
        <dt>MCP Apps SDK</dt><dd id="sdk-version">unknown</dd>
        <dt>MCP Apps protocol</dt><dd id="protocol-version">unknown</dd>
        <dt>Widget instance</dt><dd id="widget-instance">unknown</dd>
        <dt>Last trace</dt><dd id="last-trace">none</dd>
        <dt>Last value</dt><dd id="last-value">none</dd>
        <dt>Last sequence</dt><dd id="last-sequence">none</dd>
        <dt>Last ACK</dt><dd id="last-ack">none</dd>
        <dt>ACK latency</dt><dd id="ack-latency">none</dd>
      </dl>

      <section class="test-step">
        <h2>Manual composer test</h2>
        <p>After an ACK, type this exact prompt into ChatGPT's normal composer:</p>
        <code id="test-prompt" class="prompt">Report the current model-context probe by calling report_observed_context with the exact trace_id, current_test_value, and sequence supplied by the widget.</code>
      </section>

      <section class="test-step">
        <h2>App-message comparisons</h2>
        <p>
          First send only the test instruction. It depends on the preceding context update. Then send the positive
          control, which includes the exact probe fields directly in <code>ui/message</code>.
        </p>
        <div class="actions">
          <button id="send-message" type="button" disabled>1. Send context-dependent ui/message</button>
          <button id="send-explicit-message" type="button" disabled>2. Send explicit-values positive control</button>
        </div>
      </section>

      <details>
        <summary>Diagnostic report</summary>
        <pre id="diagnostics">No update sent.</pre>
      </details>
    </main>
    <script>${WIDGET_SCRIPT}</script>
  </body>
</html>`;
