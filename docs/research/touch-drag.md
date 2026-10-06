# Research: Touch drag on the board (HTML5 backend vs `react-dnd-multi-backend`)

_Checked: 2026-10-06 · Sprint: board-interaction (slice T1) · Base: `board-feel` at `120a56e` · Chrome 154 headless, 375×812 mobile touch emulation_

**Verdict: fits.** The `rdndmb-html5-to-touch` preset works with the board as it is: touch drag moves pieces, taps still reach `onClick`, desktop mouse drag is unchanged, and the page doesn't scroll during a drag. The next sprint needs two packages, a provider swap, a small touch-only drag preview, and the H1 `pickUp`-on-drag-start wiring. No board rewrite and no `touch-action` change.

## 1. Today's `HTML5Backend` on touch

| Check | Result |
|-------|--------|
| Touch drag e2 to e4 (150 ms hold, then 12 moves) | **No move.** The browser fires `touchstart`, `touchmove`, `touchend`, and never `dragstart`. |
| Long-press drag (800 ms hold, then move) | **No move.** Same events, no `dragstart`. |
| Tap e2, then tap the e4 dot | **Moves (1.e4).** Each tap fires `touchend → mousedown → click`, so the piece's `onMouseDown` select and the overlay `onClick` both run. Taps are not swallowed by the drag source. |
| Mouse drag on desktop (1280×900) | Moves (1.e4), as before. |
| Console | No errors or warnings in any run. |

Caveat: Chrome's touch emulation does not start native HTML5 drag from touch. Real Android Chrome (long-press drag) and iOS Safari 15+ may, but that wasn't checked on a device, and the board can't rely on it.

## 2. Packages (`npm view`, 2026-10-06)

| Package | Latest | `peerDependencies` | `dependencies` |
|---------|--------|--------------------|----------------|
| `react-dnd-multi-backend` | 9.0.0 (published 2025-06-16) | `react` and `react-dom` `^16.14.0 \|\| ^17.0.2 \|\| ^18.0.0 \|\| ^19.0.0`, `react-dnd ^16.0.1`, `dnd-core ^16.0.1` | `dnd-multi-backend ^9.0.0`, `react-dnd-preview ^9.0.0` |
| `rdndmb-html5-to-touch` | 9.0.0 | none | `dnd-multi-backend ^9.0.0`, `react-dnd-html5-backend ^16.0.1`, `react-dnd-touch-backend ^16.0.1` |
| `react-dnd-touch-backend` (pulled in) | 16.0.1 | — | — |

Both match this app: React 18.2, react-dnd 16.0.1, react-dnd-html5-backend 16.0.1. `npm install` added them with no peer warnings, and `npm ls` shows a single `react-dnd@16.0.1` and `dnd-core@16.0.1`, all deduped. `tsc --noEmit` passed. The production JS bundle grew from 345.5 kB (111.2 kB gzip) to 362.3 kB (115.8 kB gzip), including the trial preview.

The preset uses the HTML5 backend first (`PointerTransition`) and switches to the touch backend on the first `touchstart` (`TouchTransition`), with `enableMouseEvents: true` and `preview: true` on the touch side.

## 3. Multi-backend trial (reverted)

Trial changes, in order:

1. `src/index.tsx`: `DndProvider` from `react-dnd-multi-backend` with `options={HTML5toTouch}`, instead of the `react-dnd` provider with `HTML5Backend`.
2. `Piece.tsx`: select the piece when the drag starts (`useDrag` `item: () => { if (isOursTurn) select(); return { pieceType }; }`), and drop the `onMouseDown` select. This stands in for H1's `pickUp` dispatch on drag start.
3. `src/index.tsx`: a `<Preview generator={…}>` from `react-dnd-multi-backend` that draws the dragged piece's image (48 px) at the finger.

