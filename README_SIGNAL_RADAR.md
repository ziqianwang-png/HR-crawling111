# Signal Radar · 招聘情报看板

这是一个基于字节跳动官方社招岗位源数据的双语招聘分析 Dashboard。

## 快速启动

要求 Node.js `>=22.13.0`。

```bash
pnpm install
pnpm run dev
```

打开 `http://localhost:5173/`。

生产构建：

```bash
pnpm run build
```

项目使用 React + Vinext + Recharts，页面入口是 `app/page.tsx`，样式在 `app/globals.css`。

## 数据管道

源站：<https://jobs.bytedance.com/experienced/position>

当前已随源码附带一份全量快照：

- `public/data/bytedance-social-jobs.json`：清洗后的全量岗位数据
- `public/data/bytedance-dashboard-summary.json`：看板聚合数据和开放维度定义
- `public/data/bytedance-source-manifest.json`：抓取时间、总量、分页和完整性校验

重新抓取并生成看板数据：

```bash
node scripts/crawl-bytedance.mjs
node scripts/build-bytedance-summary.mjs
pnpm run build
```

本次分析改版默认只读取已经保存的快照，不会在页面问答时访问源站；重新抓取是独立的数据管道操作。`public/data/bytedance-social-jobs.json` 是原始清洗快照，分析改版不会覆盖它。

爬虫使用源站公开接口，并按 `post_id` 去重。抓取脚本不会补造岗位；如果分页失败或完整性校验失败，应停止发布。

## 分析维度

看板没有把分析维度写死在数据表中。维度描述在 `bytedance-dashboard-summary.json` 的 `dimensions` 数组内，包含：

- `parent_category`：岗位类别
- `category`：细分职能
- `location`：工作地点
- `experience`：经验要求
- `signal_tags`：业务信号

当前“研发 × 经验要求”使用源岗位类别为“研发”的岗位；经验年限来自岗位描述和任职要求中的规则解析。AI / 大模型和电商标签也是基于标题、描述、任职要求的可解释关键词规则，不代表源站官方标签，也不是模型臆测。

源站未公开内部部门字段，因此看板不推断或伪造内部部门名称。

## LLM 问答

`POST /api/ask` 会先在本地快照中筛选证据，再将有限的证据 JSON 发送给 OpenAI-compatible Chat Completions 接口。系统提示要求模型只回答证据中存在的事实；未披露字段不会进入上下文。

复制 `.env.example` 为 `.env.local` 并配置：

```bash
LLM_API_KEY=your-key
LLM_MODEL=gpt-4o-mini
LLM_API_BASE_URL=https://api.openai.com/v1
```

没有配置 `LLM_API_KEY` 时，接口会返回明确标注的规则摘要，不会伪装成 LLM 结果。

## 迁移到其他发布平台

源码包不包含 `node_modules`、构建产物或任何发布凭证。复制项目后执行 `pnpm install` 即可重新安装依赖。

`public/` 是静态资源目录，必须一起部署。若发布平台支持 Vinext / Cloudflare Worker，可直接使用 `pnpm run build` 的产物；若使用其他 Node 平台，需要根据平台要求配置 Vinext 的 SSR 入口或将页面改为静态导出。

请不要把 `.openai/hosting.json` 中的站点标识当作通用部署凭证，也不要提交新的访问令牌。
