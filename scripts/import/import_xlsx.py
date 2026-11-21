#!/usr/bin/env python3
"""一次性导入：把 Fei 的 Excel 监控清单（表“监控清单”，A1:M53）转成 data/ 下的 JSON。

用法（在仓库之外的目录运行，xlsx 不放进仓库）：
    python3 -I scripts/import/import_xlsx.py <tracker.xlsx> <仓库根目录>

原则：原文逐字保留。本脚本里手写的只有三样，都能在原表文字里找到出处：
  1. LAST_PRICE：每个标的【11/19更新】里记录的最后一个价格和日期（脚本会断言数字确实出现在原文里）；
  2. PRICE_CHANGES：A42、A53 和【11/19更新】里写明的调价（理由是原文的逐字摘录，脚本断言能在原文里找到）；
  3. EXIT_LOGIC、REMOVED、CALENDAR_TICKERS：A43、A44、A51 的结构化（文字逐字取自原表）。
文件只当作数据读，不执行其中任何公式。
"""
import hashlib
import json
import os
import re
import sys

import openpyxl

SECTOR_IDS = {
    4: "ai-core",
    10: "power-grid",
    17: "semi-cycle",
    21: "nuclear",
    28: "space",
    35: "other-themes",
}
# 态度列的底色 → 态度分类（原表 A48：深绿已进区·琥珀观察·蓝等待·橙回避·灰投机）
STANCE_BY_FILL = {
    "00C6E0B4": "in-zone",
    "00FFF2CC": "watch",
    "00DEEBF7": "wait",
    "00FCE4D6": "avoid",
    "00EDEDED": "speculative",
}
# A43
EXIT_LOGIC = {
    "compounder": ["GOOGL", "NVDA", "TSM", "BWXT"],
    "cyclical": ["MU", "SKHY", "AMAT", "CCJ"],
    "option": ["XE", "OKLO", "SMR", "ASTS", "LUNR"],
}
CONTENT_DATE = "2026-11-19"

# (数值, 日期或 None, 是否“约”, 原文里的写法, 备注)；None = 原文没有可用的价格
LAST_PRICE = {
    "GOOGL": (295.8, "2026-11-13", False, "现价$295.8(11/13)", None),
    "NVDA": (152.1, "2026-11-18", False, "现价$152.1(11/18)", None),
    "TSM": (398.7, "2026-11-13", False, "现价$398.7(11/13)", None),
    "AVGO": (347, "2026-11-13", False, "现价$347(11/13，盘后$340.2)", None),
    "IBM": (253, "2026-10-26", True, "约$253(10/26，较旧)", "原文注明“较旧”"),
    "CEG": None,
    "VST": None,
    "TLN": (333, "2026-11-03", False, "财报前$333(11/3)", "原文为“财报前”的价格"),
    "GEV": (774, "2026-11-06", False, "现价$774(11/6)", None),
    "VRT": None,
    "ETN": (341.7, "2026-11-06", False, "现价$341.7(11/6)", None),
    "MU": (719, "2026-11-16", False, "现价$719(11/16，单日-7.6%)", None),
    "SKHY": (122.4, "2026-11-18", False, "现价$122.4(11/18)", None),
    "AMAT": (395, "2026-11-12", False, "财报前$395(11/12)", "原文为“财报前”的价格，其后两个交易日再跌"),
    "CCJ": None,
    "BWXT": (131, None, True, "约$131", "原文未注明该价格的日期"),
    "LEU": None,
    "XE": (11.5, "2026-10-28", True, "约$11.5(10/28，较旧)", "原文注明“较旧”"),
    "OKLO": (25.3, "2026-10-30", True, "约$25.3(10/30)", None),
    "SMR": (4.66, "2026-11-13", False, "现价$4.66(11/13)", None),
    "RKLB": (55.2, "2026-11-17", False, "现价$55.2(11/17)", None),
    "LUNR": (11.3, None, True, "约$11.3", "原文未注明该价格的日期"),
    "IRDM": None,
    "ASTS": (32.6, "2026-11-13", False, "现价$32.6(11/13)", None),
    "KTOS": None,
    "SPCX": (140, "2026-11-17", False, "现价$140(11/17)", None),
    "TSLA": (390, "2026-11-13", False, "现价$390(11/13)", None),
    "TWST": (122.6, "2026-11-11", False, "财报前$122.6(11/11)", "原文为“财报前”的价格"),
    "DNA": None,
    "COIN": (143.5, "2026-10-30", False, "$143.5(10/30，财报日-10.6%)", None),
}
NO_PRICE_NOTE = {
    "CEG": "原表【11/19更新】：本轮未取得可靠收盘价。",
    "VST": "原表【11/19更新】：本轮未取得可靠收盘价。",
    "VRT": "原表【11/19更新】：本轮未取得可靠收盘价（“约在$190-200一带”是推算，非报价）。",
    "CCJ": "原表【11/19更新】只有按一致目标价反推的“约$91(非报价)”，没有记录报价。",
    "LEU": "原表【11/19更新】：本轮未取得可靠股价。",
    "IRDM": "原表【11/19更新】没有记录 IRDM 的股价（以实时价对比隐含对价约$49）。",
    "KTOS": "原表【11/19更新】：本轮未取得细节与可靠股价。",
    "DNA": "原表【11/19更新】：本轮未检索到可靠的Q3数据与股价。",
}

