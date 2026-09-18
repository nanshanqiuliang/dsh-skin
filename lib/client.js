/**
 * dsh-skin 浏览器半边。
 *
 * 由 @deepseek-ai/dsh-client-modules 作为惰性 CJS 工厂加载：执行本文件只注册工厂，
 * 真正的副作用在首次 materialize 时发生。
 *
 * 能力：
 *  - 把皮肤素材（图片 / GIF / 视频）铺成固定背景层，毛玻璃虚化 + 暗化 + 饱和度可调；
 *  - 用皮肤的主题色覆盖 --dsw-alias-* 设计令牌，让整个 UI 跟着换色（可读性做了亮度兜底）；
 *  - 星空闪烁 / 流星划过的 Canvas 动态效果；
 *  - 右下角 🎨 悬浮面板：切换皮肤、调虚化/暗化/饱和、开启动态效果、打开皮肤文件夹；
 *  - 保留原始皮肤（default），一切覆盖都可完全撤掉。
 */
window.__ModuleLoader__.load({
  id: 'dsh-skin',
  factory: (require) => {
    const exports = {}
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const PLUGIN_ID = 'dsh-skin'
    const API = '/skin-api'
    const STYLE_ID = `${PLUGIN_ID}/skin.css`
    const DEFAULT_ACCENT = '#5b8cff'

    /* ─────────────────────────────── 样式 ─────────────────────────────── */

    const CSS = `
#dsh-skin-layer{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;background:transparent}
#dsh-skin-layer>*{position:absolute;inset:0;width:100%;height:100%}
#dsh-skin-media{background-image:none;background-position:center center;background-repeat:no-repeat;background-size:var(--dsh-skin-fit,cover);filter:blur(var(--dsh-skin-blur,0px)) saturate(var(--dsh-skin-sat,1));transform:scale(var(--dsh-skin-scale,1.08));transform-origin:center center;will-change:filter,transform}
#dsh-skin-video{object-fit:var(--dsh-skin-fit,cover);display:none;filter:blur(var(--dsh-skin-blur,0px)) saturate(var(--dsh-skin-sat,1));transform:scale(var(--dsh-skin-scale,1.08));transform-origin:center center}
#dsh-skin-fx{opacity:var(--dsh-skin-fx,0);transition:opacity .3s ease}
#dsh-skin-dim{background:var(--dsh-skin-dim-color,transparent)}
html[data-dsh-skin]{background-color:var(--dsh-skin-canvas,#0b0b0d)}

#dsh-skin-fab{position:fixed;right:18px;bottom:18px;z-index:2147481000;width:42px;height:42px;padding:0;border-radius:21px;border:.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:var(--dsw-alias-button-floating-fill,rgba(255,255,255,.92));color:var(--dsw-alias-label-primary,#111);box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer;font-size:19px;line-height:1;display:flex;align-items:center;justify-content:center;font-family:inherit;transition:transform .15s ease}
#dsh-skin-fab:hover{transform:scale(1.06);background:var(--dsw-alias-button-floating-hover,rgba(245,245,245,.96))}
#dsh-skin-fab[data-open="1"]{background:var(--dsw-alias-button-primary-fill,#3b6cf6);color:var(--dsw-alias-label-primary-foreground,#fff)}

#dsh-skin-panel{position:fixed;right:18px;bottom:70px;z-index:2147481001;width:348px;max-width:calc(100vw - 36px);max-height:min(76vh,660px);overflow:auto;box-sizing:border-box;padding:14px;border-radius:16px;border:.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.98));color:var(--dsw-alias-label-primary,#111);box-shadow:0 18px 48px rgba(0,0,0,.35);font-size:13px;line-height:18px;font-family:inherit;-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}
#dsh-skin-panel[hidden]{display:none}
#dsh-skin-panel *{box-sizing:border-box}
#dsh-skin-panel .sk-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
#dsh-skin-panel .sk-title{font-size:14px;font-weight:600;flex:1}
#dsh-skin-panel .sk-icon{width:26px;height:26px;padding:0;border-radius:8px;border:.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));background:transparent;color:inherit;cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center;font-family:inherit}
#dsh-skin-panel .sk-icon:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14))}
#dsh-skin-panel .sk-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
#dsh-skin-panel .sk-card{display:block;width:100%;padding:0;border-radius:10px;overflow:hidden;border:.5px solid var(--dsw-alias-border-l3,rgba(128,128,128,.28));background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.06));color:inherit;cursor:pointer;text-align:left;font-family:inherit;transition:border-color .15s ease,transform .15s ease}
#dsh-skin-panel .sk-card:hover{transform:translateY(-1px);border-color:var(--dsw-alias-border-l4,rgba(128,128,128,.5))}
#dsh-skin-panel .sk-card[data-selected="1"]{border-color:var(--dsw-alias-brand-primary,#3b6cf6);box-shadow:0 0 0 1px var(--dsw-alias-brand-primary,#3b6cf6) inset}
#dsh-skin-panel .sk-thumb{position:relative;display:block;width:100%;aspect-ratio:16/9;background:linear-gradient(120deg,rgba(128,128,128,.18),rgba(128,128,128,.05));overflow:hidden}
#dsh-skin-panel .sk-thumb img,#dsh-skin-panel .sk-thumb video{width:100%;height:100%;object-fit:cover;display:block}
#dsh-skin-panel .sk-thumb.sk-plain{display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--dsw-alias-label-tertiary,rgba(128,128,128,.9))}
#dsh-skin-panel .sk-badge{position:absolute;left:6px;top:6px;padding:1px 6px;border-radius:6px;background:rgba(0,0,0,.55);color:#fff;font-size:10px;line-height:14px}
#dsh-skin-panel .sk-name{display:block;padding:6px 8px;font-size:12px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-secondary,inherit)}
#dsh-skin-panel .sk-row{display:grid;grid-template-columns:56px 1fr 44px;align-items:center;gap:8px;padding:4px 0;color:var(--dsw-alias-label-secondary,inherit)}
#dsh-skin-panel .sk-row[data-disabled="1"]{opacity:.45;pointer-events:none}
#dsh-skin-panel .sk-row output{text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary,inherit)}
#dsh-skin-panel input[type=range]{width:100%;accent-color:var(--dsw-alias-brand-primary,#3b6cf6);height:18px;margin:0}
#dsh-skin-panel .sk-chips{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
#dsh-skin-panel .sk-chip{flex:1;min-width:96px;padding:7px 10px;border-radius:10px;border:.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.06));color:inherit;cursor:pointer;font-size:12px;font-family:inherit;text-align:center}
#dsh-skin-panel .sk-chip[data-on="1"]{background:var(--dsw-alias-button-primary-fill,#3b6cf6);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}
#dsh-skin-panel .sk-foot{margin-top:10px;padding-top:8px;border-top:.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.24));font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,rgba(128,128,128,.95));word-break:break-all}
@media (prefers-reduced-motion: reduce){#dsh-skin-fab{transition:none}}
#dsh-skin-panel .sk-sep{margin:10px 0 4px;border-top:.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.24))}
#dsh-skin-panel input.sk-hue{background:linear-gradient(90deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000);border-radius:6px}
#dsh-skin-panel input.sk-hue::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:18px;border-radius:5px;background:#fff;border:1px solid rgba(0,0,0,.45);box-shadow:0 1px 3px rgba(0,0,0,.4)}
#dsh-skin-panel input.sk-hue::-moz-range-thumb{width:10px;height:18px;border-radius:5px;background:#fff;border:1px solid rgba(0,0,0,.45)}
#dsh-skin-panel .sk-sw{display:inline-block;width:12px;height:12px;border-radius:3px;border:.5px solid rgba(128,128,128,.6);vertical-align:-2px;margin:0 2px}
#dsh-skin-panel .sk-ratio{font-variant-numeric:tabular-nums;font-weight:600}
#dsh-skin-panel .sk-ratio[data-level="good"]{color:#2fa46b}
#dsh-skin-panel .sk-ratio[data-level="ok"]{color:#c98a00}
#dsh-skin-panel .sk-ratio[data-level="bad"]{color:#e5484d}
`

    function installStyles() {
      if (typeof document === 'undefined') return
      if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`) !== null) return
      const tag = document.createElement('style')
      tag.dataset.plugin = PLUGIN_ID
      tag.dataset.pluginCss = STYLE_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /* ─────────────────────────────── 小工具 ─────────────────────────────── */

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

    function num(value, fallback, min, max) {
      const n = Number(value)
      return Number.isFinite(n) ? clamp(n, min, max) : fallback
    }

    function flag(value, fallback) {
      return typeof value === 'boolean' ? value : fallback
    }

    function parseColor(input) {
      if (typeof input !== 'string') return null
      const value = input.trim().toLowerCase()
      if (value === '' || value === 'transparent') return null
      if (value.startsWith('#')) {
        const hex = value.slice(1)
        if (hex.length === 3 || hex.length === 4) {
          return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16))
        }
        if (hex.length === 6 || hex.length === 8) {
          return [0, 1, 2].map((i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16))
        }
        return null
      }
      const match = /^rgba?\(([^)]+)\)$/.exec(value)
      if (match !== null) {
        const parts = match[1].split(/[\s,/]+/).filter((part) => part !== '')
        if (parts.length < 3) return null
        const rgb = parts.slice(0, 3).map((part) => part.endsWith('%') ? Number.parseFloat(part) * 2.55 : Number.parseFloat(part))
        return rgb.some((v) => !Number.isFinite(v)) ? null : rgb
      }
      return null
    }

    const toHex = (rgb) => `#${rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`
    const toRgba = (rgb, alpha) => `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${Number(alpha.toFixed(3))})`

    function luminance(rgb) {
      const channel = (value) => {
        const c = value / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      }
      return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
    }

    function mix(a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
    }

    /** 朝黑/白方向混合到目标亮度以内，保证前景/背景对比度。 */
    function fitLuminance(rgb, target, darker) {
      const goal = darker ? (current) => current <= target : (current) => current >= target
      if (goal(luminance(rgb))) return rgb
      let low = 0
      let high = 1
      const toward = darker ? [0, 0, 0] : [255, 255, 255]
      for (let i = 0; i < 18; i += 1) {
        const mid = (low + high) / 2
        if (goal(luminance(mix(rgb, toward, mid)))) high = mid
        else low = mid
      }
      return mix(rgb, toward, high)
    }

    /** HSL -> RGB。h 0~360，s/l 0~100。 */
    function hslToRgb(h, s, l) {
      const hh = (((Number(h) % 360) + 360) % 360) / 360
      const ss = clamp(Number(s), 0, 100) / 100
      const ll = clamp(Number(l), 0, 100) / 100
      if (ss === 0) { const v = ll * 255; return [v, v, v] }
      const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
      const p = 2 * ll - q
      const channel = (t) => {
        let x = t
        if (x < 0) x += 1
        if (x > 1) x -= 1
        if (x < 1 / 6) return p + (q - p) * 6 * x
        if (x < 1 / 2) return q
        if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
        return p
      }
      return [channel(hh + 1 / 3) * 255, channel(hh) * 255, channel(hh - 1 / 3) * 255]
    }

    /** RGB -> HSL，用于把主题自带颜色转成滑杆起点。 */
    function rgbToHsl(rgb) {
      const r = clamp(rgb[0], 0, 255) / 255
      const g = clamp(rgb[1], 0, 255) / 255
      const b = clamp(rgb[2], 0, 255) / 255
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const l = (max + min) / 2
      if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }
      const d = max - min
      const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      let h
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      else if (max === g) h = ((b - r) / d + 2) / 6
      else h = ((r - g) / d + 4) / 6
      return { h: Math.round(h * 360), s: Math.round(sat * 100), l: Math.round(l * 100) }
    }

    /** WCAG 对比度（1~21）。文本 ≥4.5 舒适，3~4.5 勉强，<3 基本看不清。 */
    function contrastRatio(a, b) {
      const la = luminance(a)
      const lb = luminance(b)
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
    }

    /* ─────────────────────────────── 状态 ─────────────────────────────── */

    let ctxRef = null
    let catalog = { dir: '', skins: [] }
    let state = { active: null, perSkin: {} }
    let current = null
    let effective = null
    let layer = null
    let ui = null
    let overrideDispose = null
    let inlineTokens = []
    let applying = false
    let saveTimer = 0
    let pollTimer = 0
    let disposed = false
    let paletteTried = new Set()
    let mediaAverage = null
    let lastSurfaceAlpha = 0.62

    /* ─────────────────────── 设计令牌覆盖（主题色） ─────────────────────── */

    const SURFACE_TOKENS = [
      ['--dsw-alias-bg-base', 0.44, 's'],
      ['--dsw-alias-bg-layer-1', 0.62, 's'],
      ['--dsw-alias-bg-layer-2', 0.78, 's'],
      ['--dsw-alias-bg-layer-3', 0.92],
      ['--dsw-alias-bg-overlay', 0.9],
      ['--dsw-alias-bg-module-platform', 0.68, 's'],
      ['--dsw-alias-bg-skeleton', 0.6, 's'],
      ['--dsw-alias-bg-mask-1', 0.62, 's'],
      ['--dsw-alias-bg-mask-2', 0.72, 's'],
      ['--dsw-alias-bg-mask-3', 0.8],
      ['--dsw-alias-bg-mask-drop', 0.86],
      ['--dsw-alias-bg-mask-photo', 0.86],
      ['--dsw-alias-bg-multi-select', 0.62],
      ['--dsw-specific-sidebar-fill', 0.58, 's'],
      ['--dsw-specific-menu', 0.88],
      ['--dsw-specific-input-major', 0.76, 's'],
      ['--dsw-specific-bubble', 0.7, 's'],
      ['--dsw-specific-selector', 0.86],
      ['--dsw-specific-tip', 0.88],
      ['--dsw-alias-toast-bg', 0.92],
      ['--dsw-alias-tooltip-bg', 0.92],
      ['--dsw-alias-markdown-code-block', 0.78, 's'],
      ['--dsw-alias-markdown-code-block-banner', 0.84],
      ['--dsw-alias-markdown-inline-code', 0.7, 's'],
      ['--dsw-alias-button-tool-bar-fill', 0.72],
      ['--dsw-alias-button-floating-fill', 0.84],
      ['--dsw-alias-button-floating-hover', 0.9],
      ['--dsw-alias-button-elevated-fill', 0.88],
      ['--dsw-alias-button-contrast-fill', 0.92],
      ['--dsw-alias-interactive-bg-hover', 0.42],
      ['--dsw-alias-interactive-bg-active', 0.55],
    ]

    const ACCENT_TOKENS = [
      '--dsw-alias-brand-primary',
      '--dsw-alias-link',
      '--dsw-alias-markdown-citation',
      '--dsw-alias-button-primary-fill',
      '--dsw-alias-button-primary-hover',
    ]

    const baseVar = (name) => `--dsh-skin-base-${name.replace(/^--dsw-/, '')}`

    function themeService() {
      try { return ctxRef !== null && typeof ctxRef.get === 'function' ? ctxRef.get('theme') ?? null : null } catch { return null }
    }

    function disposeTokens() {
      if (overrideDispose !== null) {
        const dispose = overrideDispose
        overrideDispose = null
        try { dispose() } catch { /* 忽略 */ }
      }
      if (inlineTokens.length > 0) {
        for (const name of inlineTokens) document.body.style.removeProperty(name)
        inlineTokens = []
      }
    }

    function applyTokens(tokens) {
      const theme = themeService()
      if (theme !== null && typeof theme.overrideTokens === 'function') {
        try { overrideDispose = theme.overrideTokens(PLUGIN_ID, tokens); return } catch { overrideDispose = null }
      }
      const dark = document.body.hasAttribute('data-ds-dark-theme')
      for (const [name, modes] of Object.entries(tokens)) {
        document.body.style.setProperty(name, dark ? modes.dark : modes.light)
        inlineTokens.push(name)
      }
    }

    /** 覆盖层撤掉后读取"原生"令牌值，落到 --dsh-skin-base-* 上，供覆盖值引用。 */
    function captureBases(names) {
      const computed = getComputedStyle(document.body)
      const captured = {}
      for (const name of names) {
        const value = computed.getPropertyValue(name).trim()
        if (value === '') continue
        captured[name] = value
        document.documentElement.style.setProperty(baseVar(name), value)
      }
      return captured
    }

    function buildTokens(skin, opts) {
      const accent = parseColor(skin.accent ?? '') ?? parseColor(DEFAULT_ACCENT)
      const tokens = {}
      const dark = document.body.hasAttribute('data-ds-dark-theme')
      const base = parseColor(getComputedStyle(document.documentElement).getPropertyValue('--dsh-skin-base-alias-bg-base').trim())

      const veil = num(opts?.veil, 1, 0.3, 1.8)
      const uiRgb = opts?.ui ? hslToRgb(opts.ui.h, opts.ui.s, opts.ui.l) : null
      lastSurfaceAlpha = clamp(0.62 * veil * (dark ? 0.88 : 1.08), 0.05, 0.98)
      for (const [name, alpha, structural] of SURFACE_TOKENS) {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(baseVar(name)).trim()
        const rgb = uiRgb !== null ? uiRgb : parseColor(raw)
        const scale = structural === 's' ? veil * (dark ? 0.88 : 1.08) : 1
        const useAlpha = clamp(alpha * scale, 0.05, 0.98)
        const value = rgb !== null
          ? toRgba(rgb, useAlpha)
          : `color-mix(in srgb, ${raw} ${Math.round(useAlpha * 100)}%, transparent)`
        if (raw !== '') tokens[name] = { light: value, dark: value }
      }

      const accentRgb = parseColor(skin.accent ?? '') ?? accent
      const textSafe = fitLuminance(accentRgb, dark ? 0.42 : 0.26, !dark)
      const fill = fitLuminance(accentRgb, dark ? 0.3 : 0.22, !dark)
      const fillHover = fitLuminance(mix(fill, [255, 255, 255], 0.12), dark ? 0.36 : 0.3, !dark)
      tokens['--dsw-alias-brand-primary'] = { light: toHex(fitLuminance(accentRgb, 0.24, true)), dark: toHex(fitLuminance(accentRgb, 0.46, false)) }
      tokens['--dsw-alias-link'] = { light: toHex(fitLuminance(accentRgb, 0.2, true)), dark: toHex(fitLuminance(accentRgb, 0.5, false)) }
      tokens['--dsw-alias-markdown-citation'] = { light: toHex(fitLuminance(accentRgb, 0.24, true)), dark: toHex(fitLuminance(accentRgb, 0.46, false)) }
      tokens['--dsw-alias-button-primary-fill'] = { light: toHex(fill), dark: toHex(fill) }
      tokens['--dsw-alias-button-primary-hover'] = { light: toHex(fillHover), dark: toHex(fillHover) }
      tokens['--dsw-alias-button-primary-dimmed'] = { light: toRgba(accentRgb, 0.22), dark: toRgba(accentRgb, 0.26) }
      tokens['--dsw-alias-interactive-bg-hover-accent'] = { light: toRgba(accentRgb, 0.16), dark: toRgba(accentRgb, 0.2) }
      tokens['--dsw-alias-button-ghost-active-fill'] = { light: toRgba(accentRgb, 0.14), dark: toRgba(accentRgb, 0.18) }
      tokens['--dsw-alias-button-ghost-active-border'] = { light: toHex(fitLuminance(accentRgb, 0.28, true)), dark: toHex(fitLuminance(accentRgb, 0.44, false)) }
      tokens['--dsw-alias-state-business-primary'] = tokens['--dsw-alias-brand-primary']

      // 用户自定义文字颜色（覆盖主题的 --dsw-alias-label-* 系列）
      if (opts?.text) {
        const t = hslToRgb(opts.text.h, opts.text.s, opts.text.l)
        const put = (name, alpha) => { tokens[name] = { light: alpha >= 1 ? toHex(t) : toRgba(t, alpha), dark: alpha >= 1 ? toHex(t) : toRgba(t, alpha) } }
        put('--dsw-alias-label-primary', 1)
        put('--dsw-alias-label-primary-bluish', 1)
        put('--dsw-alias-label-primary-dimmed', 0.62)
        put('--dsw-alias-label-secondary', 0.82)
        put('--dsw-alias-label-tertiary', 0.64)
        put('--dsw-alias-label-caption', 0.55)
        put('--dsw-alias-label-dimmed', 0.45)
        put('--dsw-alias-markdown-placeholder', 0.5)
        put('--dsw-alias-markdown-code-segment-unselected', 0.6)
      }

      const tintBase = base !== null ? base : (dark ? [24, 24, 26] : [250, 250, 250])
      const canvas = mix(tintBase, accentRgb, dark ? 0.16 : 0.12)
      return { tokens, canvas: toHex(canvas), textSafe: toHex(textSafe) }
    }

    /* ─────────────────────────────── 背景层 ─────────────────────────────── */

    function ensureLayer() {
      if (layer !== null) return layer
      const root = document.createElement('div')
      root.id = 'dsh-skin-layer'
      root.setAttribute('aria-hidden', 'true')
      const media = document.createElement('div')
      media.id = 'dsh-skin-media'
      const video = document.createElement('video')
      video.id = 'dsh-skin-video'
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.setAttribute('playsinline', '')
      video.setAttribute('muted', '')
      const canvas = document.createElement('canvas')
      canvas.id = 'dsh-skin-fx'
      const dim = document.createElement('div')
      dim.id = 'dsh-skin-dim'
      root.append(media, video, canvas, dim)
      document.body.prepend(root)
      layer = { root, media, video, canvas, dim }
      return layer
    }

    function removeLayer() {
      stopEffects()
      if (layer !== null) {
        try { layer.video.pause() } catch { /* 忽略 */ }
        layer.root.remove()
        layer = null
      }
    }

    /* ─────────────────────────── 动态效果（星空/流星） ─────────────────────────── */

    const fx = { raf: 0, canvas: null, ctx: null, stars: [], meteors: [], last: 0, next: 0, cfg: null, w: 0, h: 0, running: false }

    function fxResize() {
      if (fx.canvas === null || fx.ctx === null) return
      const dpr = clamp(window.devicePixelRatio || 1, 1, 2)
      const width = fx.canvas.clientWidth || window.innerWidth
      const height = fx.canvas.clientHeight || window.innerHeight
      fx.w = width
      fx.h = height
      fx.canvas.width = Math.max(1, Math.round(width * dpr))
      fx.canvas.height = Math.max(1, Math.round(height * dpr))
      fx.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      fxSeed()
    }

    function starTint() {
      const palette = (current?.palette ?? []).map(parseColor).filter((rgb) => rgb !== null)
      if (palette.length === 0) return '#ffffff'
      const pick = palette[Math.floor(Math.random() * palette.length)]
      const light = mix(pick, [255, 255, 255], 0.62)
      return toHex(light)
    }

    function fxSeed() {
      const density = num(fx.cfg?.density, 1, 0.2, 3)
      const count = Math.round(clamp((fx.w * fx.h) / 9500 * density, 40, 340))
      const stars = []
      for (let i = 0; i < count; i += 1) {
        stars.push({
          x: Math.random() * fx.w,
          y: Math.random() * fx.h,
          r: 0.4 + Math.random() * 1.5,
          a: 0.22 + Math.random() * 0.68,
          s: 0.4 + Math.random() * 2.6,
          p: Math.random() * Math.PI * 2,
          tint: starTint(),
        })
      }
      fx.stars = stars
    }

    function spawnMeteor() {
      const angle = Math.PI * (0.72 + Math.random() * 0.16)
      const speed = 340 + Math.random() * 420
      const startX = Math.random() * fx.w * 0.9 + fx.w * 0.25
      const startY = -60 - Math.random() * fx.h * 0.25
      return {
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: -Math.sin(angle) * -speed,
        len: 90 + Math.random() * 150,
        life: 900 + Math.random() * 900,
        t: 0,
        a: 0.45 + Math.random() * 0.5,
        tint: starTint(),
      }
    }

    function fxDraw(ts) {
      if (!fx.running) return
      const g = fx.ctx
      if (g === null) return
      const dt = fx.last === 0 ? 16 : clamp(ts - fx.last, 0, 64)
      fx.last = ts
      g.clearRect(0, 0, fx.w, fx.h)
      if (fx.cfg?.stars !== false) {
        for (const star of fx.stars) {
          const twinkle = 0.55 + 0.45 * Math.sin(star.p + ts * 0.001 * star.s)
          g.globalAlpha = clamp(star.a * twinkle, 0, 1)
          g.fillStyle = star.tint
          g.beginPath()
          g.arc(star.x, star.y, star.r, 0, Math.PI * 2)
          g.fill()
        }
      }
      if (fx.cfg?.meteors === true) {
        fx.next -= dt
        if (fx.meteors.length < 5 && fx.next <= 0) {
          fx.next = 1200 + Math.random() * 4600
          fx.meteors.push(spawnMeteor())
        }
      }
      g.globalAlpha = 1
      for (const meteor of fx.meteors.slice()) {
        meteor.t += dt
        meteor.x += meteor.vx * dt
        meteor.y += meteor.vy * dt
        const progress = meteor.t / meteor.life
        const fade = Math.sin(Math.PI * clamp(progress, 0, 1))
        const norm = Math.hypot(meteor.vx, meteor.vy) || 1
        const tailX = meteor.x - (meteor.vx / norm) * meteor.len
        const tailY = meteor.y - (meteor.vy / norm) * meteor.len
        const gradient = g.createLinearGradient(meteor.x, meteor.y, tailX, tailY)
        gradient.addColorStop(0, `rgba(255,255,255,${Number((fade * meteor.a).toFixed(3))})`)
        gradient.addColorStop(0.35, `rgba(${parseInt(meteor.tint.slice(1, 3), 16)},${parseInt(meteor.tint.slice(3, 5), 16)},${parseInt(meteor.tint.slice(5, 7), 16)},${Number((fade * meteor.a * 0.5).toFixed(3))})`)
        gradient.addColorStop(1, 'rgba(255,255,255,0)')
        g.strokeStyle = gradient
        g.lineWidth = 1.6
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(meteor.x, meteor.y)
        g.lineTo(tailX, tailY)
        g.stroke()
        if (progress >= 1 || meteor.x < -200 || meteor.y > fx.h + 200) fx.meteors.splice(fx.meteors.indexOf(meteor), 1)
      }
      fx.raf = window.requestAnimationFrame(fxDraw)
    }

    function startEffects(cfg) {
      stopEffects()
      if (layer === null) return
      if (cfg === null || (cfg.stars === false && cfg.meteors !== true)) {
        layer.canvas.style.opacity = '0'
        return
      }
      const context = layer.canvas.getContext('2d')
      if (context === null) return
      fx.canvas = layer.canvas
      fx.ctx = context
      fx.cfg = cfg
      fx.last = 0
      fx.next = 800 + Math.random() * 2000
      fx.running = true
      fxResize()
      fx.raf = window.requestAnimationFrame(fxDraw)
    }

    function stopEffects() {
      fx.running = false
      if (fx.raf !== 0) {
        window.cancelAnimationFrame(fx.raf)
        fx.raf = 0
      }
      fx.meteors = []
      fx.stars = []
      fx.ctx = null
      fx.canvas = null
    }

    /* ─────────────────────────────── 应用皮肤 ─────────────────────────────── */

    function resolveEffective(skin) {
      const saved = state.perSkin?.[skin.id] ?? {}
      return {
        blur: num(saved.blur, num(skin.blur, 18, 0, 80), 0, 80),
        dim: num(saved.dim, num(skin.dim, 0.3, 0, 0.9), 0, 0.9),
        saturate: num(saved.saturate, num(skin.saturate, 1.05, 0, 3), 0, 3),
        fit: typeof saved.fit === 'string' ? saved.fit : (typeof skin.fit === 'string' ? skin.fit : 'cover'),
        stars: flag(saved.stars, skin.effects?.stars === true),
        meteors: flag(saved.meteors, skin.effects?.meteors === true),
        density: num(saved.density, num(skin.effects?.density, 1, 0.2, 3), 0.2, 3),
        veil: num(saved.veil, 1, 0.3, 1.8),
        text: saved.text && typeof saved.text === 'object'
          ? { h: num(saved.text.h, 0, 0, 360), s: num(saved.text.s, 12, 0, 100), l: num(saved.text.l, 20, 0, 100) }
          : null,
        ui: saved.ui && typeof saved.ui === 'object'
          ? { h: num(saved.ui.h, 0, 0, 360), s: num(saved.ui.s, 10, 0, 100), l: num(saved.ui.l, 92, 0, 100) }
          : null,
      }
    }

    function paintLayer(skin, opts) {
      const root = document.documentElement
      const blur = opts.blur
      root.style.setProperty('--dsh-skin-blur', `${blur}px`)
      root.style.setProperty('--dsh-skin-scale', String(1 + Math.min(0.4, blur / 80)))
      root.style.setProperty('--dsh-skin-sat', String(opts.saturate))
      root.style.setProperty('--dsh-skin-fit', opts.fit === 'contain' ? 'contain' : opts.fit === 'tile' ? 'auto' : 'cover')
      root.style.setProperty('--dsh-skin-dim-color', `rgba(0,0,0,${Number(opts.dim.toFixed(3))})`)
      root.style.setProperty('--dsh-skin-fx', opts.stars || opts.meteors ? '1' : '0')

      const media = layer.media
      const video = layer.video
      if (skin.kind === 'video') {
        if (video.getAttribute('src') !== skin.url) {
          video.setAttribute('src', skin.url)
          video.load()
        }
        video.style.display = 'block'
        media.style.backgroundImage = 'none'
        const play = video.play()
        if (play !== undefined) play.catch(() => {})
      } else {
        try { video.pause() } catch { /* 忽略 */ }
        video.style.display = 'none'
        media.style.backgroundImage = `url("${skin.url}")`
      }
    }

    function applySkin() {
      if (disposed || document.body === null) return
      applying = true
      try {
        const skin = current
        if (skin === null) {
          document.documentElement.removeAttribute('data-dsh-skin')
          disposeTokens()
          removeLayer()
          document.documentElement.style.removeProperty('--dsh-skin-canvas')
          effective = null
          return
        }
        effective = resolveEffective(skin)
        ensureLayer()
        document.documentElement.setAttribute('data-dsh-skin', skin.id)
        disposeTokens()
        const names = SURFACE_TOKENS.map(([name]) => name)
        captureBases(names)
        const built = buildTokens(skin, effective)
        document.documentElement.style.setProperty('--dsh-skin-canvas', built.canvas)
        paintLayer(skin, effective)
        applyTokens(built.tokens)
        startEffects(effective.stars || effective.meteors ? { stars: effective.stars, meteors: effective.meteors, density: effective.density } : null)
      } finally {
        applying = false
      }
    }

    function reapply() {
      if (applying) return
      window.queueMicrotask(() => {
        if (disposed || applying) return
        applySkin()
      })
    }

    /* ───────────────────────────── 主题色提取 ───────────────────────────── */

    function quantize(data, channels) {
      const bins = new Map()
      for (let i = 0; i < data.length; i += channels) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = channels > 3 ? data[i + 3] : 255
        if (a < 200) continue
        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
        let bin = bins.get(key)
        if (bin === undefined) {
          bin = { r: 0, g: 0, b: 0, count: 0 }
          bins.set(key, bin)
        }
        bin.r += r
        bin.g += g
        bin.b += b
        bin.count += 1
      }
      if (bins.size === 0) return null
      const list = [...bins.values()].map((bin) => ({ r: bin.r / bin.count, g: bin.g / bin.count, b: bin.b / bin.count, count: bin.count }))
      list.sort((a, b) => b.count - a.count)
      const hsl = (c) => {
        const R = c.r / 255
        const G = c.g / 255
        const B = c.b / 255
        const max = Math.max(R, G, B)
        const min = Math.min(R, G, B)
        const l = (max + min) / 2
        if (max === min) return [0, 0, l]
        const d = max - min
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        let h
        if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6
        else if (max === G) h = ((B - R) / d + 2) / 6
        else h = ((R - G) / d + 4) / 6
        return [h, s, l]
      }
      const scored = list.map((c) => {
        const [, s, l] = hsl(c)
        return { c, score: Math.log(1 + c.count) * (0.25 + s * 1.6) * Math.max(0.15, 1 - Math.abs(l - 0.52) * 1.35) }
      }).sort((a, b) => b.score - a.score)
      const accent = scored[0]?.c ?? list[0]
      return {
        accent: toHex([accent.r, accent.g, accent.b]),
        palette: list.slice(0, 5).map((c) => toHex([c.r, c.g, c.b])),
      }
    }

    function loadImage(url) {
      return new Promise((done, fail) => {
        const img = new Image()
        img.onload = () => done(img)
        img.onerror = () => fail(new Error(`加载图片失败：${url}`))
        img.src = url
      })
    }

    async function extractPalette(skin) {
      if (skin === null || skin.kind !== 'image') return
      if (typeof skin.accent === 'string' && skin.accent !== '' && Array.isArray(skin.palette) && skin.palette.length > 0) return
      if (paletteTried.has(skin.id)) return
      paletteTried.add(skin.id)
      try {
        const image = await loadImage(skin.url)
        const width = 140
        const height = Math.max(1, Math.round((image.naturalHeight / Math.max(1, image.naturalWidth)) * width))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (context === null) return
        context.drawImage(image, 0, 0, width, height)
        const result = quantize(context.getImageData(0, 0, width, height).data, 4)
        if (result === null) return
        skin.accent = result.accent
        skin.palette = result.palette
        await post('/palette', { id: skin.id, accent: result.accent, palette: result.palette })
        if (current !== null && current.id === skin.id) {
          paletteTried.delete(skin.id)
          applySkin()
          renderGrid()
        }
      } catch {
        /* 图片读不出来就算了，保留默认主题色 */
      }
    }

    /* ───────────────────────────── 面板 UI ───────────────────────────── */

    async function post(path, body) {
      try {
        await fetch(`${API}${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body ?? {}),
        })
      } catch { /* 离线也要能用 */ }
    }

    function saveOverrides() {
      if (current === null || effective === null) return
      const id = current.id
      const payload = {
        blur: effective.blur,
        dim: effective.dim,
        saturate: effective.saturate,
        fit: effective.fit,
        stars: effective.stars,
        meteors: effective.meteors,
        density: effective.density,
        veil: effective.veil,
        text: effective.text ?? null,
        ui: effective.ui ?? null,
      }
      state.perSkin = { ...state.perSkin, [id]: payload }
      window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => { void post('/state', { perSkin: { [id]: payload } }) }, 400)
    }

    async function refresh() {
      try {
        const response = await fetch(`${API}/list`, { cache: 'no-store' })
        const data = await response.json()
        catalog = { dir: typeof data.dir === 'string' ? data.dir : '', skins: Array.isArray(data.skins) ? data.skins : [] }
        state = {
          active: typeof data.state?.active === 'string' ? data.state.active : null,
          perSkin: data.state?.perSkin && typeof data.state.perSkin === 'object' ? data.state.perSkin : {},
        }
      } catch {
        return
      }
      current = catalog.skins.find((skin) => skin.id === state.active) ?? null
      if (current !== null) void extractPalette(current)
      applySkin()
      void sampleMediaAverage(current)
      renderGrid()
      syncControls()
      updateHint()
    }

    async function choose(id) {
      if (id === 'default') {
        state.active = null
        current = null
        await post('/state', { active: null })
      } else {
        const skin = catalog.skins.find((entry) => entry.id === id) ?? null
        if (skin === null) return
        state.active = id
        current = skin
        await post('/state', { active: id })
        void extractPalette(skin)
      }
      applySkin()
      renderGrid()
      syncControls()
      updateHint()
    }

    function updateHint() {
      if (ui === null) return
      const dir = catalog.dir === '' ? '（未知路径）' : catalog.dir
      ui.hint.textContent = `${dir}　·　共 ${catalog.skins.length} 个皮肤`
    }

    function markSelected() {
      if (ui === null) return
      const activeId = current === null ? 'default' : current.id
      for (const node of ui.grid.querySelectorAll('.sk-card')) {
        node.dataset.selected = node.dataset.skinId === activeId ? '1' : '0'
      }
    }

    /** 视频皮肤没有自带缩略图时的回退：用 <video> 静帧，鼠标悬停才播放。 */
    function makeVideoThumb(skin) {
      const video = document.createElement('video')
      video.src = skin.url
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.preload = 'metadata'
      video.addEventListener('mouseenter', () => { const play = video.play(); if (play !== undefined) play.catch(() => {}) })
      video.addEventListener('mouseleave', () => video.pause())
      return video
    }

    function makeCard(skin) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'sk-card'
      card.dataset.skinId = skin.id
      const thumb = document.createElement('span')
      thumb.className = 'sk-thumb'
      if (skin.id === 'default') {
        thumb.classList.add('sk-plain')
        thumb.textContent = '⟲'
      } else {
        // 先试皮肤自带的缩略图（视频皮肤没有 sharp 抽帧，靠文件夹里的 thumb.jpg / preview.jpg）
        const img = document.createElement('img')
        img.loading = 'lazy'
        img.alt = ''
        img.src = `${API}/thumb/${encodeURIComponent(skin.id)}`
        img.addEventListener('error', () => {
          if (skin.kind === 'video') {
            const video = makeVideoThumb(skin)
            if (img.parentNode !== null) img.parentNode.replaceChild(video, img)
            return
          }
          if (img.src !== skin.url) img.src = skin.url
        })
        thumb.appendChild(img)
      }
      if (skin.type === 'dynamic' || skin.effects?.stars === true || skin.effects?.meteors === true) {
        const badge = document.createElement('span')
        badge.className = 'sk-badge'
        badge.textContent = '动态'
        thumb.appendChild(badge)
      }
      const name = document.createElement('span')
      name.className = 'sk-name'
      name.textContent = skin.name
      card.append(thumb, name)
      card.addEventListener('click', () => { void choose(skin.id) })
      return card
    }

    function renderGrid() {
      if (ui === null) return
      ui.grid.textContent = ''
      ui.grid.appendChild(makeCard({ id: 'default', name: '原始皮肤', kind: 'none' }))
      for (const skin of catalog.skins) ui.grid.appendChild(makeCard(skin))
      markSelected()
    }

    function syncControls() {
      if (ui === null) return
      const on = current !== null && effective !== null
      for (const row of ui.panel.querySelectorAll('.sk-row')) row.dataset.disabled = on ? '0' : '1'
      for (const chip of ui.panel.querySelectorAll('.sk-chip')) chip.disabled = !on
      if (!on) {
        ui.chips.forEach((chip) => { chip.dataset.on = '0' })
        return
      }
      ui.blur.value = String(Math.round(effective.blur))
      ui.blurOut.textContent = `${Math.round(effective.blur)}px`
      ui.dim.value = String(Math.round(effective.dim * 100))
      ui.dimOut.textContent = `${Math.round(effective.dim * 100)}%`
      ui.sat.value = String(Math.round(effective.saturate * 100))
      ui.satOut.textContent = `${Math.round(effective.saturate * 100)}%`
      ui.veil.value = String(Math.round(clamp(2 - num(effective.veil, 1, 0.3, 1.8), 0.2, 1.7) * 100))
      ui.veilOut.textContent = `${ui.veil.value}%`
      ui.stars.dataset.on = effective.stars ? '1' : '0'
      ui.meteors.dataset.on = effective.meteors ? '1' : '0'
      ui.stars.disabled = !on
      ui.meteors.disabled = !on
      const textHsl = effective?.text ?? themeTextHsl()
      const uiHsl = effective?.ui ?? themeUiHsl()
      ui.textH.value = String(Math.round(textHsl.h))
      ui.textOut.textContent = Math.round(textHsl.h) + String.fromCharCode(176)
      ui.textL.value = String(Math.round(textHsl.l))
      ui.textOut2.textContent = Math.round(textHsl.l) + "%"
      ui.textS.value = String(Math.round(textHsl.s))
      ui.textOut3.textContent = Math.round(textHsl.s) + "%"
      ui.uiH.value = String(Math.round(uiHsl.h))
      ui.uiOut.textContent = Math.round(uiHsl.h) + String.fromCharCode(176)
      ui.uiL.value = String(Math.round(uiHsl.l))
      ui.uiOut2.textContent = Math.round(uiHsl.l) + "%"
      ui.uiS.value = String(Math.round(uiHsl.s))
      ui.uiOut3.textContent = Math.round(uiHsl.s) + "%"
      updateContrastReadout()
    }

    function updateLive(key, value) {
      if (effective === null || layer === null) return
      effective[key] = value
      // 先把改动写进 state.perSkin，再重算：applySkin 会从 state 重新解析参数，
      // 顺序反了就会把刚拖动的值丢掉。
      saveOverrides()
      if (key === 'stars' || key === 'meteors') {
        paintLayer(current, effective)
        startEffects(effective.stars || effective.meteors ? { stars: effective.stars, meteors: effective.meteors, density: effective.density } : null)
      } else if (key === 'veil' || key === 'text' || key === 'ui') {
        applySkin()
      } else {
        paintLayer(current, effective)
      }
    }

    /* 配色微调：文字色 / 界面色 / 对比度自检 */

    function themeTextHsl() {
      const rgb = parseColor(getComputedStyle(document.body).getPropertyValue('--dsw-alias-label-primary')) ?? [24, 24, 26]
      return rgbToHsl(rgb)
    }

    function themeUiHsl() {
      const rgb = parseColor(getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-layer-1')) ?? [255, 255, 255]
      return rgbToHsl(rgb)
    }

    function averageOf(data) {
      let r = 0, g = 0, b = 0, n = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 8) continue
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1
      }
      return n === 0 ? null : [r / n, g / n, b / n]
    }

    function sampleTo(source) {
      const canvas = document.createElement('canvas')
      canvas.width = 32
      canvas.height = 18
      const context = canvas.getContext('2d')
      context.drawImage(source, 0, 0, 32, 18)
      return averageOf(context.getImageData(0, 0, 32, 18).data)
    }

    async function sampleMediaAverage(skin) {
      mediaAverage = null
      if (skin === null) { updateContrastReadout(); return }
      try {
        if (skin.kind === 'video') {
          const el = layer === null ? null : layer.video
          if (el === null || el.videoWidth === 0 || el.readyState < 2) { updateContrastReadout(); return }
          mediaAverage = sampleTo(el)
        } else {
          const image = await loadImage(skin.url)
          mediaAverage = sampleTo(image)
        }
      } catch { mediaAverage = null }
      updateContrastReadout()
    }

    /* 对比度自检：文字色 vs 面板压背景后的实际底色 */
    function updateContrastReadout() {
      if (ui === null || ui.ratio === undefined) return
      const bodyStyle = getComputedStyle(document.body)
      const textRgb = effective?.text
        ? hslToRgb(effective.text.h, effective.text.s, effective.text.l)
        : (parseColor(bodyStyle.getPropertyValue('--dsw-alias-label-primary')) ?? [24, 24, 26])
      const uiRgb = effective?.ui
        ? hslToRgb(effective.ui.h, effective.ui.s, effective.ui.l)
        : (parseColor(bodyStyle.getPropertyValue('--dsw-alias-bg-layer-1')) ?? [255, 255, 255])
      const alpha = clamp(lastSurfaceAlpha, 0.05, 0.98)
      const bg = mediaAverage === null ? uiRgb : mix(uiRgb, mediaAverage, 1 - alpha)
      const ratio = contrastRatio(textRgb, bg)
      ui.ratio.textContent = ratio.toFixed(1) + ':1'
      ui.ratio.dataset.level = ratio >= 4.5 ? 'good' : ratio >= 3 ? 'ok' : 'bad'
      ui.textSwatch.style.background = toHex(textRgb)
      ui.bgSwatch.style.background = toHex(bg)
    }

    function buildUi() {
      if (ui !== null || document.getElementById('dsh-skin-fab') !== null) return
      const fab = document.createElement('button')
      fab.id = 'dsh-skin-fab'
      fab.type = 'button'
      fab.title = '界面皮肤'
      fab.textContent = '🎨'
      const panel = document.createElement('section')
      panel.id = 'dsh-skin-panel'
      panel.hidden = true
      panel.innerHTML = `
        <div class="sk-head">
          <span class="sk-title">界面皮肤</span>
          <button class="sk-icon" data-act="folder" title="打开皮肤文件夹">📁</button>
          <button class="sk-icon" data-act="rescan" title="刷新皮肤列表">⟳</button>
          <button class="sk-icon" data-act="close" title="收起">✕</button>
        </div>
        <div class="sk-grid"></div>
        <div class="sk-row"><span>虚化</span><input type="range" data-ctl="blur" min="0" max="60" step="1"><output>18px</output></div>
        <div class="sk-row"><span>暗化</span><input type="range" data-ctl="dim" min="0" max="85" step="1"><output>30%</output></div>
        <div class="sk-row"><span>饱和</span><input type="range" data-ctl="sat" min="0" max="200" step="1"><output>105%</output></div>
        <div class="sk-row"><span>通透</span><input type="range" data-ctl="veil" min="30" max="180" step="1"><output>100%</output></div>
        <div class="sk-chips">
          <button class="sk-chip" data-toggle="stars">星空闪烁</button>
          <button class="sk-chip" data-toggle="meteors">流星</button>
        </div>
        <div class="sk-sep"></div>
        <div class="sk-row"><span>文字色</span><input class="sk-hue" type="range" data-ctl="text-h" min="0" max="360" step="1"><output>0</output></div>
        <div class="sk-row"><span>文字亮</span><input type="range" data-ctl="text-l" min="0" max="100" step="1"><output>0%</output></div>
        <div class="sk-row"><span>文字彩</span><input type="range" data-ctl="text-s" min="0" max="100" step="1"><output>0%</output></div>
        <div class="sk-row"><span>界面色</span><input class="sk-hue" type="range" data-ctl="ui-h" min="0" max="360" step="1"><output>0</output></div>
        <div class="sk-row"><span>界面亮</span><input type="range" data-ctl="ui-l" min="0" max="100" step="1"><output>0%</output></div>
        <div class="sk-row"><span>界面彩</span><input type="range" data-ctl="ui-s" min="0" max="100" step="1"><output>0%</output></div>
        <div class="sk-chips">
          <button class="sk-chip" data-preset="auto">自动配色</button>
          <button class="sk-chip" data-preset="dark">深底浅字</button>
          <button class="sk-chip" data-preset="light">浅底深字</button>
        </div>
        <div class="sk-note">文字 <i class="sk-sw" data-sw="text"></i> 压在面板 <i class="sk-sw" data-sw="bg"></i> 上：对比度 <b class="sk-ratio" data-level="good">-</b>（≥4.5 舒适，&lt;3 会看不清）</div>
        <div class="sk-foot"></div>
      `
      document.body.append(fab, panel)

      const grid = panel.querySelector('.sk-grid')
      const textH = panel.querySelector('input[data-ctl="text-h"]')
      const textL = panel.querySelector('input[data-ctl="text-l"]')
      const uiH = panel.querySelector('input[data-ctl="ui-h"]')
      const uiL = panel.querySelector('input[data-ctl="ui-l"]')
      const textS = panel.querySelector('input[data-ctl="text-s"]')
      const uiS = panel.querySelector('input[data-ctl="ui-s"]')
      const ratio = panel.querySelector('.sk-ratio')
      const swText = panel.querySelector('.sk-sw[data-sw="text"]')
      const swBg = panel.querySelector('.sk-sw[data-sw="bg"]')
      const hint = panel.querySelector('.sk-foot')
      const blur = panel.querySelector('input[data-ctl="blur"]')
      const dim = panel.querySelector('input[data-ctl="dim"]')
      const sat = panel.querySelector('input[data-ctl="sat"]')
      const veil = panel.querySelector('input[data-ctl="veil"]')
      const stars = panel.querySelector('[data-toggle="stars"]')
      const meteors = panel.querySelector('[data-toggle="meteors"]')
      ui = {
        fab,
        panel,
        grid,
        hint,
        blur,
        blurOut: blur.nextElementSibling,
        dim,
        dimOut: dim.nextElementSibling,
        sat,
        satOut: sat.nextElementSibling,
        veil,
        veilOut: veil.nextElementSibling,
        stars,
        meteors,
        chips: [stars, meteors],
        textH,
        textOut: textH.nextElementSibling,
        textL,
        textOut2: textL.nextElementSibling,
        textS,
        textOut3: textS.nextElementSibling,
        uiH,
        uiOut: uiH.nextElementSibling,
        uiL,
        uiOut2: uiL.nextElementSibling,
        uiS,
        uiOut3: uiS.nextElementSibling,
        ratio,
        textSwatch: swText,
        bgSwatch: swBg,
      }

      fab.addEventListener('click', () => {
        panel.hidden = !panel.hidden
        fab.dataset.open = panel.hidden ? '0' : '1'
        if (!panel.hidden) { void refresh(); void sampleMediaAverage(current) }
      })
      panel.querySelector('[data-act="close"]').addEventListener('click', () => {
        panel.hidden = true
        fab.dataset.open = '0'
      })
      panel.querySelector('[data-act="folder"]').addEventListener('click', () => { void post('/open') })
      panel.querySelector('[data-act="rescan"]').addEventListener('click', () => { void refresh() })
      blur.addEventListener('input', () => {
        ui.blurOut.textContent = `${blur.value}px`
        updateLive('blur', num(blur.value, 18, 0, 80))
      })
      dim.addEventListener('input', () => {
        ui.dimOut.textContent = `${dim.value}%`
        updateLive('dim', num(dim.value, 30, 0, 90) / 100)
      })
      sat.addEventListener('input', () => {
        ui.satOut.textContent = `${sat.value}%`
        updateLive('saturate', num(sat.value, 105, 0, 300) / 100)
      })
      veil.addEventListener('input', () => {
        ui.veilOut.textContent = `${veil.value}%`
        updateLive('veil', clamp(2 - num(veil.value, 100, 30, 180) / 100, 0.3, 1.8))
      })
      stars.addEventListener('click', () => { updateLive('stars', !(effective?.stars === true)) })
      meteors.addEventListener('click', () => { updateLive('meteors', !(effective?.meteors === true)) })
      textH.addEventListener('input', () => {
        const cur = effective?.text ?? themeTextHsl()
        updateLive('text', { h: num(textH.value, cur.h, 0, 360), s: Math.max(cur.s, 32), l: clamp(cur.l, 25, 82) })
        syncControls()
      })
      textL.addEventListener('input', () => {
        const cur = effective?.text ?? themeTextHsl()
        updateLive('text', { h: cur.h, s: cur.s, l: num(textL.value, cur.l, 0, 100) })
        syncControls()
      })
      textS.addEventListener('input', () => {
        const cur = effective?.text ?? themeTextHsl()
        updateLive('text', { h: cur.h, s: num(textS.value, cur.s, 0, 100), l: cur.l })
        syncControls()
      })
      uiS.addEventListener('input', () => {
        const cur = effective?.ui ?? themeUiHsl()
        updateLive('ui', { h: cur.h, s: num(uiS.value, cur.s, 0, 100), l: cur.l })
        syncControls()
      })
      uiH.addEventListener('input', () => {
        const cur = effective?.ui ?? themeUiHsl()
        updateLive('ui', { h: num(uiH.value, cur.h, 0, 360), s: Math.max(cur.s, 22), l: clamp(cur.l, 12, 88) })
        syncControls()
      })
      uiL.addEventListener('input', () => {
        const cur = effective?.ui ?? themeUiHsl()
        updateLive('ui', { h: cur.h, s: cur.s, l: num(uiL.value, cur.l, 0, 100) })
        syncControls()
      })
      panel.querySelector('[data-preset="auto"]').addEventListener('click', () => {
        updateLive('text', null)
        updateLive('ui', null)
        syncControls()
      })
      panel.querySelector('[data-preset="dark"]').addEventListener('click', () => {
        updateLive('ui', { h: (effective?.ui ?? themeUiHsl()).h, s: 12, l: 10 })
        updateLive('text', { h: (effective?.text ?? themeTextHsl()).h, s: 8, l: 96 })
        updateLive('veil', clamp(Math.max(effective?.veil ?? 1, 1.15), 0.3, 1.8))
        syncControls()
      })
      panel.querySelector('[data-preset="light"]').addEventListener('click', () => {
        updateLive('ui', { h: (effective?.ui ?? themeUiHsl()).h, s: 10, l: 93 })
        updateLive('text', { h: (effective?.text ?? themeTextHsl()).h, s: 10, l: 12 })
        updateLive('veil', clamp(Math.max(effective?.veil ?? 1, 1.15), 0.3, 1.8))
        syncControls()
      })
      window.addEventListener('resize', () => { if (fx.running) fxResize() })
      document.addEventListener('visibilitychange', () => {
        const paused = document.hidden
        if (layer === null || layer.video === null) return
        try {
          if (paused) layer.video.pause()
          else if (current?.kind === 'video') { const play = layer.video.play(); if (play !== undefined) play.catch(() => {}) }
        } catch { /* 忽略 */ }
      })
    }

    /* ───────────────────────────── 插件入口 ───────────────────────────── */

    function teardown() {
      disposed = true
      window.clearInterval(pollTimer)
      window.clearTimeout(saveTimer)
      disposeTokens()
      removeLayer()
      document.documentElement.removeAttribute('data-dsh-skin')
      for (const name of ['--dsh-skin-blur', '--dsh-skin-scale', '--dsh-skin-sat', '--dsh-skin-fit', '--dsh-skin-dim-color', '--dsh-skin-fx', '--dsh-skin-canvas']) {
        document.documentElement.style.removeProperty(name)
      }
      if (ui !== null) {
        ui.fab.remove()
        ui.panel.remove()
        ui = null
      }
      const tag = document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`)
      if (tag !== null) tag.remove()
    }

    function boot() {
      if (typeof document === 'undefined' || document.body === null) return
      installStyles()
      buildUi()
      void refresh()
      pollTimer = window.setInterval(() => {
        if (document.hidden) return
        void (async () => {
          try {
            const response = await fetch(`${API}/state`, { cache: 'no-store' })
            const data = await response.json()
            const active = typeof data.state?.active === 'string' ? data.state.active : null
            if (active !== state.active) void refresh()
          } catch { /* 忽略 */ }
        })()
      }, 12000)
    }

    function apply(ctx) {
      ctxRef = ctx
      if (typeof document === 'undefined') return
      ctx.effect(() => () => teardown(), `${PLUGIN_ID}: 清理背景层与面板`)
      if (ctxRef !== null && typeof ctxRef.on === 'function') ctx.on('theme/change', () => { reapply() })
      if (document.body !== null) boot()
      else document.addEventListener('DOMContentLoaded', boot, { once: true })
    }

    exports.apply = apply
    exports.inject = []
    exports.name = PLUGIN_ID
    exports.reusable = false
    return exports
  },
})
