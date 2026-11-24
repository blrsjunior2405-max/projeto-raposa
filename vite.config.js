import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// O Vite serve o site durante o desenvolvimento e gera a pasta dist para publicação.
export default defineConfig({
  plugins: [react()],
})
