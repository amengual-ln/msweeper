<script setup lang="ts">
defineProps<{ name: string }>()
const paths: Record<string, string> = {
  flag: 'M6 21V3m0 1c4-3 8 3 12 0v10c-4 3-8-3-12 0',
  reveal: 'm5 3 14 9-7 1-3 7-4-17Z',
  home: 'M12 3v4m0 10v4M3 12h4m10 0h4M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z',
  reset: 'M3 10a9 9 0 1 1 1 7M3 4v6h6',
  help: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4m.1 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', close: 'm6 6 12 12M6 18 18 6',
  infinity: 'M12 12c-3-5-4-6-6-6a6 6 0 0 0 0 12c2 0 3-1 6-6s4-6 6-6a6 6 0 0 1 0 12c-2 0-3-1-6-6Z',
  mine: 'M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z',
}
</script>
<template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] || paths.reveal" /></svg></template>
