# 内容更新的规则（Fei 说“更新”时照此做）

内容不设定时任务。只有 Fei 说“更新”时才更新；价格由页面自己刷新，不属于内容更新。

## 规则

1. **每个新增的事实和数字都要来自当天实际打开过的来源，并附链接。** 新闻条目的 `url` 就是来源；定价依据里引用的财报数字，至少有一条当天的新闻条目或来源链接支持。
2. **查不到的写“本轮未检索到”，不凭印象填。** 没取到可靠股价就写“本轮未取得可靠收盘价”，`lastPrice` 保持上一次的记录或写 `null` 加 `lastPriceNote`。来源打不开的不绕过。
3. **旧判断逐字保留。** 新的一条定价依据加在 `rationale` 最前面，`label` 写成 `M/D更新`，`date` 写当天。旧的不改、不删。
4. **新闻加在 `news` 最前面**，格式：日期、主题、摘要、链接。没有需要记录的重大事件就不加。
5. **调价要写理由并留记录。** 改 `strikePrice` 或 `exitPrice` 时，同时在 `priceChanges` 加一条（日期、字段、旧价、新价、理由、出处），并在当天的定价依据里写明。校验会拦住没有记录或没有理由的调价。Fei 事后看更新记录页。
6. **Anthropic 的披露规则不变**：ANT 不纳入清单、不给击球价、不发表买卖观点；涉及 Anthropic 的标的（目前 GOOGL、NVDA、AVGO）在新的定价依据里继续带披露句。
7. **这是 Fei 的研究笔记**：不写针对读者的买卖建议，不记录真实持仓、金额或账户，不执行或模拟交易。
8. 态度（`stance`）、击球区说明、事件、退出逻辑类型可以随更新改；改了态度要同时检查 `group` 是否还对。

## 步骤

1. 读 `CLAUDE.md`、`docs/PROGRESS.md` 和上一次的 `data/updates/` 记录。
2. 逐个标的检索（财报、指引、重大新闻、股价），按上面的规则改 `data/tickers/<代码>.json`：加定价依据、加新闻、更新 `lastPrice`（写明日期和出处原文）、`events`、`contentUpdatedOn`，需要时调价。
3. 更新 `data/meta/`：`notes.json` 里的 `macro`、`status-change`（需要时还有 `self-correction`、`strike-note`）换成本轮的文字——**旧文字先移进当天更新记录的 `text` 或保留在上一条更新记录里，不要丢**；`calendar.json` 去掉已过去的事件、加新的；`site.json` 的 `contentUpdatedOn` 改成当天。
4. 新建 `data/updates/<当天>.json`：`kind` 写 `content`，`text` 写这次改了什么、调了哪些价及原因、哪些标的“本轮未检索到”。
5. 新增或移除标的：新增见 `README.md`；移除时删掉档案文件、在 `meta/removed.json` 加一条（名称、日期、原因），并从 `order.json`、`calendar.json` 里去掉。
6. `npm run check` 通过后提交并推送 `main`。结果写进 `docs/PROGRESS.md`。
7. 向 Supervisor 汇报：更新了哪些、调了哪些价（旧价、新价、理由）、哪些没查到。
