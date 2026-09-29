/** Pure, deterministic game rules. No browser or framework dependency. */
export type Cell = { x: number; y: number }
export type Status = 'ready' | 'playing' | 'lost'
export const keyOf = (x: number, y: number) => `${x},${y}`
const mix = (n: number): number => {
  n = Math.imul(n ^ (n >>> 16), 0x21f0aaad)
  n = Math.imul(n ^ (n >>> 15), 0x735a2d97)
  return (n ^ (n >>> 15)) >>> 0
}
export function coordinateHash(seed: number, x: number, y: number): number {
  // Include high words so the world does not repeat every 2^32 cells.
  let h = mix(seed ^ mix(x | 0))
  h = mix(h ^ mix(Math.floor(x / 4294967296)))
  h = mix(h ^ mix(y | 0) ^ 0x9e3779b9)
  return mix(h ^ mix(Math.floor(y / 4294967296)))
}
export class Minefield {
  readonly revealed = new Map<string, number>()
  readonly flags = new Set<string>()
  status: Status = 'ready'
  origin: Cell | null = null
  exploded: Cell | null = null
  private queue: Cell[] = []
  private head = 0
  private queued = new Set<string>()
  constructor(readonly seed: number, readonly density = 0.17) {}
  get score() { return this.revealed.size }
  get pending() { return this.head < this.queue.length }
  isMine(x: number, y: number): boolean {
    if (this.origin && Math.abs(x - this.origin.x) <= 1 && Math.abs(y - this.origin.y) <= 1) return false
    return coordinateHash(this.seed, x, y) / 4294967296 < this.density
  }
  adjacent(x: number, y: number): number {
    let count = 0
    this.neighbors(x, y, (nx, ny) => { if (this.isMine(nx, ny)) count++ })
    return count
  }
  private neighbors(x: number, y: number, visit: (x: number, y: number) => void) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx || dy) visit(x + dx, y + dy)
    }
  }
  toggleFlag(x: number, y: number): boolean {
    if (this.status !== 'playing' || this.revealed.has(keyOf(x, y))) return false
    const key = keyOf(x, y)
    if (!this.flags.delete(key)) this.flags.add(key)
    return true
  }
  reveal(x: number, y: number): boolean {
    if (this.status === 'lost' || this.flags.has(keyOf(x, y))) return false
    if (this.status === 'ready') {
      this.origin = { x, y }
      this.status = 'playing'
    }
    const existing = this.revealed.get(keyOf(x, y))
    if (existing !== undefined) {
      if (!existing) return false
      let flags = 0
      this.neighbors(x, y, (nx, ny) => { if (this.flags.has(keyOf(nx, ny))) flags++ })
      if (flags !== existing) return false
      this.neighbors(x, y, (nx, ny) => this.enqueue(nx, ny))
    } else this.enqueue(x, y)
    return true
  }
  private enqueue(x: number, y: number) {
    const key = keyOf(x, y)
    if (this.queued.has(key) || this.revealed.has(key) || this.flags.has(key)) return
    this.queued.add(key)
    this.queue.push({ x, y })
  }
  /** Work is capped per frame; a large empty area never blocks pointer events. */
  process(limit = 350): number {
    let processed = 0
    while (this.pending && processed < limit && this.status === 'playing') {
      const cell = this.queue[this.head++]!
      const key = keyOf(cell.x, cell.y)
      this.queued.delete(key)
      processed++
      if (this.flags.has(key) || this.revealed.has(key)) continue
      if (this.isMine(cell.x, cell.y)) {
        this.exploded = cell
        this.status = 'lost'
        break
      }
      const count = this.adjacent(cell.x, cell.y)
      this.revealed.set(key, count)
      if (count === 0) this.neighbors(cell.x, cell.y, (x, y) => this.enqueue(x, y))
    }
    if (!this.pending || this.status === 'lost') {
      this.queue = []; this.head = 0; this.queued.clear()
    } else if (this.head > 4096) {
      this.queue = this.queue.slice(this.head); this.head = 0
    }
    return processed
  }
}
