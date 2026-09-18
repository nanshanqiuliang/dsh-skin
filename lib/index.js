/**
 * dsh-skin 宿主半边（Node 侧）。
 *
 * 职责：
 *  - 维护本地皮肤文件夹 <DSH_HOME>/skins（自动建目录 + 说明文件）；
 *  - 用 HTTP 把皮肤文件、缩略图、皮肤清单、界面状态暴露给浏览器半边；
 *  - 给模型注册工具：一键从图片生成皮肤、列出/切换/删除皮肤、在资源管理器里打开皮肤文件夹。
 *
 * 浏览器半边在同包的 lib/client.js，由 @deepseek-ai/dsh-client-modules 依据
 * package.json 的 dsh.client 声明扫描并注入。
 */
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'
import { spawn } from 'node:child_process'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'skin'
export const inject = ['tools', 'webServer']

const PLUGIN = 'dsh-skin'
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp', '.svg'])
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.m4v', '.ogv'])
const MEDIA_EXT = new Set([...IMAGE_EXT, ...VIDEO_EXT])
const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.bmp': 'image/bmp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/x-m4v',
  '.ogv': 'video/ogg',
}
const README_TEXT = `dsh 界面皮肤文件夹
==================

把皮肤素材直接放进这个文件夹即可，支持两种放法：

1) 松散文件（最简单）
   skins/我的壁纸.png
   skins/夜空.mp4
   插件会把它当成一个皮肤，皮肤 id = 文件名。

2) 带清单的文件夹（能写更多参数）
   skins/<id>/skin.json
   skins/<id>/background.png   (或 .jpg/.webp/.gif/.mp4/.webm ...)

skin.json 支持的字段（全部可选，缺省即默认值）：
{
  "name": "显示名",
  "type": "static" | "dynamic",
  "file": "background.png",
  "blur": 18,          // 背景虚化像素
  "dim": 0.3,          // 背景暗化 0~1
  "saturate": 1.05,    // 背景饱和度
  "accent": "#7c5cff", // 主题色（不填则自动从图片提取）
  "effects": { "stars": true, "meteors": true, "density": 1 }
}

从图片提取出的主题色会写回 skin.json 的 accent / palette 字段。
删除 skin.json 即可回到自动模式。
`

const skinsDir = () => dshHomePath('skins')
const statePath = () => join(skinsDir(), 'state.json')

function ensureDir() {
  const dir = skinsDir()
  mkdirSync(dir, { recursive: true })
  const readme = join(dir, 'README.txt')
  if (!existsSync(readme)) writeFileSync(readme, README_TEXT, 'utf8')
  return dir
}

function readJson(file, fallback = null) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return fallback }
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function safeId(raw) {
  const id = String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9_\u4e00-\u9fa5-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
  if (id === '') throw new Error('皮肤 id 无效：请使用字母、数字、-、_ 或中文')
  return id
}

function safeJoin(root, rel) {
  const base = resolve(root)
  const target = resolve(root, rel)
  if (target !== base && !target.startsWith(base + sep)) throw new Error(`路径越界：${rel}`)
  return target
}

function mediaKind(file) {
  return VIDEO_EXT.has(extname(file).toLowerCase()) ? 'video' : 'image'
}

function firstMedia(dir) {
  let found = null
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    if (!MEDIA_EXT.has(extname(entry.name).toLowerCase())) continue
    if (entry.name.toLowerCase().startsWith('background')) return entry.name
    if (found === null) found = entry.name
  }
  return found
}

function normalizeSkin(meta, fallback) {
  const id = safeId(meta.id ?? fallback.id)
  return {
    id,
    name: String(meta.name ?? fallback.name ?? id),
    kind: mediaKind(fallback.file),
    file: fallback.file,
    scope: fallback.scope ?? '',
    blur: Number.isFinite(meta.blur) ? Number(meta.blur) : 18,
    dim: Number.isFinite(meta.dim) ? Number(meta.dim) : 0.3,
    saturate: Number.isFinite(meta.saturate) ? Number(meta.saturate) : 1.05,
    fit: typeof meta.fit === 'string' ? meta.fit : 'cover',
    type: meta.type === 'dynamic' ? 'dynamic' : 'static',
    accent: typeof meta.accent === 'string' ? meta.accent : null,
    palette: Array.isArray(meta.palette) ? meta.palette.filter((v) => typeof v === 'string') : [],
    effects: {
      stars: meta.effects?.stars === true,
      meteors: meta.effects?.meteors === true,
      density: Number.isFinite(meta.effects?.density) ? Number(meta.effects.density) : 1,
    },
    createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : null,
  }
}

