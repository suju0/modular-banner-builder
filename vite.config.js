import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 아티팩트(claude.ai)는 정적 파일을 페이지와 같은 위치에 상대 경로로 올린다.
  // 절대 경로(/assets/...)로 빌드하면 거기서 자산을 못 찾는다.
  base: './',
  plugins: [react()],
  server: {
    port: 5174,
    // 5174 가 이미 쓰이고 있으면 조용히 5175·5176 으로 옮겨 가지 않고 그 자리에서 실패한다.
    // 포트가 밀리면 같은 프로젝트의 서버가 두 벌 떠서, 어느 쪽을 보고 있는지 알 수 없게 된다.
    strictPort: true,
    host: true,
  },
})
