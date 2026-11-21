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
| `stance` | `{ label, group }`。`label` 是态度原文；`group` 是分类：`in-zone` 已进区、`watch` 观察、`wait` 等待、`avoid` 回避、`speculative` 投机、`exit` 退出 |
| `strikeNote` | 击球区说明 |
| `events` | 下一个事件（原文）；没有写 `—` |
| `contentUpdatedOn` | 这个标的内容最近一次更新的日期 |
| `lastPrice` | 最后记录的价格：`{ value, asOf, approx, quote, recordedOn, note? }`。`asOf` 是价格的日期（原文没写就是 `null`）；`approx` 表示原文写的是“约”；`quote` 是出处原文；`recordedOn` 是写下它的那次更新。没有可靠价格时为 `null`，并必须写 `lastPriceNote` 说明原因 |
| `priceChanges` | 调价记录数组：`{ date, field: "strike"|"exit", from, to, reason, source, note? }`。`from` 未知时为 `null` 且必须写 `note`。每个字段最近一条的 `to` 必须等于当前价；每条的 `date` 必须有对应的 `data/updates/<date>.json` |
| `rationale` | 定价依据的历史，**最新在前**：`{ label, date, text }`。`label` 是原表【】里的字（如 `11/19更新`、`此前`）；最新一条必须有日期。`text` 逐字保留，`**…**` 表示加粗，必须成对 |
| `news` | 新闻数组，新的加在最前：`{ date, title, summary, url }`。`date` 写 `YYYY-MM-DD` 或 `YYYY-MM`；`url` 必须是 https |

## `data/meta/`

| 文件 | 内容 |
| --- | --- |
| `sectors.json` | 板块的 id、名称和顺序（数组顺序就是显示顺序）。每个板块下至少要有一个标的 |
| `order.json` | 标的在板块内的显示顺序（原表的先后）。新标的不写进来会排在板块末尾 |
| `notes.json` | 原表下方各段说明的原文：`{ id, source, title, text }`。必须有：`exit-logic`、`structure`、`macro`、`status-change`、`self-correction`、`color-legend`、`position-discipline`、`philosophy`、`calendar`、`disclaimer` |
| `exit-logic.json` | 四种退出逻辑的名称和原文片段 |
| `removed.json` | 已移除的标的：`{ name, removedOn, reason, source }` |
| `calendar.json` | 日历：`{ asOf, source, items: [{ text, tickers }] }`，按原文顺序 |
| `site.json` | `contentUpdatedOn`（全站内容最近一次更新日期，显示在首页）、`disclaimer`（页脚）、`excluded`（不纳入清单的披露，必须保留 ANT 一条） |

## 更新记录：`data/updates/<日期>.json`

`{ date, kind: "content"|"platform", title, origin, text, tickers }`。一天一个文件。`kind` 为 `content` 的是内容更新，`platform` 是平台自身的记录。更新记录页把同一天的调价记录自动列在下面。

## 报价接口

`GET /api/quotes?symbols=GOOGL,NVDA`（不写 `symbols` 就是全部）。返回：

```json
{ "fetchedAt": "…", "sources": ["yahoo-chart", "stooq"], "cacheSeconds": 60,
  "quotes": { "GOOGL": { "price": 0, "changePct": 0, "marketCap": null, "asOf": "…", "source": "yahoo-chart" }, "XXXX": null } }
```

取不到的代码是 `null`。不在清单里的代码会被忽略。
