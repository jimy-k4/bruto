import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the app from /<repository>/; locally it lives at /.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
})
