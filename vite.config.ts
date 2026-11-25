import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    modulePreload: false,
    cssCodeSplit: false,
    license: { fileName: 'THIRD_PARTY_NOTICES.md' },
  },
})
