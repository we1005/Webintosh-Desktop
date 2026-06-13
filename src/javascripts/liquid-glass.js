/*
 * liquid-glass.js — Reusable "liquid glass" (Apple-style optical refraction) module.
 *
 * Technique adapted from rizroze/liquid-glass (https://github.com/rizroze/liquid-glass)
 *   Copyright (c) 2026 Riz Roze — MIT License.
 *
 * This file is an original re-implementation of the same technique (Canvas-generated
 * displacement map + SVG feImage/feDisplacementMap per RGB channel + backdrop-filter:url(#id),
 * with capability detection and a plain blur/saturate fallback). The above copyright notice
 * and the MIT permission notice are retained per the MIT license.
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction... THE SOFTWARE IS PROVIDED "AS IS",
 *   WITHOUT WARRANTY OF ANY KIND. (Full MIT text: see rizroze/liquid-glass LICENSE.)
 *
 * Zero dependencies, native ES module. No rAF loop: the displacement map is rebuilt
 * only when options or element size change (size changes are debounced via ResizeObserver).
 *
 * Public API:
 *   applyLiquidGlass(el, opts = {})  -> instance handle ({ update, remove, el, supported })
 *   removeLiquidGlass(el)            -> void
 *   supportsLiquidGlass()            -> boolean
 */

// ---------------------------------------------------------------------------
// Capability detection
// ---------------------------------------------------------------------------

let _supportCache = null;

/**
 * Returns true only when the browser can apply an SVG filter through
 * `backdrop-filter: url(#id)` — in practice this means a Chromium engine.
 * Safari / Firefox return false and callers should fall back to plain blur.
 */
export function supportsLiquidGlass() {
  if (_supportCache !== null) return _supportCache;

  let ok = false;
  try {
    // CSS.supports does not actually validate url() filter rendering, so we
    // combine a feature probe with an engine check. backdrop-filter:url() is
    // only rendered correctly by Chromium today.
    const probe =
      (typeof CSS !== "undefined" &&
        (CSS.supports("backdrop-filter", "url(#x)") ||
          CSS.supports("-webkit-backdrop-filter", "url(#x)"))) ||
      false;

    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    // Chromium engines (Chrome, Edge, Opera, Brave) all carry "Chrome/".
    // Safari/Firefox do not, and they do not render backdrop-filter:url() anyway.
    const isChromium = /Chrome\//.test(ua);

    ok = probe && isChromium;
  } catch (_e) {
    ok = false;
  }

  _supportCache = ok;
  return ok;
}

// ---------------------------------------------------------------------------
// Defaults (mirrors rizroze option names/semantics where sensible)
// ---------------------------------------------------------------------------

const DEFAULTS = {
  borderRadius: null, // px; null -> inherit element's computed border-radius
  scale: -180, // displacement strength (negative = inward refraction)
  aberration: [0, 8, 16], // per-channel [r,g,b] extra displacement (chromatic fringe)
  blur: 11, // edge blur (px) used when generating the displacement map
  border: 0.07, // neutral-center inset as a fraction of the smaller side
  displaceBlur: 0, // post-displacement gaussian blur (px)
  saturation: 1.6, // backdrop saturation multiplier
  fallbackFilter: "blur(12px) saturate(180%)", // non-Chromium fallback
  tint: "rgba(255,255,255,0.10)", // subtle glass tint (applied via CSS var)
  debounce: 120, // ResizeObserver debounce (ms)
};

// ---------------------------------------------------------------------------
// One-time injected stylesheet (kept in sync with assets/stylesheets/liquid-glass.css)
// ---------------------------------------------------------------------------

