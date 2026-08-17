import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { execSync } from 'child_process'

// 构建时注入版本信息：系统设置-部署信息实时展示当前构建对应的 git commit 与构建时间，
// 用于快速辨别"线上跑的是不是最新代码"（git 不可用时兜底 unknown）
function gitInfo(): { commit: string; time: string } {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const buildTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  try {
    const commit = execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim()
    return { commit, time: buildTime }
  } catch {
    return { commit: 'unknown', time: buildTime }
  }
}
const { commit, time } = gitInfo()

export default defineConfig({
  plugins: [vue()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_TIME__: JSON.stringify(time),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        // 变量已在 main.scss 中通过 @use 引入，无需 additionalData
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
