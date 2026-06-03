import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const css=fs.readFileSync(path.join(root,'frontend','src','styles.css'),'utf8');
const main=fs.readFileSync(path.join(root,'frontend','src','main.jsx'),'utf8');
const requiredCss=[
  'RC4-C Operator UI Language/Layout Hotfix',
  'max-height:280px',
  'overflow:auto',
  'word-break:break-word',
  'overflow-wrap:anywhere',
  'grid-template-columns:repeat(auto-fit,minmax'
];
const requiredMain=[
  'function RevisionTimeline',
  'summary-grid',
  'timeline-strip',
  'function ReplayPanel',
  'Raw ReplayRevisionDTO',
  'window.confirm'
];
const misses=[];
for(const r of requiredCss) if(!css.includes(r)) misses.push(`CSS missing: ${r}`);
for(const r of requiredMain) if(!main.includes(r)) misses.push(`main.jsx missing: ${r}`);
if(misses.length){
  console.error('Layout normalization FAILED');
  for(const m of misses) console.error(' - '+m);
  process.exit(1);
}
console.log('Layout normalization PASS');