const STYLE_ID = "liquid-glass-style";

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.liquid-glass {
  position: relative;
  isolation: isolate;
  background-color: var(--lg-tint, rgba(255,255,255,0.10));
  box-shadow:
    inset 0 1px 0 0 rgba(255,255,255,0.45),
    inset 0 -1px 0 0 rgba(255,255,255,0.08),
    inset 0 0 0 1px rgba(255,255,255,0.10),
    0 10px 30px rgba(0,0,0,0.18);
}
.liquid-glass::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 1;
  /* top-edge specular highlight */
  background: linear-gradient(
    180deg,
    rgba(255,255,255,0.25) 0%,
    rgba(255,255,255,0.04) 18%,
    rgba(255,255,255,0) 45%
  );
  mix-blend-mode: screen;
}
.liquid-glass > * {
  position: relative;
  z-index: 2;
}`;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// SVG filter host (single shared <svg> appended to <body>)
// ---------------------------------------------------------------------------

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_HOST_ID = "liquid-glass-svg-host";

function ensureSvgHost() {
  let host = document.getElementById(SVG_HOST_ID);
  if (host) return host;
  host = document.createElementNS(SVG_NS, "svg");
  host.setAttribute("id", SVG_HOST_ID);
  host.setAttribute("aria-hidden", "true");
  // Keep it out of layout / painting but available for filter references.
  host.style.cssText =
    "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;";
  document.body.appendChild(host);
  return host;
}

let _idCounter = 0;
function nextId() {
  _idCounter += 1;
  return `lg-${Date.now().toString(36)}-${_idCounter}`;
}

// ---------------------------------------------------------------------------
// Displacement map generation (Canvas 2D -> dataURL)
// ---------------------------------------------------------------------------
//
// Encoding: feDisplacementMap reads one channel for X offset and one for Y.
// We encode horizontal displacement in RED (left/right gradient around 128)
// and vertical displacement in GREEN/BLUE (top/bottom gradient around 128).
// The center is neutral gray (128,128,128) => zero displacement (clear glass),
// while the edges ramp away from 128 to bend the backdrop inward.

function buildDisplacementMap(width, height, opts) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  const radius = clampRadius(
    opts.borderRadius == null ? Math.min(w, h) * 0.18 : opts.borderRadius,
    w,
    h
  );
  // inset thickness of the refracting edge band
  const edge = Math.max(1, Math.min(w, h) * Math.max(0.02, opts.border));

  // Neutral fill (no displacement anywhere by default).
  ctx.fillStyle = "rgb(128,128,128)";
  ctx.fillRect(0, 0, w, h);

  // RED channel: horizontal gradient (left -> right) deviating from 128 at edges.
  // 0 at far-left, 255 at far-right; the displacement map's X reads RED.
  const gx = ctx.createLinearGradient(0, 0, w, 0);
  gx.addColorStop(0, "rgba(0,0,0,1)"); // strong negative X push
  gx.addColorStop(0.5, "rgba(0,0,0,0)"); // neutral center
  gx.addColorStop(1, "rgba(255,0,0,1)"); // strong positive X push
  ctx.globalCompositeOperation = "lighter";
  // We approximate by painting red intensity via a horizontal gradient.
  const gRed = ctx.createLinearGradient(0, 0, w, 0);
  gRed.addColorStop(0, "rgba(255,0,0,0.0)");
  gRed.addColorStop(0.5, "rgba(255,0,0,0.0)");
  gRed.addColorStop(1, "rgba(255,0,0,1.0)");
  ctx.fillStyle = gRed;
  ctx.fillRect(0, 0, w, h);

  // GREEN channel: vertical gradient (top -> bottom) for Y displacement.
  const gGreen = ctx.createLinearGradient(0, 0, 0, h);
  gGreen.addColorStop(0, "rgba(0,255,0,0.0)");
  gGreen.addColorStop(0.5, "rgba(0,255,0,0.0)");
  gGreen.addColorStop(1, "rgba(0,255,0,1.0)");
  ctx.fillStyle = gGreen;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "source-over";

  // Carve a neutral (gray) clear center so only the rounded edge band refracts.
  // Inset rounded rect filled with 50% gray neutralizes displacement in the middle.
  const innerX = edge;
  const innerY = edge;
  const innerW = Math.max(1, w - edge * 2);
  const innerH = Math.max(1, h - edge * 2);
  const innerR = Math.max(0, radius - edge);

  ctx.save();
  roundRectPath(ctx, innerX, innerY, innerW, innerH, innerR);
  ctx.fillStyle = "rgb(128,128,128)";
  ctx.fill();
  ctx.restore();

  // Soften the edge band so the refraction ramps smoothly.
  if (opts.blur > 0 && typeof ctx.filter === "string") {
    // Re-draw the canvas onto itself through a blur for a feathered edge.
    try {
      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      const tctx = tmp.getContext("2d");
      tctx.filter = `blur(${opts.blur}px)`;
      tctx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tmp, 0, 0);
    } catch (_e) {
      /* blur unsupported -> keep crisp map */
    }
  }

  return canvas.toDataURL("image/png");
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function clampRadius(r, w, h) {
  const max = Math.min(w, h) / 2;
  return Math.max(0, Math.min(r, max));
}

// ---------------------------------------------------------------------------
// SVG filter construction (one <filter> per instance, 3 RGB displacement passes)
// ---------------------------------------------------------------------------

function buildFilter(id, mapHref, width, height, opts) {
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", id);
  filter.setAttribute("x", "0");
  filter.setAttribute("y", "0");
  filter.setAttribute("width", "100%");
  filter.setAttribute("height", "100%");
  filter.setAttribute("color-interpolation-filters", "sRGB");

  // Shared displacement source image.
  const feImage = document.createElementNS(SVG_NS, "feImage");
  feImage.setAttribute("href", mapHref);
  feImage.setAttributeNS(
    "http://www.w3.org/1999/xlink",
    "xlink:href",
    mapHref
  );
  feImage.setAttribute("x", "0");
  feImage.setAttribute("y", "0");
  feImage.setAttribute("width", String(width));
  feImage.setAttribute("height", String(height));
  feImage.setAttribute("result", "lg_map");
  feImage.setAttribute("preserveAspectRatio", "none");
  filter.appendChild(feImage);

  const [ar, ag, ab] = opts.aberration;
  const channels = [
    { scale: opts.scale + ar, matrix: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0", out: "lg_r" },
    { scale: opts.scale + ag, matrix: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0", out: "lg_g" },
    { scale: opts.scale + ab, matrix: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0", out: "lg_b" },
  ];

  for (const ch of channels) {
    const disp = document.createElementNS(SVG_NS, "feDisplacementMap");
    disp.setAttribute("in", "SourceGraphic");
    disp.setAttribute("in2", "lg_map");
    disp.setAttribute("scale", String(ch.scale));
    disp.setAttribute("xChannelSelector", "R");
    disp.setAttribute("yChannelSelector", "G");
    const dispOut = ch.out + "_disp";
    disp.setAttribute("result", dispOut);
    filter.appendChild(disp);

    const cm = document.createElementNS(SVG_NS, "feColorMatrix");
    cm.setAttribute("in", dispOut);
    cm.setAttribute("type", "matrix");
    cm.setAttribute("values", ch.matrix);
    cm.setAttribute("result", ch.out);
    filter.appendChild(cm);
  }

  // Screen-blend the three channel results back together (additive recombination).
  const blendRG = document.createElementNS(SVG_NS, "feBlend");
  blendRG.setAttribute("in", "lg_r");
  blendRG.setAttribute("in2", "lg_g");
  blendRG.setAttribute("mode", "screen");
  blendRG.setAttribute("result", "lg_rg");
  filter.appendChild(blendRG);

  const blendRGB = document.createElementNS(SVG_NS, "feBlend");
  blendRGB.setAttribute("in", "lg_rg");
  blendRGB.setAttribute("in2", "lg_b");
  blendRGB.setAttribute("mode", "screen");
  blendRGB.setAttribute("result", "lg_rgb");
  filter.appendChild(blendRGB);

  if (opts.displaceBlur > 0) {
    const gb = document.createElementNS(SVG_NS, "feGaussianBlur");
    gb.setAttribute("in", "lg_rgb");
    gb.setAttribute("stdDeviation", String(opts.displaceBlur));
    filter.appendChild(gb);
  }

  return filter;
}

// ---------------------------------------------------------------------------
// Instance registry
// ---------------------------------------------------------------------------

const REGISTRY = new WeakMap(); // el -> instance

function debounce(fn, ms) {
  let t = null;
  const wrapped = (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, ms);
  };
  wrapped.cancel = () => {
    if (t) clearTimeout(t);
    t = null;
  };
  return wrapped;
}

function readComputedRadius(el) {
  try {
    const cs = getComputedStyle(el);
    const r = parseFloat(cs.borderTopLeftRadius);
    return Number.isFinite(r) ? r : 0;
  } catch (_e) {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Public: applyLiquidGlass
// ---------------------------------------------------------------------------

/**
 * Apply the liquid-glass effect to an element.
 * @param {HTMLElement} el   target element
 * @param {object} opts      see DEFAULTS
 * @returns {{el:HTMLElement, supported:boolean, update:Function, remove:Function}}
 */
export function applyLiquidGlass(el, opts = {}) {
  if (!el || el.nodeType !== 1) {
    throw new TypeError("applyLiquidGlass: first argument must be an element");
  }

  // Re-apply on an already-glassed element == update.
  const existing = REGISTRY.get(el);
  if (existing) {
    existing.update(opts);
    return existing;
  }

  ensureStyle();

  const options = { ...DEFAULTS, ...opts };
  el.classList.add("liquid-glass");
  if (options.tint != null) el.style.setProperty("--lg-tint", options.tint);

  const supported = supportsLiquidGlass();

  // ---- Fallback path (Safari / Firefox / anything non-Chromium) ----------
  if (!supported) {
    el.style.backdropFilter = options.fallbackFilter;
    el.style.webkitBackdropFilter = options.fallbackFilter;
    const fallbackInstance = {
      el,
      supported: false,
      _options: options,
      update(next = {}) {
        Object.assign(this._options, next);
        if (this._options.tint != null)
          el.style.setProperty("--lg-tint", this._options.tint);
        el.style.backdropFilter = this._options.fallbackFilter;
        el.style.webkitBackdropFilter = this._options.fallbackFilter;
      },
      remove() {
        _teardown(el, this);
      },
    };
    REGISTRY.set(el, fallbackInstance);
    return fallbackInstance;
  }

  // ---- Full liquid-glass path (Chromium) ---------------------------------
  const host = ensureSvgHost();
  const filterId = nextId();

  const instance = {
    el,
    supported: true,
    filterId,
    host,
    _options: options,
    _filterEl: null,
    _ro: null,
    _rebuild: null,

    _build() {
      const rect = el.getBoundingClientRect();
      const w = Math.max(1, rect.width || el.offsetWidth || 1);
      const h = Math.max(1, rect.height || el.offsetHeight || 1);

      // Resolve border radius (inherit computed value when not specified).
      const o = this._options;
      const resolved = {
        ...o,
        borderRadius:
          o.borderRadius == null ? readComputedRadius(el) : o.borderRadius,
      };

      const mapHref = buildDisplacementMap(w, h, resolved);

      // Replace the filter node atomically.
      const newFilter = buildFilter(filterId, mapHref, w, h, resolved);
      if (this._filterEl && this._filterEl.parentNode === host) {
        host.replaceChild(newFilter, this._filterEl);
      } else {
        host.appendChild(newFilter);
      }
      this._filterEl = newFilter;

      const value = `url(#${filterId}) saturate(${resolved.saturation})`;
      el.style.backdropFilter = value;
      el.style.webkitBackdropFilter = value;
    },

    update(next = {}) {
      Object.assign(this._options, next);
      if (this._options.tint != null)
        el.style.setProperty("--lg-tint", this._options.tint);
      this._build();
    },

    remove() {
      _teardown(el, this);
    },
  };

  // Initial build.
  instance._build();

  // Rebuild (debounced) only on size change — no rAF loop.
  const rebuild = debounce(() => instance._build(), options.debounce);
  instance._rebuild = rebuild;

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => rebuild());
    ro.observe(el);
    instance._ro = ro;
  }

  REGISTRY.set(el, instance);
  return instance;
}

// ---------------------------------------------------------------------------
// Public: removeLiquidGlass
// ---------------------------------------------------------------------------

export function removeLiquidGlass(el) {
  const instance = REGISTRY.get(el);
  if (!instance) return;
  _teardown(el, instance);
}

function _teardown(el, instance) {
  try {
    if (instance._ro) instance._ro.disconnect();
    if (instance._rebuild && instance._rebuild.cancel)
      instance._rebuild.cancel();
    if (
      instance._filterEl &&
      instance._filterEl.parentNode
    ) {
      instance._filterEl.parentNode.removeChild(instance._filterEl);
    }
  } catch (_e) {
    /* noop */
  }
  el.classList.remove("liquid-glass");
  el.style.removeProperty("--lg-tint");
  el.style.backdropFilter = "";
  el.style.webkitBackdropFilter = "";
  REGISTRY.delete(el);
}

export default { applyLiquidGlass, removeLiquidGlass, supportsLiquidGlass };