/** 列出全部皮肤：文件夹式（skin.json 或裸媒体文件）与根目录松散文件都支持。 */
function listSkins() {
  const dir = ensureDir()
  const skins = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    if (entry.name === 'state.json' || entry.name === 'README.txt') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      const media = firstMedia(full)
      const meta = readJson(join(full, 'skin.json'), {}) ?? {}
      let file = media
      if (typeof meta.file === 'string') {
        try { if (existsSync(safeJoin(full, meta.file))) file = meta.file } catch { /* 忽略越界清单 */ }
      }
      if (file === null) continue
      skins.push(normalizeSkin(meta, { id: entry.name, name: entry.name, file, scope: entry.name }))
    } else if (entry.isFile() && MEDIA_EXT.has(extname(entry.name).toLowerCase())) {
      const id = basename(entry.name, extname(entry.name))
      const meta = readJson(join(dir, `${id}.json`), {}) ?? {}
      skins.push(normalizeSkin(meta, { id, name: id, file: entry.name, scope: '' }))
    }
  }
  skins.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  return skins
}

function readState() {
  const raw = readJson(statePath(), null)
  return {
    active: typeof raw?.active === 'string' ? raw.active : null,
    perSkin: raw?.perSkin && typeof raw.perSkin === 'object' ? raw.perSkin : {},
  }
}

function writeState(patch) {
  const current = readState()
  const next = {
    active: patch.active === undefined ? current.active : (patch.active === null ? null : String(patch.active)),
    perSkin: patch.perSkin && typeof patch.perSkin === 'object' ? { ...current.perSkin, ...patch.perSkin } : current.perSkin,
  }
  writeJson(statePath(), next)
  return next
}

function mediaPath(skin) {
  return skin.scope === '' ? join(skinsDir(), skin.file) : join(skinsDir(), skin.scope, skin.file)
}

function publicSkin(skin) {
  const rel = skin.scope === '' ? skin.file : `${skin.scope}/${skin.file}`
  return {
    id: skin.id,
    name: skin.name,
    kind: skin.kind,
    type: skin.type,
    blur: skin.blur,
    dim: skin.dim,
    saturate: skin.saturate,
    fit: skin.fit,
    accent: skin.accent,
    palette: skin.palette,
    effects: skin.effects,
    url: `/skin-files/${rel.split('/').map(encodeURIComponent).join('/')}`,
  }
}

/* ─────────────────────────── 图片分析（sharp 可选） ─────────────────────────── */

function rgbToHex(r, g, b) {
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function rgbToHsl(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255
  const max = Math.max(R, G, B), min = Math.min(R, G, B)
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

/** 从图片量化出主色板与一个"主题色"（偏鲜艳、中等明度的色相）。 */
async function analyzeImage(file) {
  let sharp
  try { sharp = (await import('sharp')).default } catch { return null }
  const { data, info } = await sharp(file, { failOn: 'none', animated: false })
    .rotate()
    .resize(160, 160, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const bins = new Map()
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const a = info.channels > 3 ? data[i + 3] : 255
    if (a < 200) continue
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    let bin = bins.get(key)
    if (bin === undefined) { bin = { r: 0, g: 0, b: 0, count: 0 }; bins.set(key, bin) }
    bin.r += r; bin.g += g; bin.b += b; bin.count += 1
  }
  if (bins.size === 0) return null
  const list = [...bins.values()].map((bin) => ({ r: bin.r / bin.count, g: bin.g / bin.count, b: bin.b / bin.count, count: bin.count }))
  list.sort((a, b) => b.count - a.count)
  const scored = list.map((c) => {
    const [, s, l] = rgbToHsl(c.r, c.g, c.b)
    const weight = Math.log(1 + c.count)
    return { c, score: weight * (0.25 + s * 1.6) * Math.max(0.15, 1 - Math.abs(l - 0.52) * 1.35) }
  }).sort((a, b) => b.score - a.score)
  const accent = scored[0]?.c ?? list[0]
  return {
    palette: list.slice(0, 5).map((c) => rgbToHex(c.r, c.g, c.b)),
    accent: rgbToHex(accent.r, accent.g, accent.b),
  }
}

/* ───────────────────────────── HTTP 接口 ───────────────────────────── */

function sendJson(res, value, status = 200) {
  const body = Buffer.from(`${JSON.stringify(value)}\n`, 'utf8')
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': body.length, 'cache-control': 'no-store' })
  res.end(body)
}

function readBody(req, limit = 1024 * 256) {
  return new Promise((done, fail) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) { fail(new Error('请求体过大')); req.destroy(); return }
      chunks.push(chunk)
    })
    req.on('error', fail)
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (raw === '') { done({}); return }
      try { done(JSON.parse(raw)) } catch { fail(new Error('请求体不是合法 JSON')) }
    })
  })
}

