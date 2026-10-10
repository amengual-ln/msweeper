import test from 'node:test'
import assert from 'node:assert/strict'
import { createTheme, THEME_KEY } from '../src/theme.ts'
import type { Theme } from '../src/theme.ts'

function system(initial: boolean) {
  const events = new EventTarget()
  const media = Object.assign(events, { matches: initial })
  return {
    media: media as unknown as MediaQueryList,
    change(dark: boolean) { media.matches = dark; media.dispatchEvent(new Event('change')) },
  }
}
test('default follows system changes; toggling persists an override without following later changes', () => {
  const s = system(true), values = new Map<string, string>(), applied: Theme[] = []
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  const control = createTheme(s.media, storage, next => applied.push(next))
  assert.deepEqual(applied, ['dark'])
  s.change(false); assert.equal(applied.at(-1), 'light')
  control.toggle(); assert.equal(values.get(THEME_KEY), 'dark')
  const length = applied.length
  s.change(true); s.change(false); assert.equal(applied.length, length)
  control.destroy()
  const reopened: Theme[] = []
  const second = createTheme(s.media, storage, next => reopened.push(next))
  assert.deepEqual(reopened, ['dark'])
  second.destroy()
})
test('invalid or blocked storage uses the system; switching still works and listeners are cleaned up', () => {
  for (const blocked of [false, true]) {
    const s = system(false), applied: Theme[] = []
    const storage = {
      getItem() { if (blocked) throw new Error('Storage blocked'); return 'invalid' },
      setItem() { throw new Error('Storage blocked') },
    }
    const control = createTheme(s.media, storage, next => applied.push(next))
    assert.deepEqual(applied, ['light'])
    control.toggle(); assert.equal(applied.at(-1), 'dark')
    control.destroy()
    const length = applied.length
    s.change(true); assert.equal(applied.length, length)
  }
})
