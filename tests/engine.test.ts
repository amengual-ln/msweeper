import test from 'node:test'
import assert from 'node:assert/strict'
import { Minefield, coordinateHash, keyOf } from '../src/engine.ts'

function drain(game: Minefield) {
  let frames = 0
  while (game.pending && frames++ < 10000) game.process()
  assert.equal(game.pending, false, 'normal-density flood fill should finish')
}
function find(game: Minefield, mine: boolean) {
  for (let y = -20; y < 20; y++) for (let x = -20; x < 20; x++) {
    if (game.isMine(x, y) === mine && !game.revealed.has(keyOf(x, y))) return { x, y }
  }
  throw new Error('No matching cell')
}
test('first click opens a zero and all eight safe neighbors, across seeds and negative coordinates', () => {
  for (let seed = 0; seed < 100; seed++) {
    const g = new Minefield(seed)
    const x = -100 - seed, y = seed * 1000
    g.reveal(x, y); drain(g)
    assert.equal(g.status, 'playing')
    assert.equal(g.revealed.get(keyOf(x, y)), 0)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) assert.ok(g.revealed.has(keyOf(x + dx, y + dy)))
  }
})
test('coordinates are deterministic, order independent, and include high coordinate words', () => {
  const a = new Minefield(123), b = new Minefield(123)
  const cells = [{ x: -33, y: -32 }, { x: 0, y: -1 }, { x: 32, y: 31 }, { x: 1000000, y: -990002 }]
  const before = cells.map(c => a.isMine(c.x, c.y))
  cells.slice().reverse().forEach(c => b.adjacent(c.x, c.y))
  assert.deepEqual(before, cells.map(c => b.isMine(c.x, c.y)))
  assert.notEqual(coordinateHash(123, 4, 5), coordinateHash(123, 4 + 2 ** 32, 5))
})
test('neighbor numbers are exact across positive and negative region boundaries', () => {
  const g = new Minefield(42); g.reveal(-32, -32); drain(g)
  for (const x of [-33, -32, -1, 0, 31, 32]) for (const y of [-33, -32, -1, 0, 31, 32]) {
    let expected = 0
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && g.isMine(x + dx, y + dy)) expected++
    assert.equal(g.adjacent(x, y), expected)
  }
})
test('flags protect cells, do not affect score, and cannot cover revealed cells', () => {
  const g = new Minefield(55)
  assert.equal(g.toggleFlag(1, 1), false)
  g.reveal(0, 0); drain(g)
  const c = find(g, false), score = g.score
  assert.equal(g.toggleFlag(c.x, c.y), true)
  assert.equal(g.reveal(c.x, c.y), false)
  assert.equal(g.score, score)
  assert.equal(g.toggleFlag(0, 0), false)
  g.toggleFlag(c.x, c.y); g.reveal(c.x, c.y); drain(g)
  assert.ok(g.score > score)
})
test('mine ends the game without increasing score and locks subsequent actions', () => {
  const g = new Minefield(777); g.reveal(0, 0); drain(g)
  const mine = find(g, true), score = g.score
  g.reveal(mine.x, mine.y); drain(g)
  assert.equal(g.status, 'lost'); assert.equal(g.score, score)
  assert.deepEqual(g.exploded, mine)
  assert.equal(g.reveal(400, 500), false); assert.equal(g.toggleFlag(1, 1), false)
})
test('a huge empty area is processed in bounded batches', () => {
  const g = new Minefield(1, 0)
  g.reveal(0, 0)
  assert.equal(g.process(10), 10)
  assert.equal(g.score, 10)
  assert.equal(g.pending, true)
  assert.equal(g.process(20), 20)
  assert.equal(g.score, 30)
})
test('chording correctly flagged numbers uncovers safe neighbors', () => {
  const g = new Minefield(1234); g.reveal(0, 0); drain(g)
  let expanded = false
  for (const [key, value] of [...g.revealed]) {
    if (!value) continue
    const [x, y] = key.split(',').map(Number) as [number, number]
    let safeHidden = false
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue
      if (g.isMine(x + dx, y + dy)) {
        if (!g.flags.has(keyOf(x + dx, y + dy))) g.toggleFlag(x + dx, y + dy)
      } else if (!g.revealed.has(keyOf(x + dx, y + dy))) safeHidden = true
    }
    if (safeHidden) {
      const score = g.score; g.reveal(x, y); drain(g)
      assert.equal(g.status, 'playing'); assert.ok(g.score > score); expanded = true; break
    }
  }
  assert.ok(expanded)
})
test('incorrect flags can cause a chord to hit a mine', () => {
  const g = new Minefield(1234); g.reveal(0, 0); drain(g)
  let tested = false
  for (const [key, value] of [...g.revealed]) {
    if (!value) continue
    const [x, y] = key.split(',').map(Number) as [number, number]
    const hidden = []
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && !g.revealed.has(keyOf(x + dx, y + dy))) hidden.push({ x: x + dx, y: y + dy })
    }
    const safe = hidden.find(c => !g.isMine(c.x, c.y))
    if (!safe || hidden.length <= value) continue
    const flags = [safe, ...hidden.filter(c => c !== safe)].slice(0, value)
    flags.forEach(c => g.toggleFlag(c.x, c.y)); g.reveal(x, y); drain(g)
    assert.equal(g.status, 'lost'); tested = true; break
  }
  assert.ok(tested)
})
