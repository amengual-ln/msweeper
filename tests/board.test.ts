import test from 'node:test'
import assert from 'node:assert/strict'
import { Board } from '../src/board.ts'
import { Minefield } from '../src/engine.ts'
import type { BoardState } from '../src/board.ts'

function harness() {
  const frames = new Map<number, FrameRequestCallback>(); let id = 0
  Object.assign(globalThis, {
    window: { devicePixelRatio: 1 },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: (cb: FrameRequestCallback) => { frames.set(++id, cb); return id },
    cancelAnimationFrame: (key: number) => frames.delete(key),
  })
  const target = new EventTarget()
  const captures = new Set<number>()
  Object.assign(target, {
    getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
    getBoundingClientRect: () => ({ width: 390, height: 600, top: 0, left: 0 }),
    classList: { add() {}, remove() {} }, focus() {},
    setPointerCapture: (n: number) => captures.add(n),
    hasPointerCapture: (n: number) => captures.has(n),
    releasePointerCapture: (n: number) => captures.delete(n),
  })
  let state: BoardState
  const board = new Board(target as HTMLCanvasElement, next => { state = next })
  board.game = new Minefield(1234)
  const pointer = (type: string, x: number, y: number, pointerId = 1) => {
    const e = new Event(type, { cancelable: true })
    Object.assign(e, { button: 0, clientX: x, clientY: y, pointerId, pointerType: 'touch' })
    target.dispatchEvent(e)
  }
  const flush = () => {
    let n = 0
    while (frames.size && n++ < 1000) {
      const batch = [...frames.values()]; frames.clear(); batch.forEach(cb => cb(0))
    }
    assert.ok(n < 1000)
  }
  return { board, pointer, flush, state: () => state! }
}
test('a tap reveals cells, but a drag does not reveal or flag', () => {
  const h = harness()
  try {
    h.pointer('pointerdown', 195, 300); h.pointer('pointermove', 260, 380); h.pointer('pointerup', 260, 380); h.flush()
    assert.equal(h.board.game.status, 'ready'); assert.equal(h.board.game.score, 0)
    assert.equal(h.board.game.flags.size, 0); assert.notEqual(h.state().position.x, 0)
    h.pointer('pointerdown', 195, 300); h.pointer('pointerup', 195, 300); h.flush()
    assert.equal(h.board.game.status, 'playing'); assert.ok(h.board.game.score >= 9)
  } finally { h.board.destroy() }
})
test('pinch changes zoom without revealing, including the remaining finger release', () => {
  const h = harness()
  try {
    h.pointer('pointerdown', 120, 300, 1); h.pointer('pointerdown', 260, 300, 2)
    h.pointer('pointermove', 290, 300, 2); h.pointer('pointerup', 290, 300, 2)
    h.pointer('pointerup', 120, 300, 1); h.flush()
    assert.ok(h.state().zoom > 100); assert.equal(h.board.game.score, 0)
    assert.equal(h.board.game.status, 'ready')
  } finally { h.board.destroy() }
})
test('cancelling a touch never reveals a cell', () => {
  const h = harness()
  try {
    h.pointer('pointerdown', 195, 300); h.pointer('pointercancel', 195, 300)
    h.pointer('pointerup', 195, 300); h.flush(); assert.equal(h.board.game.score, 0)
  } finally { h.board.destroy() }
})
test('long press flags once and consumes the subsequent touch contextmenu and release', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const h = harness()
  try {
    h.pointer('pointerdown', 195, 300); h.pointer('pointerup', 195, 300); h.flush()
    // Pan well away from the starting region into untouched cells.
    h.pointer('pointerdown', 195, 300); h.pointer('pointermove', 195, -3000); h.pointer('pointerup', 195, -3000); h.flush()
    const score = h.board.game.score
    h.pointer('pointerdown', 195, 300); t.mock.timers.tick(421)
    assert.equal(h.board.game.flags.size, 1)
    h.pointer('contextmenu', 195, 300); h.pointer('pointerup', 195, 300); h.flush()
    assert.equal(h.board.game.flags.size, 1); assert.equal(h.board.game.score, score)
  } finally { h.board.destroy() }
})
