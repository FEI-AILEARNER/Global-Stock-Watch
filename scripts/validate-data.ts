import { dataDir, readRaw } from '../lib/load.ts';
import { validateDataset } from '../lib/validate.ts';

const dir = dataDir();
const raw = readRaw(dir);
const errors = validateDataset(raw);
if (errors.length > 0) {
  console.error(`数据校验没有通过（${errors.length} 处）：`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`数据校验通过：${raw.tickers.length} 个标的，${raw.updates.length} 条更新记录（${dir}）`);
