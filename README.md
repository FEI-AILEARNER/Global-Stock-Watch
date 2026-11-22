# Global Stock Watch

Fei 的美股监控清单：25 个标的（2026-11-21 起），按板块分组，每个标的有击球价、退出价、态度、关键事项（最重要的近期新闻和官方公告，带原文链接）、定价依据的历史、新闻时间线、事件和调价记录。它取代原来的 Excel 监控清单。研究笔记，非投资建议。

公开网址，不被搜索引擎收录，不做登录。内容只在 Fei 说“更新”时更新（规则见 `docs/UPDATING.md`）；价格每次打开页面刷新。

## 运行

需要 Node 22.18 或更高。

```bash
npm install
npm run check            # 类型检查 + 测试 + 构建（构建前自动校验数据）
npm run validate:data    # 只校验数据
npm run dev              # 本地开发
npm run build && npm start -- -p 3467    # 本地看正式构建
```

页面检查（可选，需要本机有 Chrome）：先启动站点，再运行
`CHROME_DEBUG_PORT=9467 node scripts/browser-check.mjs http://localhost:3467 /tmp/gsw-shots`，它会在电脑和手机宽度各截一遍图并检查溢出、筛选和排序。

## 页面

| 地址 | 内容 |
| --- | --- |
| `/` | 监控清单：按板块分组，可按距击球区排序，可按态度和价位筛选；顶部是宏观环境和“现价在击球价下方的有哪些” |
| `/t/<代码>` | 标的详情：价格、关键事项；估值口径（按现价、记录价、击球价）、财务快照、公司指引、业务结构和订单、股本和负债、治理、风险因素、招股书研读、“什么情况下判断会变”、来源；然后是投资逻辑（最新在上，旧的可展开）、新闻、事件、调价记录 |
| `/calendar` | 日历 |
| `/discipline` | 核心哲学、仓位纪律、退出三种逻辑、自我校正与披露、已移除标的 |
| `/updates` | 更新记录和调价记录 |
| `/api/quotes` | 报价接口（见 `docs/DATA_MODEL.md`） |

## 怎么更新一个标的

先读 `docs/UPDATING.md`。改 `data/tickers/<代码小写>.json`：

1. 在 `rationale` **最前面**加一条 `{ "label": "12/20更新", "date": "2026-12-20", "text": "…" }`；旧的不动。加粗写 `**…**`。
2. 新闻加在 `news` 最前面：`{ "date", "title", "summary", "url" }`。
3. 更新 `lastPrice`（价格、日期、出处原文）和 `contentUpdatedOn`；需要时改 `events`、`stance`、`strikeNote`。
4. 调价：改 `strikePrice`／`exitPrice`，并在 `priceChanges` 加一条 `{ "date", "field", "from", "to", "reason", "source" }`。
5. 新建当天的 `data/updates/<日期>.json`，把 `data/meta/site.json` 的 `contentUpdatedOn` 改成当天。
6. `npm run check`，通过后提交、推送。

## 怎么补估值相关信息

为什么补、补什么：`docs/research/2026-11-22-valuation-info.md`。格式：`docs/DATA_MODEL.md` 的“估值相关信息”一节。

0. 联系方式：SEC 要求自动化工具在 User-Agent 里声明名称和联系方式。需在项目根目录的 `.env.local`（不进仓库）里设置 `SEC_USER_AGENT`，由 Fei 自己填写；脚本用 `node --env-file-if-exists=.env.local …` 读入。没设置时 `sec-xbrl.ts` 只能用 `data.sec.gov` 接口，`sec-fetch.ts`（下载 www.sec.gov 原文并转成文本）不运行。请求顺序进行、间隔至少 150 毫秒。
1. 提交 10-K／10-Q 的公司：`data/fundamentals/<代码小写>.json` 里写 `{ "ticker", "xbrl": { "cik": … } }`，运行 `SEC_CACHE_DIR=/tmp/sec node --env-file-if-exists=.env.local scripts/fundamentals/sec-xbrl.ts <代码>`，脚本从 `data.sec.gov` 填财务快照、现金、负债、股本。看一眼输出：债务、现金的标签各公司不同，不对就在 `xbrl.debtTags`／`cashTags` 里指定再跑。
2. 最近一季只有新闻稿（10-Q 还没出）、外国公司（20-F、40-F、6-K）、新上市公司：打开原文，人工录入，数字带 `"manual": true`（脚本不会覆盖），期间写进 `xbrl.manualPeriods`。
3. 业务结构、订单、指引、治理、风险、招股书、检查点都是人工从原文写，每条带来源；没读到的写进 `gaps`。
4. `npm run check`。

## 怎么加一个标的

1. 新建 `data/tickers/<代码小写>.json`，字段见 `docs/DATA_MODEL.md`（可以复制一个现有文件再改）。`sector` 用 `data/meta/sectors.json` 里的 id；要新板块就先在那里加。
2. 把代码加进 `data/meta/order.json` 里想要的位置。
3. 在当天的 `data/updates/<日期>.json` 里写明新增及原因。
4. `npm run check`。

Anthropic（ANT）因利益冲突不纳入清单，校验会拦住。

## 怎么换报价来源

报价来源是 `lib/quotes/` 里的适配器，接口见 `lib/quotes/types.ts`：给一个代码，返回 `{ price, changePct, marketCap, asOf }` 或 `null`。

- 现有：`yahoo-chart`（Yahoo Finance 公开图表接口，有价格、日内涨跌、时间，没有市值）、`stooq`（Stooq 公开 CSV，只有价格和日期）。两个都不需要密钥，也都不是有服务承诺的正式 API，可能限流或变更。
- 选择和顺序：环境变量 `QUOTE_SOURCES`，逗号分隔，按顺序尝试，默认 `yahoo-chart,stooq`。在 Vercel 的项目设置里改，改完重新部署。
- 加一个新来源：在 `lib/quotes/` 新建一个文件实现 `QuoteSource`，在 `lib/quotes/index.ts` 的 `SOURCES` 里登记，把解析函数的测试加进 `tests/quotes.test.ts`。
- 某个代码在来源那边叫法不同：在该标的的 JSON 里写 `quoteSymbol`。
- **需要密钥的来源**（例如为了补上市值）：密钥不写进仓库，也不要发给 Agent。由 Fei 自己在 Vercel 后台的 Environment Variables 里设置，适配器用 `process.env.<变量名>` 读取。
- `file` 适配器只用于本地预览（`QUOTE_SOURCES=file QUOTE_FIXTURE_FILE=<json>`），读的是样例数字，不是真实报价，不要用在正式环境。

取不到报价（上游失败、代码查不到）时，页面显示 JSON 里最后记录的价格和日期，并标“非实时”。

## 目录

```
app/            页面和报价接口
components/     界面组件
lib/            数据类型、校验、读取、报价适配器、计算和格式化
data/           内容（JSON）
scripts/        校验脚本、页面检查脚本、SEC XBRL 取数脚本（scripts/fundamentals/）、一次性导入脚本（scripts/import/）
tests/          测试；tests/fixtures/import-snapshot.json 是导入时的核对快照
docs/           PROGRESS、DATA_MODEL、UPDATING；research/ 是设计说明
```
