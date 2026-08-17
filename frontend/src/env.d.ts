/// <reference types="vite/client" />

// 构建时由 vite.config.ts define 注入（系统设置-部署信息展示用）
declare const __BUILD_COMMIT__: string
declare const __BUILD_TIME__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
