export const TEMPLATE_URI = "ui://chatgpt-fullscreen-concept/composer-repro-v1.html";

// This widget is intentionally plain HTML with no framework, network requests, external
// assets, viewport-height CSS, or scroll container. The absence of those mechanisms is
// part of the reproduction: only ChatGPT owns the fullscreen container and composer.
export const WIDGET_HTML = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Fullscreen composer reproduction</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: Canvas;
        color: CanvasText;
      }

      main {
        width: min(42rem, 100%);
        padding: 24px;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 20px;
      }

      p {
        margin: 0 0 16px;
        line-height: 1.5;
      }

      button {
        border: 1px solid ButtonBorder;
        border-radius: 8px;
        padding: 10px 14px;
        background: ButtonFace;
        color: ButtonText;
        cursor: pointer;
        font: inherit;
        font-weight: 600;
      }

      button:disabled {
        cursor: default;
        opacity: 0.65;
      }

      dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 6px 12px;
        margin: 20px 0 0;
        font: 13px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
      }

      dt {
        font-weight: 700;
      }

      dd {
        margin: 0;
        overflow-wrap: anywhere;
      }

      #status {
        margin-top: 12px;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>ChatGPT fullscreen composer reproduction</h1>
      <p>
        This intentionally small widget has no scroll container and no viewport-height CSS.
        Enter fullscreen, then type in ChatGPT's native composer until it wraps onto a second line.
      </p>
      <button id="fullscreen" type="button">Enter fullscreen</button>
      <div id="status" role="status" aria-live="polite">Ready.</div>
      <dl>
        <dt>Display mode</dt><dd id="display-mode">unknown</dd>
        <dt>Host maxHeight</dt><dd id="max-height">not provided</dd>
        <dt>Safe area</dt><dd id="safe-area">not provided</dd>
        <dt>Iframe viewport</dt><dd id="viewport">unknown</dd>
        <dt>Document scroll size</dt><dd id="scroll-size">unknown</dd>
      </dl>
    </main>

    <script>
      const fullscreenButton = document.getElementById("fullscreen");
      const status = document.getElementById("status");

      function format(value, fallback) {
        return value === undefined || value === null ? fallback : JSON.stringify(value);
      }

      function renderDiagnostics() {
        const host = window.openai;
        document.getElementById("display-mode").textContent = format(host?.displayMode, "unknown");
        document.getElementById("max-height").textContent = format(host?.maxHeight, "not provided");
        document.getElementById("safe-area").textContent = format(host?.safeArea, "not provided");
        document.getElementById("viewport").textContent = window.innerWidth + " × " + window.innerHeight;
        document.getElementById("scroll-size").textContent =
          document.documentElement.scrollWidth + " × " + document.documentElement.scrollHeight;

        const fullscreenAvailable = typeof host?.requestDisplayMode === "function";
        fullscreenButton.disabled = !fullscreenAvailable || host?.displayMode === "fullscreen";
        if (!fullscreenAvailable) {
          status.textContent = "This host does not expose requestDisplayMode.";
        } else if (host?.displayMode === "fullscreen") {
          status.textContent = "Fullscreen active. Type in ChatGPT's composer until the text wraps.";
        }
      }

      fullscreenButton.addEventListener("click", async () => {
        status.textContent = "Requesting fullscreen…";
        fullscreenButton.disabled = true;

        try {
          await window.openai.requestDisplayMode({ mode: "fullscreen" });
          renderDiagnostics();
        } catch (error) {
          status.textContent = "Fullscreen request failed: " + String(error);
          fullscreenButton.disabled = false;
        }
      });

      window.addEventListener("openai:set_globals", renderDiagnostics, { passive: true });
      window.addEventListener("resize", renderDiagnostics, { passive: true });
      renderDiagnostics();
    </script>
  </body>
</html>`;
