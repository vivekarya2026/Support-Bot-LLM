/**
 * SupportKit embed loader.
 *
 * Usage:
 *   <script src="https://your-supportkit-host/embed.js" data-bot-key="pk_…" async></script>
 *
 * Injects a launcher button (bottom-right) that toggles an iframe pointing at
 * {scriptOrigin}/embed/{botKey}. Dependency-free; styles are inlined so the
 * host page's CSS can't break it.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var botKey = script.getAttribute("data-bot-key");
  if (!botKey) {
    console.warn("[SupportKit] embed.js loaded without data-bot-key");
    return;
  }
  var origin;
  try {
    origin = new URL(script.src).origin;
  } catch (e) {
    console.warn("[SupportKit] could not resolve script origin");
    return;
  }
  var accent = script.getAttribute("data-color") || "#3b82f6";
  var Z = 2147483000;

  var frame = document.createElement("iframe");
  frame.src = origin + "/embed/" + encodeURIComponent(botKey);
  frame.title = "Support chat";
  // "microphone" delegates mic permission into the widget iframe (voice input).
  // Host page must be HTTPS; a host Permissions-Policy denying microphone wins —
  // the widget then hides its mic button instead of erroring.
  frame.setAttribute("allow", "clipboard-write; microphone");
  frame.style.cssText =
    "position:fixed;bottom:88px;right:20px;width:min(420px,calc(100vw - 40px));" +
    "height:min(600px,calc(100dvh - 120px));border:0;border-radius:16px;" +
    "box-shadow:0 12px 24px rgba(0,0,0,.18),0 24px 48px rgba(0,0,0,.24);" +
    "z-index:" + Z + ";display:none;background:transparent;color-scheme:normal;";

  var button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Open support chat");
  button.setAttribute("aria-expanded", "false");
  button.style.cssText =
    "position:fixed;bottom:20px;right:20px;width:56px;height:56px;border:0;" +
    "border-radius:9999px;cursor:pointer;z-index:" + (Z + 1) + ";" +
    "background:" + accent + ";box-shadow:0 8px 24px rgba(0,0,0,.35);" +
    "display:flex;align-items:center;justify-content:center;padding:0;" +
    "transition:transform .15s ease;";
  button.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  button.addEventListener("mouseenter", function () {
    button.style.transform = "scale(1.06)";
  });
  button.addEventListener("mouseleave", function () {
    button.style.transform = "scale(1)";
  });

  var open = false;
  function setOpen(next) {
    open = next;
    frame.style.display = open ? "block" : "none";
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close support chat" : "Open support chat");
    button.innerHTML = open
      ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>'
      : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  }
  button.addEventListener("click", function () {
    setOpen(!open);
  });

  function mount() {
    document.body.appendChild(frame);
    document.body.appendChild(button);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