| Check | Step 1 only | Steps 1–2 | Steps 1–3 |
|-------|-------------|-----------|-----------|
| Touch drag e2 to e4 | Drag starts (the drag-over overlay shows) but the drop is **illegal**: nothing was selected, because the old select ran on `mousedown`, which touch only fires after `touchend`. | **Moves (1.e4)**; the dots show during the drag. | Moves. |
| Touch drag g1 to f3 | Same as above. | **Moves (1.Nf3).** | Moves (1.Nf3). |
| Tap e2, tap e4 | Moves (the old `onMouseDown` select still runs). | No move, because step 2 removed the tap select. H1's `clickSquare` brings it back. | — |
| Desktop mouse drag | Moves. | With `onMouseDown` still in place: **no move**, since `selectPiece` toggles and the second call deselects. With `onMouseDown` removed: moves. | Moves; no touch preview shows on desktop. |
| Drag preview under the finger | None. `DragPreviewImage` is HTML5-only, so the piece stays faded on its square and nothing follows the finger. | None. | **Shows**: the piece image follows the finger. |
| Page scroll (375×500 viewport, page scrolled to 150 px) | — | A drag that starts on a piece keeps `scrollY` at 150 for the whole drag. The touch backend calls `preventDefault()` on `touchmove` (`passive: false` listener) once dragging. A swipe that starts on an empty square still scrolls the page (150 → 276). | Same. |
| `touch-action` | No CSS change was needed in emulation. | | |
| Console | No errors or warnings. | | |

### What the next sprint needs

- **Dependencies:** `react-dnd-multi-backend` and `rdndmb-html5-to-touch` (both 9.0.0), the plan's one allowed runtime dependency. `react-dnd-html5-backend` can stay, because the preset depends on it anyway.
- **`src/index.tsx`:** the provider swap from step 1, plus a touch drag preview.
- **A drag preview component** (for example `src/features/board/components/PieceDragPreview.tsx`), rendered inside the provider. It uses `Preview` or `usePreview` from `react-dnd-multi-backend` and draws the piece image at the square size. It shows only under the touch backend.
- **Drag start must select the piece.** H1's `pickUp` on drag start covers this. Without it, every touch drag is an illegal drop. `pickUp` must never toggle (the contract already says so): the trial shows that a toggling select on both `mousedown` and drag start cancels itself on desktop.
- **`touch-action`:** none needed in emulation. If a real phone scrolls while dragging, add `touch-action: none` on `.piece` only, never on the page or the board.

### Open points for the next sprint

- Not checked on a real phone. Emulated touch is close but not the same, especially for scroll and long-press behavior on iOS Safari.
- The touch backend starts a drag on the first move with no delay. A swipe that starts on a piece drags it instead of scrolling. That's normal for chess boards, but a `delayTouchStart` option is there if users complain.
- A tap now fires `touchstart` twice in the capture log (the multi-backend and the touch backend both listen). Taps still reach `click`.

## 4. Steps to repeat

The `chrome-devtools-axi` CLI can set 375 px touch emulation (`emulate --viewport "375x812x2,mobile,touch"`), but it has no raw touch input, and its `drag` command uses the mouse. The touch checks therefore used a small Node script that sends Chrome DevTools Protocol `Input.dispatchTouchEvent` to a headless Chrome. These are real browser touch events, not events built in page JavaScript.

1. In a worktree: `npm install`, then `$env:PORT=3030; npm run dev` (PowerShell).
2. Start Chrome with a debugging port:
   `chrome.exe --headless=new --remote-debugging-port=9333 --user-data-dir=<temp dir> --no-first-run about:blank`
3. Save the script below as `touch.mjs` outside the repo and run `node touch.mjs <scenario> [tag]`, where `<scenario>` is `drag`, `longdrag`, `tap`, `scrolldrag` or `swipe` (375 px touch) or `mousedrag` (1280 px mouse). Set `H=500` for a short, scrollable viewport. Each run prints the piece on the from and to squares before and after, the events seen, the max scroll and any console errors. It saves a screenshot mid-drag and at the end.
4. For the trial: `npm install react-dnd-multi-backend rdndmb-html5-to-touch`, make trial steps 1–3 above, and run the scenarios again.
5. Revert: `git checkout -- package.json package-lock.json src/` in the worktree, then `npm install`.

<details>
<summary><code>touch.mjs</code></summary>