function openInFileManager(target) {
  const platform = process.platform
  const command = platform === 'win32' ? 'explorer.exe' : platform === 'darwin' ? 'open' : 'xdg-open'
  const child = spawn(command, [target], { detached: true, stdio: 'ignore' })
  child.on('error', () => {})
  child.unref()
}

const thumbs = new Map()

async function thumbnail(file) {
  let stamp = 0
  try { stamp = statSync(file).mtimeMs } catch { return null }
  const key = `${file}:${stamp}`
  const cached = thumbs.get(key)
  if (cached !== undefined) return cached
  let sharp
  try { sharp = (await import('sharp')).default } catch { return null }
  const body = await sharp(file, { failOn: 'none', animated: false })
    .resize(512, 288, { fit: 'cover', position: 'attention' })
    .webp({ quality: 72 })
    .toBuffer()
  if (thumbs.size > 64) thumbs.clear()
  const record = { body, type: 'image/webp' }
  thumbs.set(key, record)
  return record
}

/** 把文件流安全地接到响应上：客户端中途断开时销毁读流，避免文件句柄泄漏（Windows 上会锁住文件）。 */
function pipeFile(target, res, options) {
  const stream = options === undefined ? createReadStream(target) : createReadStream(target, options)
  const abort = () => stream.destroy()
  res.on('close', abort)
  stream.on('error', () => { try { res.destroy() } catch { /* 忽略 */ } })
  stream.on('close', () => res.off('close', abort))
  stream.pipe(res)
}

