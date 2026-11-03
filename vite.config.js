import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 아티팩트(claude.ai)는 정적 파일을 페이지와 같은 위치에 상대 경로로 올린다.
  // 절대 경로(/assets/...)로 빌드하면 거기서 자산을 못 찾는다.
  base: './',
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
  },
})
