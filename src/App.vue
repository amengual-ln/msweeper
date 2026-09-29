<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Board } from './board'
import type { BoardState, Mode } from './board'
import Icon from './Icon.vue'
const canvas = ref<HTMLCanvasElement>()
const help = ref<HTMLDialogElement>()
const restart = ref<HTMLDialogElement>()
const mode = ref<Mode>('reveal')
const state = ref<BoardState>({ score: 0, flags: 0, status: 'ready', zoom: 100, busy: false, position: { x: 0, y: 0 }, announcement: '' })
const error = ref('')
const lossDismissed = ref(false)
const formattedScore = computed(() => state.value.score < 10000 ? String(state.value.score).padStart(4, '0') : state.value.score.toLocaleString('es-AR'))
let board: Board | undefined
function setMode(next: Mode) { mode.value = next; if (board) board.mode = next }
function newGame() {
  restart.value?.close()
  lossDismissed.value = false; mode.value = 'reveal'; board?.reset()
}
function requestRestart() {
  if (state.value.status === 'playing') restart.value?.showModal()
  else newGame()
}
onMounted(() => {
  try { board = new Board(canvas.value!, next => { state.value = next }) }
  catch (e) { error.value = e instanceof Error ? e.message : 'No pudimos iniciar el tablero.' }
})
onBeforeUnmount(() => board?.destroy())
</script>
<template>
  <main class="game-shell">
    <header class="header">
      <div class="brand" aria-label="Mines infinito"><span>mines<span class="infinity">∞</span></span><span class="brand-sub">BUSCAMINAS INFINITO</span></div>
      <div class="score" aria-label="Puntuación"><strong data-testid="score">{{ formattedScore }}</strong><span>casillas descubiertas</span></div>
      <div class="header-actions">
        <button class="icon-button" aria-label="Cómo jugar" title="Cómo jugar" @click="help?.showModal()"><Icon name="help" /></button>
        <button class="icon-button" aria-label="Nueva partida" title="Nueva partida" @click="requestRestart"><Icon name="reset" /></button>
      </div>
    </header>
    <section class="play-area" aria-label="Tablero infinito">
      <canvas ref="canvas" class="board" tabindex="0" aria-label="Tablero de buscaminas. Arrastrá para explorar. Con teclado, usá las flechas para elegir casilla, Enter para descubrir y F para poner bandera." aria-describedby="board-instructions">Tu navegador necesita soporte de Canvas para jugar.</canvas>
      <div class="board-fade" aria-hidden="true"></div>
      <Transition name="fade"><div v-if="state.status === 'ready' && !error" class="start-hint"><span>Un toque para empezar</span><span>La primera casilla es segura.</span></div></Transition>
      <div class="coordinates" aria-hidden="true">{{ state.position.x }} <span>/</span> {{ state.position.y }}</div>
      <div v-if="state.busy" class="working" role="status">Descubriendo…</div>
      <div v-if="error" class="error-card" role="alert">{{ error }}</div>
      <Transition name="rise">
        <section v-if="state.status === 'lost' && !lossDismissed" class="loss-card" aria-labelledby="loss-title" role="region">
          <button class="icon-button dismiss" aria-label="Explorar el tablero terminado" @click="lossDismissed = true"><Icon name="close" /></button>
          <div class="loss-icon"><Icon name="mine" /></div>
          <h1 id="loss-title">Hasta acá llegamos.</h1>
          <p>Descubriste <strong>{{ state.score.toLocaleString('es-AR') }}</strong> casillas. ¿Una más?</p>
          <button class="primary-button" @click="newGame"><Icon name="reset" /> Volver a jugar</button>
        </section>
      </Transition>
    </section>
    <footer class="controls">
      <div v-if="state.status === 'lost' && lossDismissed" class="ended"><span>Partida terminada</span><button @click="newGame">Volver a jugar</button></div>
      <div class="toolbar">
        <div class="mode-switch" role="group" aria-label="Acción al tocar">
          <button :class="{ active: mode === 'reveal' }" :aria-pressed="mode === 'reveal'" :disabled="state.status === 'lost'" @click="setMode('reveal')"><Icon name="reveal" /><span>Descubrir</span></button>
          <button :class="{ active: mode === 'flag' }" :aria-pressed="mode === 'flag'" :disabled="state.status !== 'playing'" @click="setMode('flag')"><Icon name="flag" /><span>Marcar</span><span v-if="state.flags" class="flag-count">{{ state.flags }}</span></button>
        </div>
        <span class="separator"></span>
        <button class="icon-button home" aria-label="Volver al inicio del tablero" title="Volver al inicio" @click="board?.home()"><Icon name="home" /></button>
      </div>
      <p id="board-instructions" class="instructions"><span class="touch-hint">Arrastrá para explorar <span>·</span> Mantené para marcar</span><span class="mouse-hint">Arrastrá para explorar <span>·</span> Clic derecho para marcar</span></p>
    </footer>
    <div class="zoom-controls" role="group" aria-label="Zoom del tablero"><button class="icon-button" aria-label="Alejar" :disabled="state.zoom <= 73" @click="board?.zoom(1 / 1.15)"><Icon name="minus" /></button><span>{{ state.zoom }}%</span><button class="icon-button" aria-label="Acercar" :disabled="state.zoom >= 164" @click="board?.zoom(1.15)"><Icon name="plus" /></button></div>
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ state.announcement }}</p>
    <dialog ref="help" aria-labelledby="help-title" @click="e => { if (e.target === help) help?.close() }">
      <button class="icon-button dialog-close" aria-label="Cerrar ayuda" @click="help?.close()"><Icon name="close" /></button>
      <span class="dialog-eyebrow">MINES ∞</span><h2 id="help-title">Un clásico, sin bordes.</h2>
      <p>Descubrí todas las casillas que puedas sin tocar una mina. Cada número indica cuántas minas hay en sus ocho casillas vecinas.</p>
      <dl class="help-list"><div><dt>Descubrir</dt><dd>Tocá una casilla. El primer toque siempre abre una zona segura.</dd></div><div><dt>Marcar</dt><dd>Mantené pulsado, usá el modo Marcar o hacé clic derecho.</dd></div><div><dt>Explorar</dt><dd>Arrastrá en cualquier dirección. Pellizcá con dos dedos o usá la rueda para cambiar el zoom.</dd></div><div><dt>Abrir alrededor</dt><dd>Tocá un número cuando tenga esa cantidad de banderas alrededor. Si están mal colocadas, podés tocar una mina.</dd></div></dl>
      <p class="help-note">No hay meta final ni garantía de resolver todo sin adivinar. La partida termina al tocar una mina. Si recargás la página, empezás de nuevo.</p>
      <p class="keyboard-note">Teclado: flechas para moverte, Enter para descubrir, F para marcar y Home para volver al inicio.</p>
      <button class="primary-button" @click="help?.close()">A jugar</button>
    </dialog>
    <dialog ref="restart" class="restart-dialog" aria-labelledby="restart-title">
      <h2 id="restart-title">¿Empezar de nuevo?</h2><p>Se va a cerrar esta partida de {{ state.score.toLocaleString('es-AR') }} casillas descubiertas.</p>
      <div class="dialog-actions"><button class="secondary-button" @click="restart?.close()">Seguir jugando</button><button class="primary-button" @click="newGame">Nueva partida</button></div>
    </dialog>
  </main>
</template>
