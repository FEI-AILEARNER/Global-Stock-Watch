# 数据格式

所有数据在 `data/` 下，都是 JSON。`npm run validate:data` 校验；构建前自动校验；读取时再校验一次。规则都在 `lib/validate.ts`，类型在 `lib/schema.ts`。

## 标的：`data/tickers/<代码小写>.json`

| 字段 | 说明 |
| --- | --- |
| `ticker` | 代码，大写；文件名是它的小写。不能是 `ANT` |
| `company` | 公司名 |
| `sector` | 板块 id，必须在 `meta/sectors.json` 里 |
| `quoteSymbol` | 可选。报价来源用的代码与 `ticker` 不同时才写 |
| `strikePrice` / `exitPrice` | 击球价、退出价（美元，正数） |
| `exitLogic` | `compounder`（优质复利机）/ `cyclical`（周期股）/ `option`（期权型）/ `other`（其他） |
| `exitLogicNote` | 可选。归入这一类（或留在“其他”）的一句话理由；原表点名的可以不写 |
| `stance` | `{ label, group }`。`label` 是态度原文；`group` 是分类：`in-zone` 已进区、`watch` 观察、`wait` 等待、`avoid` 回避、`speculative` 投机、`exit` 退出 |
| `strikeNote` | 击球区说明 |
| `events` | 下一个事件（原文）；没有写 `—` |
| `contentUpdatedOn` | 这个标的内容最近一次更新的日期 |
| `lastPrice` | 最后记录的价格：`{ value, asOf, approx, quote, recordedOn, note? }`。`asOf` 是价格的日期（原文没写就是 `null`）；`approx` 表示原文写的是“约”；`quote` 是出处原文；`recordedOn` 是写下它的那次更新。没有可靠价格时为 `null`，并必须写 `lastPriceNote` 说明原因 |
| `priceChanges` | 调价记录数组：`{ date, field: "strike"|"exit", from, to, reason, source, note? }`。`from` 未知时为 `null` 且必须写 `note`。每个字段最近一条的 `to` 必须等于当前价；每条的 `date` 必须有对应的 `data/updates/<date>.json` |
| `keyItems` | 关键事项（2026-11-21 起）：最重要的近期新闻和官方公告，**最新在前，最多 6 条**，没有就写 `[]`。每条 `{ date, title, summary, url, sourceType, source }`：`date` 写 `YYYY-MM-DD` 或 `YYYY-MM`；`summary` 是用自己的话写的两三句，不照抄；`url` 必须是当天实际打开过的 https 原文；`sourceType` 是 `official`（公司新闻稿、SEC 文件、监管机构公告）或 `media`（媒体、第三方整理，包括转述官方文件的报道）；`source` 写来源的名字。每次“更新”整组重写，旧的不保留（旧新闻在 `news` 里） |
| `rationale` | 定价依据的历史，**最新在前**：`{ label, date, text }`。`label` 是原表【】里的字（如 `11/19更新`、`此前`）；最新一条必须有日期。`text` 逐字保留，`**…**` 表示加粗，必须成对 |
| `news` | 新闻数组，新的加在最前：`{ date, title, summary, url }`。`date` 写 `YYYY-MM-DD` 或 `YYYY-MM`；`url` 必须是 https |

## 估值相关信息：`data/fundamentals/<代码小写>.json`（2026-11-22 起，可选）

为什么补这些、从哪里取：见 `docs/research/2026-11-22-valuation-info.md`。没有这个文件的标的，详情页照常显示。校验在 `lib/validate-fundamentals.ts`，类型和算术在 `lib/fundamentals.ts`。

**数字（Fig）**：`{ value, unit, src?, calc?, note?, tag?, manual?, period?, parts? }`。`value` 为 `null` 时 `note` 必须写原因（“本轮未检索到…”）；有数字时 `src` 必须指向 `sources` 里的一条。`calc` 写明是怎么算出来的（页面标 *）。`manual: true` 表示人工从原文录入，脚本重跑不覆盖。`parts` 是组成项，相加必须等于 `value`。`unit`：`USD`、`TWD`、`KRW`、`CAD`、`股`、`USD/股`、`%`。

