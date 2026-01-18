# 微信侧边栏助手

基于 React + Vite 的微信侧边栏插件，默认接入火山方舟 Doubao（Ark API）并支持流式回答。

## 开发

```bash
npm install
npm run dev
```

运行 `npm run dev` 即可在本地开发调试。

## Doubao 配置

在 `.env` 中配置（交由 Vite 注入）：

```
ARK_API_KEY=your_api_key
# 可选：覆盖默认值
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL=doubao-lite-4k
```

## 构建

```bash
npm run build
npm run preview
```

## 其它命令

- `npm run lint` / `npm run typecheck`
