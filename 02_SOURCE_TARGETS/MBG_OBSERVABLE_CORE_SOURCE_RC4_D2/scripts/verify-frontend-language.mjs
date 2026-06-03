import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'frontend', 'src');
const dictionary = path.join(src, 'i18n', 'dictionary.ts');
const banned = [
  'Хронологія','редагування','Сучасність','Підтверджено','Скидання',
  'Місця дії','Ринковий внесок','збереження','розташування','Спостережувана',
  'Гарячі клавіші','Машина з ядра'
];

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>{
    const p=path.join(dir,d.name);
    if(d.isDirectory()) return walk(p);
    return [p];
  });
}
if(!fs.existsSync(dictionary)){
  console.error('Missing frontend/src/i18n/dictionary.ts');
  process.exit(1);
}
const files = walk(src).filter(p=>/\.(jsx?|tsx?|css)$/.test(p));
const hits=[];
for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  for(const word of banned){
    if(text.includes(word)) hits.push(`${path.relative(root,file)}: ${word}`);
  }
  if(/[іїєґІЇЄҐ]/.test(text)) hits.push(`${path.relative(root,file)}: contains Ukrainian-specific character`);
}
const main = fs.readFileSync(path.join(src,'main.jsx'),'utf8');
for(const required of [
  "storedLang === 'en' ? 'en' : 'ru'",
  "window.__ocmLang = lang",
  "Сбросить сохранённую раскладку",
  "Reset saved layout"
]){
  if(!main.includes(required)){
    hits.push(`main.jsx missing language contract marker: ${required}`);
  }
}
if(hits.length){
  console.error('Frontend language contract FAILED');
  for(const h of hits) console.error(' - '+h);
  process.exit(1);
}
console.log('Frontend language contract PASS');