async function serveMedia(req, res, rel) {
  let target
  try { target = safeJoin(ensureDir(), decodeURIComponent(rel.replace(/^\/+/, ''))) } catch { res.writeHead(400); res.end(); return }
  let stat
  try { stat = statSync(target) } catch { res.writeHead(404); res.end(); return }
  if (!stat.isFile()) { res.writeHead(404); res.end(); return }
  const type = MIME[extname(target).toLowerCase()] ?? 'application/octet-stream'
  const range = req.headers.range
  if (typeof range === 'string' && /^bytes=\d*-\d*$/.test(range)) {
    const [startRaw, endRaw] = range.slice(6).split('-')
    const start = startRaw === '' ? Math.max(0, stat.size - Number(endRaw)) : Number(startRaw)
    const end = endRaw === '' || startRaw === '' ? stat.size - 1 : Math.min(Number(endRaw), stat.size - 1)
    if (start > end || start >= stat.size) {
      res.writeHead(416, { 'content-range': `bytes */${stat.size}` })
      res.end()
      return
    }
    res.writeHead(206, {
      'content-type': type,
      'content-length': end - start + 1,
      'content-range': `bytes ${start}-${end}/${stat.size}`,
      'accept-ranges': 'bytes',
      'cache-control': 'no-cache',
    })
    pipeFile(target, res, { start, end })
    return
  }
  res.writeHead(200, { 'content-type': type, 'content-length': stat.size, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' })
  pipeFile(target, res)
}

/* ───────────────────────────── 插件本体 ───────────────────────────── */

export function apply(ctx, _config) {
  ensureDir()
  ctx.logger?.info?.(`${PLUGIN}: 皮肤文件夹 ${skinsDir()}`)

  const disposeFiles = ctx.webServer.register({
    kind: 'prefix',
    path: '/skin-files',
    handler: (req, res) => serveMedia(req, res, new URL(req.url ?? '/', 'http://dsh.local').pathname.slice('/skin-files'.length)),
  })
  ctx.effect(() => disposeFiles, `${PLUGIN}: /skin-files route`)

  const disposeApi = ctx.webServer.register({
    kind: 'prefix',
    path: '/skin-api',
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://dsh.local')
      const route = url.pathname.slice('/skin-api'.length).replace(/\/+$/, '') || '/'
      try {
        if (route === '/list' && req.method === 'GET') {
          sendJson(res, { ok: true, dir: skinsDir(), skins: listSkins().map(publicSkin), state: readState() })
          return
        }
        if (route === '/state') {
          if (req.method === 'GET') { sendJson(res, { ok: true, state: readState() }); return }
          if (req.method === 'POST') { sendJson(res, { ok: true, state: writeState(await readBody(req)) }); return }
        }
        if (route === '/open' && req.method === 'POST') {
          openInFileManager(skinsDir())
          sendJson(res, { ok: true, dir: skinsDir() })
          return
        }
        if (route === '/palette' && req.method === 'POST') {
          const body = await readBody(req)
          const id = safeId(body.id)
          const skin = listSkins().find((entry) => entry.id === id)
          if (skin === undefined) { sendJson(res, { ok: false, error: '皮肤不存在' }, 404); return }
          const manifest = skin.scope === '' ? join(skinsDir(), `${skin.id}.json`) : join(skinsDir(), skin.scope, 'skin.json')
          const meta = readJson(manifest, {}) ?? {}
          const accent = typeof body.accent === 'string' ? body.accent : meta.accent
          const palette = Array.isArray(body.palette) ? body.palette.filter((v) => typeof v === 'string') : meta.palette
          writeJson(manifest, { ...meta, id: skin.id, name: skin.name, file: skin.file, accent, palette })
          sendJson(res, { ok: true, id, accent, palette })
          return
        }
        if (route.startsWith('/thumb/') && req.method === 'GET') {
          const id = safeId(decodeURIComponent(route.slice('/thumb/'.length)))
          const skin = listSkins().find((entry) => entry.id === id)
          if (skin === undefined) { res.writeHead(404); res.end(); return }
          // 皮肤文件夹里自带的缩略图优先（视频类型尤其需要，因为没法用 sharp 抽帧）
          const ownDir = skin.scope === '' ? skinsDir() : join(skinsDir(), skin.scope)
          const ownName = ['thumb.jpg', 'thumb.jpeg', 'thumb.png', 'thumb.webp', 'preview.jpg', 'preview.png', 'poster.jpg']
            .find((candidate) => existsSync(join(ownDir, candidate)))
          if (ownName !== undefined) {
            await serveMedia(req, res, '/' + (skin.scope === '' ? ownName : skin.scope + '/' + ownName))
            return
          }
          if (skin.kind === 'video') { res.writeHead(404); res.end(); return }
          const record = await thumbnail(mediaPath(skin))
          if (record === null) { res.writeHead(415); res.end(); return }
          res.writeHead(200, { 'content-type': record.type, 'content-length': record.body.length, 'cache-control': 'no-cache' })
          res.end(record.body)
          return
        }
        sendJson(res, { ok: false, error: `未知接口 ${route}` }, 404)
      } catch (error) {
        sendJson(res, { ok: false, error: error instanceof Error ? error.message : String(error) }, 400)
      }
    },
  })
  ctx.effect(() => disposeApi, `${PLUGIN}: /skin-api route`)

  /* ── 模型工具 ── */

  const skinSummary = (skin) => ({
    id: skin.id,
    name: skin.name,
    kind: skin.kind,
    type: skin.type,
    accent: skin.accent,
    blur: skin.blur,
    dim: skin.dim,
    stars: skin.effects.stars,
    meteors: skin.effects.meteors,
    url: publicSkin(skin).url,
  })

  const nullableString = { oneOf: [{ type: 'string' }, { type: 'null' }] }

  ctx.tools.register(defineTool({
    name: 'skin_list',
    description: '列出 dsh 本地皮肤文件夹里现有的界面皮肤以及当前启用的皮肤。 skins[] 每项包含 id/name/kind(image|video)/type(static|dynamic)/accent/blur/dim/stars/meteors/url。',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          dir: { type: 'string', required: true },
          active: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
          skins: { type: 'array', required: true, items: { type: 'json' } },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `皮肤文件夹：${value.dir}\n当前：${value.active ?? '原始皮肤'}\n共 ${value.skins.length} 个：${value.skins.map((s) => `${s.id}(${s.name}${s.type === 'dynamic' ? '·动态' : ''}${s.accent ? ` ${s.accent}` : ''})`).join('、') || '（空）'}`,
      }],
    },
    async execute() {
      return { dir: skinsDir(), active: readState().active, skins: listSkins().map(skinSummary) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'skin_open_folder',
    description: '在系统文件管理器里打开 dsh 本地皮肤文件夹，方便用户自己把图片/视频放进去。',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { dir: { type: 'string', required: true } },
      },
      render: (_args, value) => [{ type: 'text', text: `已在资源管理器中打开：${value.dir}` }],
    },
    async execute() {
      const dir = ensureDir()
      openInFileManager(dir)
      return { dir }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'skin_use',
    description: '把 dsh 界面切换到指定皮肤；传 default 恢复初始皮肤。用户浏览器会立刻应用。',
    parameters: { id: { type: 'string', required: true, description: '皮肤 id，或 default' } },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          active: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
          message: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    async execute(args) {
      const wanted = String(args.id).trim()
      if (wanted === '' || wanted.toLowerCase() === 'default') {
        writeState({ active: null })
        return { ok: true, active: null, message: '已恢复初始皮肤。' }
      }
      const skin = listSkins().find((entry) => entry.id === safeId(wanted))
      if (skin === undefined) {
        return { ok: false, active: null, message: `找不到皮肤 ${wanted}；现有：${listSkins().map((s) => s.id).join('、') || '（空）'}` }
      }
      writeState({ active: skin.id })
      return { ok: true, active: skin.id, message: `当前皮肤已设为「${skin.name}」。浏览器里点开右下角 🎨 面板即可看到选中状态。` }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'skin_delete',
    description: '删除指定皮肤（文件夹皮肤连同目录一起删除，松散文件皮肤只删该文件）。',
    parameters: { id: { type: 'string', required: true, description: '皮肤 id' } },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { ok: { type: 'boolean', required: true }, message: { type: 'string', required: true } },
      },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    async execute(args) {
      const id = safeId(args.id)
      const skin = listSkins().find((entry) => entry.id === id)
      if (skin === undefined) return { ok: false, message: `找不到皮肤 ${id}` }
      const dir = skinsDir()
      rmSync(skin.scope === '' ? join(dir, skin.file) : join(dir, skin.scope), { recursive: skin.scope !== '', force: true })
      if (readState().active === id) writeState({ active: null })
      return { ok: true, message: `已删除皮肤 ${id}。` }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'skin_create',
    description: '一键创建 dsh 界面皮肤：把一张图片（或 gif/视频）复制进皮肤文件夹，自动提取主题色与主色板并写成皮肤清单，之后可直接在界面里切换。',
    parameters: {
      image: { type: 'string', required: true, description: '源图片/视频的绝对路径' },
      name: { type: 'string', description: '皮肤显示名（默认用文件名）' },
      id: { type: 'string', description: '皮肤 id（默认由显示名生成）' },
      type: { type: 'string', enum: ['static', 'dynamic'], description: 'static=静态图片皮肤；dynamic=动态皮肤（额外开启星空/流星）' },
      blur: { type: 'number', description: '背景虚化像素，默认 18' },
      dim: { type: 'number', description: '背景暗化 0~1，默认 0.3' },
      replace: { type: 'boolean', description: '同名皮肤已存在时是否覆盖，默认 false' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          id: nullableString,
          name: nullableString,
          accent: nullableString,
          palette: { type: 'array', items: { type: 'string' } },
          file: nullableString,
          dir: { type: 'string', required: true },
          message: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    async execute(args) {
      const source = resolve(String(args.image))
      if (!existsSync(source) || !statSync(source).isFile()) throw new Error(`找不到图片/视频：${source}`)
      const ext = extname(source).toLowerCase()
      if (!MEDIA_EXT.has(ext)) throw new Error(`不支持的格式 ${ext}；支持 ${[...MEDIA_EXT].join(' ')}`)
      const name = String(args.name ?? basename(source, extname(source))).trim() || 'skin'
      const id = safeId(args.id ?? name)
      const folder = safeJoin(ensureDir(), id)
      if (existsSync(folder) && args.replace !== true) {
        return { ok: false, id, name, accent: null, file: null, dir: folder, message: `皮肤 ${id} 已存在；要覆盖请把 replace 设为 true。` }
      }
      mkdirSync(folder, { recursive: true })
      const file = `background${ext}`
      copyFileSync(source, join(folder, file))
      const analysis = IMAGE_EXT.has(ext) ? await analyzeImage(join(folder, file)).catch(() => null) : null
      const dynamic = args.type === 'dynamic'
      const meta = {
        id,
        name,
        file,
        type: dynamic ? 'dynamic' : 'static',
        blur: Number.isFinite(args.blur) ? args.blur : 18,
        dim: Number.isFinite(args.dim) ? args.dim : 0.3,
        saturate: 1.05,
        fit: 'cover',
        accent: analysis?.accent ?? null,
        palette: analysis?.palette ?? [],
        effects: { stars: dynamic, meteors: dynamic, density: 1 },
        createdAt: new Date().toISOString(),
        source: 'skin_create',
      }
      writeJson(join(folder, 'skin.json'), meta)
      return {
        ok: true,
        id,
        name,
        accent: meta.accent,
        palette: meta.palette,
        file,
        dir: folder,
        message: `已创建皮肤「${name}」(id=${id})，背景 ${file}${meta.accent ? `，主题色 ${meta.accent}` : ''}${dynamic ? '，带星空/流星动态效果' : ''}。\n在 dsh 右下角 🎨 面板里即可切换（也可以让我调用 skin_use）。`,
      }
    },
  }))
}