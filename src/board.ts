import { Minefield, keyOf } from './engine'
import type { Cell } from './engine'
export type Mode = 'reveal' | 'flag'
type Point = { x: number; y: number; startX: number; startY: number; dragged: boolean }
export type BoardState = { score: number; flags: number; status: Minefield['status']; zoom: number; busy: boolean; position: Cell; announcement: string }
const COLORS = ['', '#4269b0', '#378575', '#b56563', '#7863a7', '#9c784c', '#418b95', '#727b87', '#424951']
export class Board {
  game = new Minefield(crypto.getRandomValues(new Uint32Array(1))[0]!)
  mode: Mode = 'reveal'
  private ctx: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private size = 44
  private cx = 0.5
  private cy = 0.5
  private frame = 0
  private dirty = true
  private points = new Map<number, Point>()
  private multi = false
  private longPress: ReturnType<typeof setTimeout> | undefined
  private longFired = false
  private selected: Cell | null = null
  private announcement = ''
  private observer: ResizeObserver
  private abort = new AbortController()
  constructor(private canvas: HTMLCanvasElement, private notify: (state: BoardState) => void) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Tu navegador no permite dibujar el tablero.')
    this.ctx = ctx
    const options = { signal: this.abort.signal }
    canvas.addEventListener('pointerdown', this.down, options)
    canvas.addEventListener('pointermove', this.move, options)
    canvas.addEventListener('pointerup', this.up, options)
    canvas.addEventListener('pointercancel', this.cancel, options)
    canvas.addEventListener('lostpointercapture', this.cancel, options)
    canvas.addEventListener('contextmenu', this.contextMenu, options)
    canvas.addEventListener('wheel', this.wheel, { ...options, passive: false })
    canvas.addEventListener('keydown', this.keydown, options)
    this.observer = new ResizeObserver(this.resize)
    this.observer.observe(canvas)
    this.resize()
  }
  private resize = () => {
    const rect = this.canvas.getBoundingClientRect()
    this.width = rect.width; this.height = rect.height
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(this.width * dpr)
    this.canvas.height = Math.round(this.height * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.invalidate(); this.emit()
  }
  private emit() {
    this.notify({ score: this.game.score, flags: this.game.flags.size, status: this.game.status,
      zoom: Math.round(this.size / 44 * 100), busy: this.game.pending,
      position: { x: Math.floor(this.cx), y: Math.floor(this.cy) }, announcement: this.announcement })
  }
  private invalidate() {
    this.dirty = true
    if (!this.frame) this.frame = requestAnimationFrame(this.tick)
  }
  private tick = () => {
    this.frame = 0
    if (this.game.pending) {
      this.game.process()
      if (this.game.status === 'lost') this.announcement = `Tocaste una mina. Descubriste ${this.game.score} casillas.`
      this.dirty = true; this.emit()
    }
    if (this.dirty) { this.draw(); this.dirty = false }
    if (this.game.pending) this.frame = requestAnimationFrame(this.tick)
  }
  private toLocal(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }
  private toCell(clientX: number, clientY: number): Cell {
    const p = this.toLocal(clientX, clientY)
    return { x: Math.floor(this.cx + (p.x - this.width / 2) / this.size), y: Math.floor(this.cy + (p.y - this.height / 2) / this.size) }
  }
  private clearLong() { clearTimeout(this.longPress); this.longPress = undefined }
  private act(cell: Cell, flag = this.mode === 'flag') {
    if (flag) this.game.toggleFlag(cell.x, cell.y)
    else this.game.reveal(cell.x, cell.y)
    this.describe(cell)
    this.invalidate(); this.emit()
  }
  private describe(cell: Cell) {
    const key = keyOf(cell.x, cell.y)
    const value = this.game.revealed.get(key)
    this.announcement = `Casilla ${cell.x}, ${cell.y}: ${this.game.flags.has(key) ? 'bandera' : value === undefined ? 'cubierta' : value === 0 ? 'vacía' : `${value} minas vecinas`}.`
  }
  private down = (e: PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    this.canvas.focus({ preventScroll: true })
    this.canvas.setPointerCapture(e.pointerId)
    this.points.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, dragged: false })
    this.clearLong()
    if (this.points.size > 1) { this.multi = true; return }
    this.multi = false; this.longFired = false; this.selected = null
    this.canvas.classList.add('is-grabbing')
    this.longPress = setTimeout(() => {
      if (this.multi) return
      this.longFired = true
      this.act(this.toCell(e.clientX, e.clientY), true)
    }, 420)
  }
  private move = (e: PointerEvent) => {
    const point = this.points.get(e.pointerId)
    if (!point) return
    e.preventDefault()
    const previous = [...this.points.values()].slice(0, 2).map(p => ({ ...p }))
    const dx = e.clientX - point.x, dy = e.clientY - point.y
    point.x = e.clientX; point.y = e.clientY
    if (Math.hypot(point.x - point.startX, point.y - point.startY) > 7) { point.dragged = true; this.clearLong() }
    if (this.points.size > 1) {
      this.clearLong()
      const next = [...this.points.values()].slice(0, 2)
      const beforeDistance = Math.hypot(previous[0]!.x - previous[1]!.x, previous[0]!.y - previous[1]!.y)
      const distance = Math.hypot(next[0]!.x - next[1]!.x, next[0]!.y - next[1]!.y)
      const beforeMid = this.toLocal((previous[0]!.x + previous[1]!.x) / 2, (previous[0]!.y + previous[1]!.y) / 2)
      const mid = this.toLocal((next[0]!.x + next[1]!.x) / 2, (next[0]!.y + next[1]!.y) / 2)
      const worldX = this.cx + (beforeMid.x - this.width / 2) / this.size
      const worldY = this.cy + (beforeMid.y - this.height / 2) / this.size
      this.size = Math.max(32, Math.min(72, this.size * (beforeDistance > 0 ? distance / beforeDistance : 1)))
      this.cx = worldX - (mid.x - this.width / 2) / this.size
      this.cy = worldY - (mid.y - this.height / 2) / this.size
    } else if (point.dragged) {
      this.cx -= dx / this.size; this.cy -= dy / this.size
    }
    this.invalidate(); this.emit()
  }
  private up = (e: PointerEvent) => {
    const point = this.points.get(e.pointerId)
    if (!point) return
    this.clearLong()
    if (!point.dragged && !this.multi && !this.longFired && Math.hypot(e.clientX - point.startX, e.clientY - point.startY) <= 7) {
      this.act(this.toCell(e.clientX, e.clientY))
    }
    this.points.delete(e.pointerId)
    if (!this.points.size) { this.multi = false; this.canvas.classList.remove('is-grabbing') }
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId)
  }
  private cancel = (e: PointerEvent) => {
    if (!this.points.has(e.pointerId)) return
    this.clearLong(); this.points.delete(e.pointerId)
    this.multi = this.points.size > 0
    if (!this.points.size) this.canvas.classList.remove('is-grabbing')
  }
  private contextMenu = (e: MouseEvent) => {
    e.preventDefault(); this.clearLong()
    // Mobile browsers may emit contextmenu after our long-press handler.
    // Consuming it avoids toggling the same flag twice.
    if ((e as PointerEvent).pointerType === 'touch' || (this.longFired && this.points.size > 0)) return
    this.act(this.toCell(e.clientX, e.clientY), true)
  }
  private wheel = (e: WheelEvent) => {
    e.preventDefault()
    const p = this.toLocal(e.clientX, e.clientY)
    this.zoom(Math.exp(-e.deltaY * 0.002), p.x, p.y)
  }
  zoom(factor: number, x = this.width / 2, y = this.height / 2) {
    const wx = this.cx + (x - this.width / 2) / this.size
    const wy = this.cy + (y - this.height / 2) / this.size
    this.size = Math.max(32, Math.min(72, this.size * factor))
    this.cx = wx - (x - this.width / 2) / this.size
    this.cy = wy - (y - this.height / 2) / this.size
    this.invalidate(); this.emit()
  }
  home() {
    this.cx = (this.game.origin?.x ?? 0) + 0.5
    this.cy = (this.game.origin?.y ?? 0) + 0.5
    this.selected = null; this.invalidate(); this.emit()
  }
  reset() {
    this.clearLong(); this.points.clear(); this.multi = false; this.longFired = false
    this.canvas.classList.remove('is-grabbing')
    this.game = new Minefield(crypto.getRandomValues(new Uint32Array(1))[0]!)
    this.mode = 'reveal'; this.size = 44; this.announcement = 'Nueva partida. Elegí cualquier casilla para empezar.'
    this.home()
  }
  private keydown = (e: KeyboardEvent) => {
    const handled = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'f', 'F', 'Home', '+', '=', '-']
    if (!handled.includes(e.key)) return
    e.preventDefault()
    if (e.key === 'Home') { this.home(); return }
    if (['+', '=', '-'].includes(e.key)) { this.zoom(e.key === '-' ? 1 / 1.15 : 1.15); return }
    const cell = this.selected ?? { x: Math.floor(this.cx), y: Math.floor(this.cy) }
    if (e.key === 'ArrowUp') cell.y--
    if (e.key === 'ArrowDown') cell.y++
    if (e.key === 'ArrowLeft') cell.x--
    if (e.key === 'ArrowRight') cell.x++
    this.selected = cell
    if (e.key.startsWith('Arrow')) {
      if (Math.abs(cell.x + .5 - this.cx) * this.size > this.width / 2 - this.size * 1.5) this.cx = cell.x + .5
      if (Math.abs(cell.y + .5 - this.cy) * this.size > this.height / 2 - this.size * 1.5) this.cy = cell.y + .5
      this.describe(cell)
    } else this.act(cell, e.key.toLowerCase() === 'f' || (this.mode === 'flag' && e.key !== 'Enter'))
    this.invalidate(); this.emit()
  }
  private draw() {
    const ctx = this.ctx, s = this.size
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, this.width, this.height)
    const left = this.cx - this.width / (2 * s), top = this.cy - this.height / (2 * s)
    const endX = Math.ceil(left + this.width / s), endY = Math.ceil(top + this.height / s)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `500 ${Math.round(s * .37)}px ui-monospace, SFMono-Regular, Menlo, monospace`
    for (let y = Math.floor(top); y <= endY; y++) for (let x = Math.floor(left); x <= endX; x++) {
      const px = (x - left) * s, py = (y - top) * s
      const key = keyOf(x, y), value = this.game.revealed.get(key), flag = this.game.flags.has(key)
      const exploded = this.game.exploded?.x === x && this.game.exploded?.y === y
      const mine = this.game.status === 'lost' && this.game.isMine(x, y)
      if (value === undefined) {
        ctx.fillStyle = exploded ? '#e06c64' : mine && !flag ? '#f5e5e3' : flag ? '#e5eaf4' : '#eef0f3'
        ctx.beginPath(); ctx.roundRect(px + 1.5, py + 1.5, s - 3, s - 3, Math.max(3, s * .10)); ctx.fill()
      } else {
        ctx.strokeStyle = '#f0f2f5'; ctx.lineWidth = .6
        ctx.strokeRect(px, py, s, s)
        if (value) { ctx.fillStyle = COLORS[value]!; ctx.fillText(String(value), px + s / 2, py + s / 2 + 1) }
      }
      if (flag) this.drawFlag(px + s / 2, py + s / 2, s, this.game.status === 'lost' && !mine ? '#c76861' : '#596e95')
      else if (mine) this.drawMine(px + s / 2, py + s / 2, s, exploded ? '#ffffff' : '#bf827c')
      if (this.selected?.x === x && this.selected?.y === y) {
        ctx.strokeStyle = '#324b72'; ctx.lineWidth = 2
        ctx.strokeRect(px + 3, py + 3, s - 6, s - 6)
      }
    }
    if (this.game.status === 'ready') {
      const px = (.5 - left) * s, py = (.5 - top) * s
      ctx.strokeStyle = '#8798b3'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.roundRect(px - s / 2 + 2, py - s / 2 + 2, s - 4, s - 4, 5); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(px - 5, py); ctx.lineTo(px + 5, py); ctx.moveTo(px, py - 5); ctx.lineTo(px, py + 5); ctx.stroke()
    }
  }
  private drawFlag(x: number, y: number, s: number, color: string) {
    const a = s * .18
    this.ctx.strokeStyle = color; this.ctx.fillStyle = color; this.ctx.lineWidth = Math.max(1.6, s * .045)
    this.ctx.lineJoin = 'round'; this.ctx.lineCap = 'round'
    this.ctx.beginPath(); this.ctx.moveTo(x - a * .45, y + a); this.ctx.lineTo(x - a * .45, y - a); this.ctx.stroke()
    this.ctx.beginPath(); this.ctx.moveTo(x - a * .45, y - a); this.ctx.lineTo(x + a, y - a * .4); this.ctx.lineTo(x - a * .45, y + a * .12); this.ctx.closePath(); this.ctx.fill()
    this.ctx.beginPath(); this.ctx.moveTo(x - a, y + a); this.ctx.lineTo(x + a * .1, y + a); this.ctx.stroke()
  }
  private drawMine(x: number, y: number, s: number, color: string) {
    const ctx = this.ctx, r = s * .11
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 4, dx = Math.cos(angle) * r * 1.65, dy = Math.sin(angle) * r * 1.65
      ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke()
    }
  }
  destroy() {
    this.clearLong(); cancelAnimationFrame(this.frame)
    this.observer.disconnect(); this.abort.abort()
  }
}