```js
const scenario = process.argv[2] || "drag";
const URL_ = "http://127.0.0.1:3030/chess-web/";
const targets = await (await fetch("http://127.0.0.1:9333/json/list")).json();
let t = targets.find((x) => x.type === "page" && x.url.startsWith("about:blank"));
if (!t) t = await (await fetch("http://127.0.0.1:9333/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === "Runtime.consoleAPICalled" && (d.params.type === "error" || d.params.type === "warning"))
    logs.push(d.params.type + ": " + d.params.args.map((a) => a.value ?? a.description).join(" "));
  if (d.method === "Runtime.exceptionThrown") logs.push("exception: " + d.params.exceptionDetails.text);
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, (d) => r(d.result)); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

await send("Runtime.enable");
await send("Page.enable");
if (scenario === "mousedrag") {
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
} else {
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: +(process.env.H || 812), deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
}
await send("Page.navigate", { url: URL_ });
await sleep(2500);
await ev(`(() => { window.__ev = []; for (const t of ['touchstart','touchmove','touchend','touchcancel','pointerdown','mousedown','click','dragstart','dragend','drop']) document.addEventListener(t, () => window.__ev.push(t), true); addEventListener('scroll', () => window.__maxScroll = Math.max(window.__maxScroll || 0, scrollY)); return true })()`);

const sq = (name) => ev(`(() => { const f = '${name}'.charCodeAt(0) - 97, r = 8 - +'${name}'[1]; const el = document.querySelectorAll('.square')[r*8+f]; const b = el.getBoundingClientRect(); return { x: b.x + b.width/2, y: b.y + b.height/2, piece: el.querySelector('.piece')?.className || null } })()`);
const touch = (type, p) => send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1, radiusX: 5, radiusY: 5, force: 1 }] : [] });
const mouse = (type, p, buttons = 1) => send("Input.dispatchMouseEvent", { type, x: p.x, y: p.y, button: "left", buttons, clickCount: 1 });

const from = scenario === "scrolldrag" ? "g1" : scenario === "swipe" ? "e4" : "e2";
const to = scenario === "scrolldrag" ? "f3" : scenario === "swipe" ? "e8" : "e4";
if (process.env.H) { await ev("scrollTo(0, 150)"); await sleep(300); }
const a = await sq(from), b = await sq(to);
console.log("before", from, a.piece, "|", to, b.piece);

if (["drag", "longdrag", "scrolldrag", "swipe"].includes(scenario)) {
  await touch("touchStart", a);
  await sleep(scenario === "longdrag" ? 800 : 150);
  for (let i = 1; i <= 12; i++) {
    await touch("touchMove", { x: a.x + ((b.x - a.x) * i) / 12, y: a.y + ((b.y - a.y) * i) / 12 });
    await sleep(30);
    if (i === 6) {
      const sh = await send("Page.captureScreenshot", { format: "png" });
      (await import("node:fs")).writeFileSync(`mid-${scenario}${process.argv[3] || ""}.png`, Buffer.from(sh.data, "base64"));
      console.log("mid-drag overlays", await ev(`[...document.querySelectorAll('.overlay')].map(o => o.className).join(',') || 'none'`), "scrollY", await ev("scrollY"));
    }
  }
  await sleep(100);
  await touch("touchEnd");
} else if (scenario === "tap") {
  await touch("touchStart", a); await sleep(60); await touch("touchEnd"); await sleep(400);
  await touch("touchStart", b); await sleep(60); await touch("touchEnd");
} else if (scenario === "mousedrag") {
  await mouse("mouseMoved", a, 0);
  await mouse("mousePressed", a);
  for (let i = 1; i <= 10; i++) { await mouse("mouseMoved", { x: a.x + ((b.x - a.x) * i) / 10, y: a.y + ((b.y - a.y) * i) / 10 }); await sleep(30); }
  await mouse("mouseReleased", b, 0);
}
await sleep(800);
const a2 = await sq(from), b2 = await sq(to);
console.log("after ", from, a2.piece, "|", to, b2.piece);
console.log("events", await ev("window.__ev.join(' ')"));
console.log("maxScroll", await ev("window.__maxScroll || 0"));
console.log("console", logs.length ? logs.join("\n") : "none");
const shot = await send("Page.captureScreenshot", { format: "png" });
(await import("node:fs")).writeFileSync(`shot-${scenario}${process.argv[3] || ""}.png`, Buffer.from(shot.data, "base64"));
ws.close();
```

</details>
