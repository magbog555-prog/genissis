import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const main=fs.readFileSync(path.join(root,'frontend','src','main.jsx'),'utf8');
const required=[
  'NO PROOF → NO ALLOW',
  'executionSurface',
  'actionVerdict',
  'prohibited',
  'status-badge',
  'operator-explanation',
  'Raw LiveMarketStreamDTO',
  'Raw CoreOverviewDTO'
];
const misses=required.filter(r=>!main.includes(r));
if(misses.length){
  console.error('Operator UI contract FAILED');
  for(const m of misses) console.error(' - missing '+m);
  process.exit(1);
}
console.log('Operator UI contract PASS');