# 调价记录：(代码, 日期, 字段, 旧价或 None, 新价, 理由起点, 理由终点(不含)或 None, 出处)
# 理由 = 该标的【11/19更新】里从“起点”到“终点”之前的逐字摘录。
PRICE_CHANGES = [
    ("GOOGL", "strike", 340, 300, "击球价由$340下修至$300", "基本面仍是"),
    ("GOOGL", "exit", 540, 480, "击球价由$340下修至$300", "基本面仍是"),
    ("NVDA", "strike", 180, 165, "击球价$180→$165", "业务本身极强"),
    ("NVDA", "exit", 360, 300, "击球价$180→$165", "业务本身极强"),
    ("TLN", "strike", 250, 280, "击球价$250→$280", "不再上调的原因"),
    ("BWXT", "strike", 155, 125, "击球价$155→$125", "质地未变"),
    ("BWXT", "exit", 260, 220, "击球价$155→$125", "质地未变"),
    ("ASTS", "strike", 45, 35, "击球价$45→$35", "11/11曾反弹"),
    ("ASTS", "exit", 160, 130, "击球价$45→$35", "11/11曾反弹"),
    ("TWST", "strike", 45, 70, "击球价上调至$70", None),
    ("TWST", "exit", None, 200, "击球价上调至$70", None),
]

# A44 的结构化；reason 是 A44 里的逐字片段
REMOVED = [
    ("DJT", "2026-11-19", "不可定价／已改主题"),
    ("上海超导", "2026-11-19", "不可定价／已改主题"),
    ("IonQ", "2026-11-19", "是同一注量子彩票且全部距击球价70-133%"),
    ("D-Wave", "2026-11-19", "是同一注量子彩票且全部距击球价70-133%"),
    ("Rigetti", "2026-11-19", "是同一注量子彩票且全部距击球价70-133%"),
    ("Quantum Computing", "2026-11-19", "是同一注量子彩票且全部距击球价70-133%"),
    ("AMSC", None, "两者均非真超导标的：AMSC实为电网+AI电力主线、COHR的HTS激光在财报里是零头，其角色已由GEV/VRT/ETN更好地覆盖"),
    ("COHR", None, "两者均非真超导标的：AMSC实为电网+AI电力主线、COHR的HTS激光在财报里是零头，其角色已由GEV/VRT/ETN更好地覆盖"),
]

NOTES = [
    # (id, 单元格, 页面标题)
    ("sheet-title", "A1", "原表标题"),
    ("sheet-howto", "A2", "原表使用说明"),
    ("news-format", "A41", "重大新闻的格式"),
    ("strike-note", "A42", "击球价说明与本轮调整"),
    ("exit-logic", "A43", "退出价的三种逻辑"),
    ("structure", "A44", "结构调整与已移除标的"),
    ("macro", "A45", "宏观环境"),
    ("status-change", "A46", "状态变化"),
    ("self-correction", "A47", "自我校正与披露"),
    ("color-legend", "A48", "色标"),
    ("position-discipline", "A49", "仓位纪律"),
    ("philosophy", "A50", "核心哲学"),
    ("calendar", "A51", "日历"),
    ("disclaimer", "A52", "声明"),
    ("vst-correction", "A53", "8/5 VST判断修正"),
]


def sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def split_rationale(text):
    out = []
    for block in text.split("\n\n"):
        m = re.match(r"^【([^】]+)】", block)
        assert m, f"定价依据的段落没有【】开头：{block[:30]}"
        label = m.group(1)
        date = None
        dm = re.match(r"^(\d{1,2})/(\d{1,2})更新$", label)
        if dm:
            date = f"2026-{int(dm.group(1)):02d}-{int(dm.group(2)):02d}"
        out.append({"label": label, "date": date, "text": block[m.end():]})
    return out


def split_news(text):
    items = []
    if not text:
        return items
    for block in text.split("\n\n"):
        lines = block.split("\n")
        assert len(lines) >= 3, f"新闻条目不足三行：{block[:40]}"
        head, url = lines[0], lines[-1]
        assert " ｜ " in head and url.startswith("https://"), block[:60]
        date, title = head.split(" ｜ ", 1)
        assert re.match(r"^\d{4}-\d{2}(-\d{2})?$", date), date
        items.append({"date": date, "title": title, "summary": "\n".join(lines[1:-1]), "url": url})
    return items


def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    xlsx, root = sys.argv[1], sys.argv[2]
    ws = openpyxl.load_workbook(xlsx)["监控清单"]
    cell = lambda ref: ws[ref].value

    logic_of = {t: k for k, ts in EXIT_LOGIC.items() for t in ts}
    sectors, tickers, snapshot = [], [], []
    sector = None
    for r in range(4, 40):
        a = ws.cell(r, 1).value
        if a is None:
            continue
        if r in SECTOR_IDS:
            sector = SECTOR_IDS[r]
            sectors.append({"id": sector, "name": a})
            continue
        code = a
        k = ws.cell(r, 11).value
        m = ws.cell(r, 13).value or ""
        rationale = split_rationale(k)
        assert "\n\n".join(f"【{x['label']}】{x['text']}" for x in rationale) == k
        news = split_news(m)
        latest = rationale[0]
        assert latest["date"] == CONTENT_DATE, code

        lp = LAST_PRICE[code]
        if lp is None:
            last_price = None
            last_price_note = NO_PRICE_NOTE[code]
        else:
            value, as_of, approx, quote, note = lp
            assert quote in latest["text"], f"{code}: 原文里找不到 {quote}"
            last_price = {"value": value, "asOf": as_of, "approx": approx, "quote": quote, "recordedOn": CONTENT_DATE}
            if note:
                last_price["note"] = note
            last_price_note = None

        changes = []
        for (c, field, old, new, start, end) in PRICE_CHANGES:
            if c != code:
                continue
            t = latest["text"]
            i = t.index(start)
            j = t.index(end) if end else len(t)
            assert i < j
            item = {"date": CONTENT_DATE, "field": field, "from": old, "to": new,
                    "reason": t[i:j].strip(), "source": "原表【11/19更新】与 A42"}
            if old is None:
                item["note"] = "原表没有写明调整前的退出价"
            changes.append(item)
        if code == "VST":
            a53 = cell("A53")
            changes.append({"date": "2026-08-05", "field": "strike", "from": 190, "to": 185, "reason": a53,
                            "source": "原表 A53", "note": "原文为“由$190下修为$170-185”，F列击球价取区间上沿$185"})
            changes.append({"date": "2026-08-05", "field": "exit", "from": None, "to": 340, "reason": a53,
                            "source": "原表 A53", "note": "原表没有写明调整前的退出价"})

        strike, exit_ = ws.cell(r, 6).value, ws.cell(r, 8).value
        for ch in changes:
            if ch["date"] == CONTENT_DATE:
                assert ch["to"] == (strike if ch["field"] == "strike" else exit_), (code, ch)

        obj = {
            "ticker": code,
            "company": ws.cell(r, 2).value,
            "sector": sector,
            "strikePrice": strike,
            "exitPrice": exit_,
            "exitLogic": logic_of.get(code, "other"),
            "stance": {"label": ws.cell(r, 9).value, "group": STANCE_BY_FILL[ws.cell(r, 9).fill.fgColor.rgb]},
            "strikeNote": ws.cell(r, 10).value,
            "events": ws.cell(r, 12).value,
            "contentUpdatedOn": CONTENT_DATE,
            "lastPrice": last_price,
        }
        if last_price_note:
            obj["lastPriceNote"] = last_price_note
        obj["priceChanges"] = changes
        obj["rationale"] = rationale
        obj["news"] = news
        tickers.append(obj)
        write(os.path.join(root, "data", "tickers", code.lower() + ".json"), obj)
        snapshot.append({
            "ticker": code, "company": obj["company"], "sector": sector, "strikePrice": strike, "exitPrice": exit_,
            "stanceLabel": obj["stance"]["label"], "rationaleSha256": sha(k), "newsSha256": sha(m), "newsCount": len(news),
        })

    assert len(tickers) == 30 and len(sectors) == 6

    notes = [{"id": i, "source": ref, "title": title, "text": cell(ref)} for (i, ref, title) in NOTES]
    a44, a43, a47, a51 = cell("A44"), cell("A43"), cell("A47"), cell("A51")
    for (_, _, reason) in REMOVED:
        assert reason in a44
    exit_logic = []
    for (i, name, start, end) in [
        ("compounder", "优质复利机", "①优质复利机", "；②"),
        ("cyclical", "周期股", "②周期股", "；③"),
        ("option", "期权型", "③期权型", None),
    ]:
        s = a43.index(start)
        e = a43.index(end) if end else len(a43)
        exit_logic.append({"id": i, "name": name, "text": a43[s:e]})
    exit_logic.append({"id": "other", "name": "其他", "text": None})

    cal_items = re.split(r"\s*·\s*", a51[len("日历："):])
    all_codes = [t["ticker"] for t in tickers]
    alias = {"SpaceX": "SPCX", "Tesla": "TSLA"}
    calendar = []
    for it in cal_items:
        found = [c for c in all_codes if re.search(rf"(?<![A-Za-z]){c}(?![A-Za-z])", it)]
        found += [v for k2, v in alias.items() if k2 in it and v not in found]
        calendar.append({"text": it, "tickers": found})
    assert all(c["text"] in a51 for c in calendar)  # 逐字原文另存于 notes.json 的 calendar 一条

    disclosure = a47[a47.index("**另："):]
    write(os.path.join(root, "data", "meta", "sectors.json"), sectors)
    write(os.path.join(root, "data", "meta", "notes.json"), notes)
    write(os.path.join(root, "data", "meta", "order.json"), all_codes)  # 原表里的先后顺序
    write(os.path.join(root, "data", "meta", "exit-logic.json"), exit_logic)
    write(os.path.join(root, "data", "meta", "removed.json"),
          [{"name": n, "removedOn": d, "reason": reason, "source": "原表 A44"} for (n, d, reason) in REMOVED])
    write(os.path.join(root, "data", "meta", "calendar.json"), {"asOf": CONTENT_DATE, "source": "原表 A51", "items": calendar})
    write(os.path.join(root, "data", "meta", "site.json"), {
        "contentUpdatedOn": CONTENT_DATE,
        "disclaimer": cell("A52"),
        "excluded": [{"name": "Anthropic", "ticker": "ANT", "text": disclosure, "source": "原表 A47"}],
    })
    write(os.path.join(root, "data", "updates", "2026-08-05.json"), {
        "date": "2026-08-05", "kind": "content", "title": "VST判断修正", "origin": "原表 A53",
        "text": cell("A53"), "tickers": ["VST"],
    })
    write(os.path.join(root, "data", "updates", "2026-11-19.json"), {
        "date": "2026-11-19", "kind": "content", "title": "11/19 更新：宏观环境换挡，调整6家击球价，板块由9个并为6个",
        "origin": "原表 A42、A44", "text": cell("A42") + "\n\n" + cell("A44"),
        "tickers": ["GOOGL", "NVDA", "TLN", "BWXT", "ASTS", "TWST"],
    })
    write(os.path.join(root, "tests", "fixtures", "import-snapshot.json"), {
        "source": "tracker.xlsx，表“监控清单”A1:M53，2026-11-21 导入", "contentDate": CONTENT_DATE,
        "sectors": sectors, "tickers": snapshot,
        "notes": [{"id": n["id"], "source": n["source"], "sha256": sha(n["text"])} for n in notes],
    })
    print("ok", len(tickers), "tickers", len(sectors), "sectors", sum(len(t["news"]) for t in tickers), "news")


main()