| 字段 | 说明 |
| --- | --- |
| `ticker`、`checkedOn`、`currency` | 代码（必须在清单里，不能是 ANT）、核对日期、财报币种。币种不是 USD 时，需要股价的估值倍数不计算 |
| `xbrl` | 可选：`{ cik, debtTags?, cashTags?, capexTags?, revenueTags?, debtNote?, cashNote?, manualPeriods?, note? }`，给脚本用。`manualPeriods` 列出人工指定、脚本不改的期间 |
| `sources` | 来源：`{ id, origin: "xbrl"|"document", form, title?, filed?, period, url, xbrlUrl?, checkedOn }`。`xbrl` 由脚本写；`document` 是人工打开原文录入的 |
| `periods` | `{ fy, fyPrior, q, qPrior, ytd, ytdPrior, balanceDate }`，每个是 `{ label, start, end }`；最近一份是年报时 `ytd`、`ytdPrior` 为 `null`（近四季就是全年） |
| `flows` | `flows.<项目>.<期间>` 是 Fig。项目：`revenue grossProfit operatingIncome netIncome ocf capex sbc da epsDiluted dilutedShares buybacks issuance dividends`；期间：`fy fyPrior q qPrior ytd ytdPrior` |
| `balance` | `{ date, cash, debt, maturities? }`：现金及短期投资、有息负债（都是 Fig，用 `parts` 列组成）；`maturities` 是文字事实 |
| `shares` | `{ outstanding?, outstandingYearAgo?, dilutive? }`：封面股数、一年前的股数、潜在稀释（文字事实） |
| `valuationNote`、`adr` | 估值口径的补充说明；非美元公司的 ADR 比例（公司自己写明的才填） |
| `segments` | `{ period, src, rows: [{ name, revenue, profit?, note? }], note? }` |
| `orders`、`customers`、`governance` | 文字事实数组 `{ label, text, src, figure? }`；带数字的 `figure` 要写 `period` |
| `guidance` | `[{ period, text, direction, vsText?, src }]`，`direction`：`raised` 上调、`lowered` 下调、`maintained` 维持、`initiated` 首次、`withdrawn` 撤回、`none` 公司不给、`unclear` 无法比较 |
| `risks` | 最多 6 条 `{ title, text, src }`：公司自己写的、与这家公司特别相关的 |
| `prospectus` | `{ src, listedOn?, items: [{ topic, text, src }] }`：招股书要点 |
| `checkpoints` | `[{ metric, condition, basis, latest?, src? }]`：`basis` 写出自哪一条已有判断（日期），不新增观点 |
| `gaps` | 本轮没补到的内容，逐条写；都补到了写 `[]` |

**算出来的数字**（`lib/fundamentals.ts`，页面写公式）：近四季 = 最近财年 + 本年至今 − 上年同期；自由现金流 = 经营现金流 − 资本开支；市值 = 股价 × 封面股数；企业价值 = 市值 + 有息负债 − 现金及短期投资；市盈率 = 市值 ÷ 近四季净利润（亏损时不适用）；EV/EBITDA 的 EBITDA = 营业利润 + 折旧摊销；自由现金流收益率 = 近四季自由现金流 ÷ 市值。

**脚本**：`node scripts/fundamentals/sec-xbrl.ts [代码…]`（`SEC_CACHE_DIR` 可缓存下载）从 `data.sec.gov` 的 XBRL 接口更新 `periods`、`flows`、`balance.cash/debt`、`shares.outstanding(YearAgo)` 和 `origin: "xbrl"` 的来源，人工录入的部分不动。只适用于提交 10-K／10-Q 的公司。

## `data/meta/`

| 文件 | 内容 |
| --- | --- |
| `sectors.json` | 板块的 id、名称、可选的一句话逻辑 `logic`，和顺序（数组顺序就是显示顺序）。每个板块下至少要有一个标的 |
| `order.json` | 标的在板块内的显示顺序（原表的先后）。新标的不写进来会排在板块末尾 |
| `notes.json` | 原表下方各段说明的原文：`{ id, source, title, text }`。另有可选的 `macro-prev`、`status-change-prev`（上一轮的原文，首页可展开）、`strike-note-prev`、`self-correction-latest`（本轮的自我校正，显示在纪律页）。必须有：`exit-logic`、`structure`、`macro`、`status-change`、`self-correction`、`color-legend`、`position-discipline`、`philosophy`、`calendar`、`disclaimer` |
| `exit-logic.json` | 四种退出逻辑的名称和原文片段 |
| `removed.json` | 已移除的标的：`{ name, company?, removedOn, reason, source }`。从清单里移除的标的 `name` 写代码（测试和旧更新记录靠它识别） |
| `calendar.json` | 日历：`{ asOf, source, items: [{ text, tickers }] }`，按原文顺序 |
| `site.json` | `contentUpdatedOn`（全站内容最近一次更新日期，显示在首页）、`disclaimer`（页脚）、`excluded`（不纳入清单的披露，必须保留 ANT 一条） |

## 更新记录：`data/updates/<日期>.json`

`{ date, kind: "content"|"platform", title, origin, text, tickers }`。文件名 `<日期>.json` 或 `<日期>-<简称>.json`（同一天既有平台记录又有内容更新时用后者）。`tickers` 可以是清单里的代码，也可以是已移除名单里的代码。`kind` 为 `content` 的是内容更新，`platform` 是平台自身的记录。更新记录页把同一天的调价记录自动列在下面。

## 报价接口

`GET /api/quotes?symbols=GOOGL,NVDA`（不写 `symbols` 就是全部）。返回：

```json
{ "fetchedAt": "…", "sources": ["yahoo-chart", "stooq"], "cacheSeconds": 60,
  "quotes": { "GOOGL": { "price": 0, "changePct": 0, "marketCap": null, "asOf": "…", "source": "yahoo-chart" }, "XXXX": null } }
```

取不到的代码是 `null`。不在清单里的代码会被忽略。
