
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import baseTrace from './mockComputationTrace.json';
import {scenarioOptions, buildCanonicalTrace} from './adapters/mockAdapter.js';
import {ApiAdapter} from './adapters/apiAdapter.js';
import './styles.css';

const T = {
  ru: {
    title:'Observable Core Machine',
    subtitle:'Наблюдаемая вычислительная машина ядра',
    settings:'Настройки',
    compact:'Компактный режим',
    reset:'Сбросить раскладку',
    mock:'MOCK ComputationTrace · Workspace Modes',
    scenario:'Сценарий',
    provenance:'Происхождение',
    marketIntegrity:'Целостность рынка',
    replayRevision:'Replay / Revision',
    mode:'Режим области',
    customMode:'Своя раскладка',
    overviewMode:'Overview / Обзор',
    computeMode:'Compute / Вычисления',
    rulesMode:'Rules / Правила',
    stateMode:'State / Состояние',
    auditMode:'Audit / След',
    machinePulse:'Пульс машины',
    activeEvent:'Активное событие',
    rawTrace:'Сырой след',
    pipeline:'Конвейер обработки',
    miniVerdict:'Мини-вердикт',
    steps:'Шаги вычисления',
    formulas:'Инспектор формул',
    diff:'Разница снимка',
    rules:'Правила ядра',
    gateTrace:'След вердикта',
    machineStatus:'Статус машины',
    trustState:'Локальное доверие ядра',
    runtimeMode:'Режим среды выполнения',
    trading:'Торговля разрешена',
    revision:'Ревизия',
    lastEvent:'Последнее событие',
    lastTransition:'Последний переход',
    mainReason:'Главная причина',
    yes:'да', no:'нет',
    result:'Результат',
    action:'Действие',
    trust:'Локальное доверие ядра',
    reason:'Причина',
    ledger:'Ledger record',
    quarantine:'Quarantine record',
    gateVerdict:'Вердикт ворот',
    ledgerResult:'Результат журнала',
    quarantineResult:'Результат карантина',
    recoveryResult:'Результат восстановления',
    save:'Сохранить',
    load:'Загрузить',
    del:'Удалить',
    layout:'Раскладка окон',
    theme:'Тема',
    density:'Плотность',
    scale:'Масштаб',
    radius:'Скругление',
    uiFont:'Шрифт интерфейса',
    monoFont:'Шрифт кода и цифр',
    saturation:'Насыщенность',
    contrast:'Контраст',
    glow:'Свечение',
    hue:'Оттенок акцента',
    panelOpacity:'Плотность стекла',
    gridPower:'Сила сетки',
    headerPower:'Металл заголовков',
    shadowDepth:'Глубина тени',
    scanlines:'Скан-линии',
    noise:'Шум стекла',
    textSharpness:'Резкость текста',
    hotkeys:'Горячие клавиши',
    action:'Действие',
    shortcut:'Комбинация',
    clickToRecord:'нажмите и введите',
    resetHotkeys:'Сбросить клавиши',
    blockColors:'Цвета блоков',
    standard:'Сбросить стандартную раскладку',
    close:'×',
    inputs:'Входы',
    expression:'Выражение',
    intermediate:'Промежуточные значения',
    threshold:'Порог',
    formulaResult:'Результат',
    explanation:'Объяснение',
    condition:'Условие',
    actual:'Факт',
    effect:'Эффект',
    severity:'Серьёзность',
    before:'До',
    after:'После',
    change:'Изменение',
    kernelRules:'Kernel Authority',
    gateRules:'ActionGate',
    pass:'пройдено',
    fail:'ошибка',
    applied:'применено',
    denied:'запрещено',
    allowed:'разрешено',
    composer:'Сборщик экрана',
    blocks:'Блоки экрана',
    show:'показать',
    hide:'скрыть',
    openDetached:'открыть отдельно',
    workspaceProfiles:'Рабочие раскладки',
    workspaceTabs:'Рабочие сцены',
    newScene:'Новая сцена',
    closeWindow:'Закрыть окно',
    renameScene:'Переименовать',
    duplicateScene:'Дублировать',
    exportScene:'Экспорт',
    importScene:'Импорт',
    saveWorkspace:'Сохранить рабочую область',
    loadWorkspace:'Загрузить рабочую область',
    deleteWorkspace:'Удалить рабочую область',
    showAll:'Показать все блоки',
    hideAll:'Скрыть все блоки',
    layoutNote:'Сохраняются видимость блоков, позиции, размеры, свёрнутость, тема, масштаб и плотность.',
    waiting:'ожидание'
  },
  en: {
    title:'Observable Core Machine',
    subtitle:'Observable computational machine of the core',
    settings:'Settings',
    compact:'Compact mode',
    reset:'Reset layout',
    mock:'MOCK ComputationTrace · Workspace Modes',
    scenario:'Scenario',
    provenance:'Provenance',
    marketIntegrity:'Market Integrity',
    replayRevision:'Replay / Revision',
    mode:'Workspace Mode',
    customMode:'Custom layout',
    overviewMode:'Overview',
    computeMode:'Compute',
    rulesMode:'Rules',
    stateMode:'State',
    auditMode:'Audit',
    machinePulse:'Machine Pulse',
    activeEvent:'Active Event',
    rawTrace:'Raw Trace',
    pipeline:'Processing Pipeline',
    miniVerdict:'Mini Verdict',
    steps:'Computation Steps',
    formulas:'Formula Inspector',
    diff:'Snapshot Diff',
    rules:'Rule Engine View',
    gateTrace:'Gate / Ledger Trace',
    machineStatus:'Machine Status',
    trustState:'Local core trust',
    runtimeMode:'Runtime Mode',
    trading:'Trading Allowed',
    revision:'Revision',
    lastEvent:'Last Event',
    lastTransition:'Last Transition',
    mainReason:'Main Reason',
    yes:'yes', no:'no',
    result:'Result',
    action:'Action',
    trust:'Local core trust',
    reason:'Reason',
    ledger:'Ledger record',
    quarantine:'Quarantine record',
    save:'Save',
    load:'Load',
    del:'Delete',
    layout:'Window layout',
    theme:'Theme',
    density:'Density',
    scale:'Scale',
    radius:'Radius',
    uiFont:'Interface font',
    monoFont:'Code / number font',
    saturation:'Saturation',
    contrast:'Contrast',
    glow:'Glow',
    hue:'Accent hue',
    panelOpacity:'Glass density',
    gridPower:'Grid power',
    headerPower:'Header metal',
    shadowDepth:'Shadow depth',
    scanlines:'Scanlines',
    noise:'Glass noise',
    textSharpness:'Text sharpness',
    hotkeys:'Hotkeys',
    action:'Action',
    shortcut:'Shortcut',
    clickToRecord:'click and press keys',
    resetHotkeys:'Reset hotkeys',
    blockColors:'Block colors',
    standard:'Reset default layout',
    close:'×',
    inputs:'Inputs',
    expression:'Expression',
    intermediate:'Intermediate values',
    threshold:'Threshold',
    formulaResult:'Result',
    explanation:'Explanation',
    condition:'Condition',
    actual:'Actual',
    effect:'Effect',
    severity:'Severity',
    before:'Before',
    after:'After',
    change:'Change',
    kernelRules:'Kernel Authority',
    gateRules:'ActionGate',
    pass:'pass',
    fail:'fail',
    applied:'applied',
    denied:'denied',
    allowed:'allowed',
    composer:'Workspace Tabs',
    blocks:'Screen blocks',
    show:'show',
    hide:'hide',
    openDetached:'open detached',
    workspaceProfiles:'Workspace profiles',
    workspaceTabs:'Workspace tabs',
    newScene:'New scene',
    closeScene:'Close scene',
    renameScene:'Rename scene',
    duplicateScene:'Duplicate scene',
    exportScene:'Export scene',
    importScene:'Import scene',
    saveWorkspace:'Save workspace',
    loadWorkspace:'Load workspace',
    deleteWorkspace:'Delete workspace',
    showAll:'Show all blocks',
    hideAll:'Hide all blocks',
    layoutNote:'Visibility, positions, sizes, collapsed state, theme, scale and density are saved.',
    waiting:'waiting',
    closeWindow:'Close window'
  }
};

const themes = [
  ['aurora','Aurora Machine'],
  ['core','Core Dark'],
  ['deepsea','Deep Sea'],
  ['volcano','Volcano Risk'],
  ['day','Day Pro Contrast'],
  ['dracula','Dracula'],
  ['nord','Nord'],
  ['tokyo','Tokyo Night'],
  ['gruvbox','Gruvbox Dark'],
  ['monokai','Monokai Pro']
];

const uiFonts = [
  ['system','System UI'],
  ['inter','Inter / Modern Sans'],
  ['segoe','Segoe UI'],
  ['arial','Arial'],
  ['trebuchet','Trebuchet MS'],
  ['verdana','Verdana'],
  ['mono','Mono UI']
];

const monoFonts = [
  ['jetbrains','JetBrains Mono'],
  ['fira','Fira Code'],
  ['consolas','Consolas'],
  ['sfmono','SF Mono'],
  ['monaco','Monaco'],
  ['monospace','System Monospace']
];

const blockColorPalette = ['auto','cyan','sky','blue','indigo','violet','purple','pink','rose','red','orange','amber','yellow','lime','green','emerald','teal','slate','white'];

const blockColorVars = {
  auto: undefined,
  cyan: '#22d3ee',
  sky: '#38bdf8',
  blue: '#60a5fa',
  indigo: '#818cf8',
  violet: '#8b5cf6',
  purple: '#a78bfa',
  pink: '#f472b6',
  rose: '#fb7185',
  red: '#ef4444',
  orange: '#fb923c',
  amber: '#fbbf24',
  yellow: '#fde047',
  lime: '#a3e635',
  green: '#22c55e',
  emerald: '#34d399',
  teal: '#2dd4bf',
  slate: '#94a3b8',
  white: '#e5e7eb'
};

const densities = [
  ['comfort','Comfort'],
  ['compact','Compact'],
  ['ultra','Ultra']
];

function statusClass(s){
  if(['pass','applied','allowed'].includes(s)) return s;
  if(['fail','denied'].includes(s)) return s;
  return 'waiting';
}
function getLabel(obj, lang){
  if(!obj) return '';
  return lang==='ru' ? (obj.labelRu || obj.summaryRu || obj.resultRu || obj.effectRu || obj.messageRu || obj.label || obj.summary || obj.result || obj.effect || obj.message || '') : (obj.label || obj.summary || obj.result || obj.effect || obj.message || obj.labelRu || obj.summaryRu || obj.resultRu || obj.effectRu || obj.messageRu || '');
}
function safeStringify(value, space=2){
  const seen = new WeakSet();
  try{
    return JSON.stringify(value, (key, val)=>{
      if(typeof val === 'object' && val !== null){
        if(seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    }, space);
  }catch(error){
    return `[Unserializable: ${error?.message || 'unknown'}]`;
  }
}

function pretty(v){
  if(v === null) return 'null';
  if(v === undefined) return '—';
  if(typeof v === 'boolean') return String(v);
  if(typeof v === 'object') return safeStringify(v,2);
  return String(v);
}
function safeStorage(){
  try{
    const s=window.localStorage;
    const probe='__ocm_probe__';
    s.setItem(probe,'1'); s.removeItem(probe);
    return s;
  }catch{return null}
}
function useLocalState(key, initial){
  const [v,setV]=useState(()=>{
    try{const s=safeStorage(); const raw=s?.getItem(key); return raw?JSON.parse(raw):initial}catch{return initial}
  });
  useEffect(()=>{try{safeStorage()?.setItem(key,JSON.stringify(v))}catch{}},[key,v]);
  return [v,setV];
}
/** Mirrors localStorage on change; initial must be the resolved bootstrap (RC4-C bundle wins over legacy keys). */
function usePersistedState(key, initial){
  const [v,setV]=useState(initial);
  useEffect(()=>{try{safeStorage()?.setItem(key,JSON.stringify(v))}catch{}},[key,v]);
  return [v,setV];
}
function readLegacyJson(key, fallback){
  try{
    const raw=safeStorage()?.getItem(key);
    if(raw===null || raw===undefined || raw==='') return fallback;
    return JSON.parse(raw);
  }catch{return fallback}
}
const RC4C_LAYOUT_SCHEMA_VERSION='rc4-c-layout-v1';
const RC4C_LAYOUT_STORAGE_KEY='mbg.rc4c.layout.v1';

function readRc4cLayoutState(){
  try{
    const raw=safeStorage()?.getItem(RC4C_LAYOUT_STORAGE_KEY);
    if(!raw) return null;
    const parsed=JSON.parse(raw);
    if(!parsed || parsed.schemaVersion!==RC4C_LAYOUT_SCHEMA_VERSION) return null;
    return parsed;
  }catch{return null}
}
function sanitizeLayoutTabs(tabs){
  const defaults=makeDefaultWorkspaceTabs();
  if(!Array.isArray(tabs) || tabs.length===0) return defaults;
  return tabs.map((tab,idx)=>({
    id:String(tab?.id || `ws_${idx}_${Date.now()}`),
    name:String(tab?.name || `Scene ${idx+1}`),
    pinned:!!tab?.pinned,
    payload:tab?.payload || {}
  }));
}
function panelsToLayout(panels){
  const d=defaultLayout();
  const out={};
  Object.keys(d).forEach(id=>{
    const p=panels?.[id] || {};
    out[id]={x:p.x, y:p.y, w:p.w, h:p.h};
  });
  return sanitizeLayout(out);
}
function panelsToVisible(panels){
  const out=defaultVisible();
  if(panels && typeof panels==='object'){
    Object.keys(out).forEach(id=>{
      if(panels[id] && typeof panels[id].visible==='boolean') out[id]=panels[id].visible;
    });
  }
  return out;
}
function panelsToCollapsed(panels){
  const out={};
  if(panels && typeof panels==='object'){
    Object.keys(defaultVisible()).forEach(id=>{
      if(panels[id] && typeof panels[id].collapsed==='boolean') out[id]=panels[id].collapsed;
    });
  }
  return out;
}
function buildRc4cLayoutState(state){
  const layout=sanitizeLayout(state.layout);
  const visible=sanitizeVisible(state.visibleMap);
  const panels=Object.fromEntries(allWindowIds.map(id=>[
    id,
    {
      ...(layout[id] || defaultLayout()[id]),
      visible: visible[id]!==false,
      collapsed: !!state.collapsedMap?.[id],
      z: Number(state.z?.[id] || 0)
    }
  ]));
  return {
    schemaVersion:RC4C_LAYOUT_SCHEMA_VERSION,
    savedAt:new Date().toISOString(),
    activeTabId:state.activeWorkspaceTab,
    openTabs:state.workspaceTabs,
    panels,
    theme:{
      name:state.theme,
      density:state.density,
      scale:String(state.scale),
      radius:String(state.radius),
      uiFont:state.uiFont,
      monoFont:state.monoFont,
      saturation:String(state.saturation),
      contrast:String(state.contrast),
      glow:String(state.glow),
      hue:String(state.hue),
      panelOpacity:String(state.panelOpacity),
      gridPower:String(state.gridPower),
      headerPower:String(state.headerPower),
      shadowDepth:String(state.shadowDepth),
      scanlines:String(state.scanlines),
      noise:String(state.noise),
      textSharpness:String(state.textSharpness),
      blockAccents:state.blockAccents || {}
    },
    language:state.lang || 'ru',
    compactMode:!!state.compact,
    workspaceMode:state.workspaceMode || 'custom',
    adapterMode:state.adapterMode || 'mock',
    selectedScenario:state.selectedScenario || 'HEALTHY_TRUSTED_READY',
    resetMode:'manual-only'
  };
}
function saveRc4cLayoutState(state){
  try{safeStorage()?.setItem(RC4C_LAYOUT_STORAGE_KEY, JSON.stringify(buildRc4cLayoutState(state)))}catch{}
}
function clearRc4cLayoutState(){
  try{safeStorage()?.removeItem(RC4C_LAYOUT_STORAGE_KEY)}catch{}
}

function defaultLayout(){
  const W = Math.max(1280, window.innerWidth || 1280);
  return {
    coreOverview:{x:8,y:8,w:520,h:320},
    liveStream:{x:536,y:8,w:430,h:320},
    operatorTruth:{x:974,y:8,w:420,h:320},
    pulse:{x:8,y:340,w:230,h:260},
    event:{x:246,y:340,w:300,h:260},
    pipeline:{x:554,y:340,w:560,h:260},
    verdict:{x:1122,y:340,w:260,h:260},
    raw:{x:8,y:280,w:538,h:300},
    steps:{x:554,y:280,w:400,h:300},
    formulas:{x:962,y:280,w:420,h:300},
    rules:{x:8,y:590,w:430,h:300},
    diff:{x:446,y:590,w:430,h:300},
    gateTrace:{x:884,y:590,w:498,h:300},
    revision:{x:8,y:900,w:300,h:260},
    marketIntegrity:{x:316,y:900,w:330,h:260},
    provenance:{x:654,y:900,w:330,h:260},
    recovery:{x:992,y:900,w:390,h:260},
    replay:{x:8,y:1170,w:430,h:260},
    failure:{x:446,y:1170,w:936,h:260}
  };
}
function sanitizeLayout(l){
  const d=defaultLayout();
  const out={};
  Object.keys(d).forEach(id=>{
    const src=(l&&l[id])||d[id];
    const w=Number(src.w), h=Number(src.h), x=Number(src.x), y=Number(src.y);
    out[id]={
      x:Number.isFinite(x)?Math.max(0,Math.round(x)):d[id].x,
      y:Number.isFinite(y)?Math.max(0,Math.round(y)):d[id].y,
      w:Number.isFinite(w)&&w>=140?Math.round(w):d[id].w,
      h:Number.isFinite(h)&&h>=80?Math.round(h):d[id].h
    };
  });
  const tooSmall=Object.values(out).filter(v=>v.w<180||v.h<80).length;
  if(tooSmall>=Math.max(2,Math.floor(Object.keys(d).length/2))) return d;
  return out;
}
function stripLayout(l){ return sanitizeLayout(l); }

function clampSize(v,min,max){ return Math.max(min, Math.min(max, Math.round(v))); }
function makeCollapsedRail(ids, startX=8, y=8){
  const out={};
  ids.forEach((id,i)=>{ out[id]={x:startX+i*150,y,w:142,h:120}; });
  return out;
}
const allWindowIds=['coreOverview','liveStream','operatorTruth','pulse','event','pipeline','raw','steps','formulas','rules','diff','verdict','gateTrace','revision','marketIntegrity','provenance','recovery','replay','failure'];

const windowMeta = {
  coreOverview:{ru:'00 Пульт ядра',en:'00 Core Overview'},
  liveStream:{ru:'17 Живой поток',en:'17 Live Market Stream'},
  operatorTruth:{ru:'Правда для оператора',en:'Operator Truth Summary'},
  pulse:{ru:'Пульс машины',en:'Machine Pulse'},
  event:{ru:'Активное событие',en:'Active Event'},
  pipeline:{ru:'Конвейер обработки',en:'Processing Pipeline'},
  raw:{ru:'Сырой след',en:'Raw Trace'},
  steps:{ru:'Шаги вычисления',en:'Computation Steps'},
  formulas:{ru:'Инспектор формул',en:'Formula Inspector'},
  rules:{ru:'Правила ядра',en:'Rule Engine View'},
  diff:{ru:'Разница снимка',en:'Snapshot Diff'},
  verdict:{ru:'Мини-вердикт',en:'Mini Verdict'},
  gateTrace:{ru:'След вердикта',en:'Gate Ledger Trace'},
  revision:{ru:'Линия ревизий',en:'Revision Timeline'},
  marketIntegrity:{ru:'Целостность рынка',en:'Market Integrity Panel'},
  provenance:{ru:'Происхождение',en:'Provenance Panel'},
  recovery:{ru:'Восстановление',en:'Recovery Panel'},
  replay:{ru:'Панель повтора',en:'Replay Panel'},
  failure:{ru:'Матрица отказов',en:'Failure Matrix / Failure Visualization'}
};
function defaultVisible(){ return Object.fromEntries(allWindowIds.map(id=>[id,true])); }
function sanitizeVisible(v){ return {...defaultVisible(), ...(v||{})}; }

const defaultHotkeys={
  scene1:'F1',scene2:'F2',scene3:'F3',scene4:'F4',scene5:'F5',scene6:'F6',scene7:'F7',scene8:'F8',scene9:'F9',scene10:'F10',scene11:'F11',scene12:'F12',
  newScene:'Ctrl+T',closeScene:'Ctrl+W',nextScene:'Ctrl+Tab',prevScene:'Ctrl+Shift+Tab',saveScene:'Ctrl+S',settings:'Ctrl+,',hotkeys:'Ctrl+/',toggleCompact:'Ctrl+Alt+C',resetLayout:'Ctrl+Alt+R',overviewMode:'Alt+1',computeMode:'Alt+2',rulesMode:'Alt+3',auditMode:'Alt+4',showAll:'Ctrl+Alt+A',hideAll:'Ctrl+Alt+H'
};
function normalizeShortcut(e){
  const key=e.key===' ' ? 'Space' : e.key.length===1 ? e.key.toUpperCase() : e.key;
  const parts=[];
  if(e.ctrlKey) parts.push('Ctrl');
  if(e.altKey) parts.push('Alt');
  if(e.shiftKey) parts.push('Shift');
  if(e.metaKey) parts.push('Meta');
  if(!['Control','Shift','Alt','Meta'].includes(key)) parts.push(key);
  return parts.join('+');
}
function shortcutMatches(e, shortcut){
  if(!shortcut) return false;
  const parts=String(shortcut).split('+').map(x=>x.trim()).filter(Boolean);
  const key=parts[parts.length-1] || '';
  const mods=new Set(parts.slice(0,-1).map(x=>x.toLowerCase()));
  const eventKey=(e.key===' ' ? 'Space' : e.key.length===1 ? e.key.toUpperCase() : e.key);
  return eventKey.toLowerCase()===key.toLowerCase()
    && !!e.ctrlKey===mods.has('ctrl')
    && !!e.altKey===mods.has('alt')
    && !!e.shiftKey===mods.has('shift')
    && !!e.metaKey===mods.has('meta');
}
const hotkeyLabels=[
  ['scene1',{ru:'Сцена 1',en:'Scene 1'}],['scene2',{ru:'Сцена 2',en:'Scene 2'}],['scene3',{ru:'Сцена 3',en:'Scene 3'}],['scene4',{ru:'Сцена 4',en:'Scene 4'}],
  ['scene5',{ru:'Сцена 5',en:'Scene 5'}],['scene6',{ru:'Сцена 6',en:'Scene 6'}],['scene7',{ru:'Сцена 7',en:'Scene 7'}],['scene8',{ru:'Сцена 8',en:'Scene 8'}],
  ['scene9',{ru:'Сцена 9',en:'Scene 9'}],['scene10',{ru:'Сцена 10',en:'Scene 10'}],['scene11',{ru:'Сцена 11',en:'Scene 11'}],['scene12',{ru:'Сцена 12',en:'Scene 12'}],
  ['newScene',{ru:'Новая сцена',en:'New scene'}],['closeScene',{ru:'Закрыть сцену',en:'Close scene'}],['nextScene',{ru:'Следующая сцена',en:'Next scene'}],['prevScene',{ru:'Предыдущая сцена',en:'Previous scene'}],['saveScene',{ru:'Сохранить сцену',en:'Save scene'}],['settings',{ru:'Открыть настройки',en:'Open settings'}],['hotkeys',{ru:'Открыть горячие клавиши',en:'Open hotkeys'}],['toggleCompact',{ru:'Компактный режим',en:'Compact mode'}],['resetLayout',{ru:'Сбросить раскладку',en:'Reset layout'}],['overviewMode',{ru:'Режим обзор',en:'Overview mode'}],['computeMode',{ru:'Режим вычисления',en:'Compute mode'}],['rulesMode',{ru:'Режим правила',en:'Rules mode'}],['auditMode',{ru:'Режим след',en:'Audit mode'}],['showAll',{ru:'Показать все блоки',en:'Show all blocks'}],['hideAll',{ru:'Скрыть все блоки',en:'Hide all blocks'}]
];

function profilePayload({layout,collapsedMap,visibleMap,theme,density,scale,radius,workspaceMode,uiFont,monoFont,saturation,contrast,glow,hue,panelOpacity,gridPower,headerPower,shadowDepth,scanlines,noise,textSharpness,blockAccents}){
  return {
    layout:stripLayout(layout),
    collapsedMap:{...(collapsedMap||{})},
    visibleMap:sanitizeVisible(visibleMap),
    theme,density,scale,radius,workspaceMode,uiFont,monoFont,saturation,contrast,glow,hue,panelOpacity,gridPower,headerPower,shadowDepth,scanlines,noise,textSharpness,
    blockAccents:{...(blockAccents||{})}
  };
}

function payloadFromPreset(mode, visibleIds=null, collapsedIds=[]){
  const preset=workspacePreset(mode);
  const visible=visibleIds ? Object.fromEntries(allWindowIds.map(id=>[id,visibleIds.includes(id)])) : defaultVisible();
  const collapsed={...(preset.collapsed||{})};
  collapsedIds.forEach(id=>collapsed[id]=true);
  return profilePayload({
    layout:preset.layout,
    collapsedMap:collapsed,
    visibleMap:visible,
    theme:'aurora',
    density:'comfort',
    scale:'1',
    radius:'16',
    uiFont:'system',
    monoFont:'consolas',
    saturation:'1',
    contrast:'1',
    glow:'1',
    blockAccents:{},
    workspaceMode:mode
  });
}

function makeDefaultWorkspaceTabs(){
  return [
    {id:'overview', name:'Overview', pinned:true, payload:payloadFromPreset('overview', ['coreOverview','liveStream','operatorTruth','pulse','event','pipeline','verdict','failure'])},
    {id:'compute', name:'Compute', pinned:true, payload:payloadFromPreset('compute', ['pipeline','steps','formulas','diff','event'])},
    {id:'rules', name:'Rules', pinned:true, payload:payloadFromPreset('rules', ['rules','gateTrace','diff','formulas'])},
    {id:'audit', name:'Audit', pinned:true, payload:payloadFromPreset('audit', ['gateTrace','raw','verdict','revision'])},
    {id:'market', name:'Market Integrity', pinned:true, payload:payloadFromPreset('overview', ['coreOverview','liveStream','marketIntegrity','pulse','event','pipeline'])},
    {id:'provenance', name:'Provenance', pinned:true, payload:payloadFromPreset('overview', ['provenance','raw','revision','gateTrace'])},
    {id:'recovery', name:'Recovery', pinned:true, payload:payloadFromPreset('overview', ['recovery','failure','pipeline','verdict'])},
    {id:'replay', name:'Replay', pinned:true, payload:payloadFromPreset('overview', ['replay','revision','diff','raw'])},
    {id:'integrity', name:'Integrity / Failure', pinned:true, payload:payloadFromPreset('overview', ['failure','marketIntegrity','provenance','recovery'])},
    {id:'custom', name:'My Kernel', pinned:false, payload:profilePayload({layout:defaultLayout(),collapsedMap:{},visibleMap:defaultVisible(),theme:'aurora',density:'comfort',scale:'1',radius:'16',workspaceMode:'custom',hue:'190',panelOpacity:'0.94',gridPower:'1',headerPower:'1'})}
  ];
}

/**
 * Single hydration path: valid `mbg.rc4c.layout.v1` (rc4-c-layout-v1) overrides legacy `ocm_*` keys
 * so Ctrl+F5 cannot resurrect stale tabs/layout from mirrors that diverged from the bundle.
 */
function buildWorkspaceBootstrap(){
  const rc4=readRc4cLayoutState();
  if(rc4 && rc4.schemaVersion===RC4C_LAYOUT_SCHEMA_VERSION){
    const th=rc4.theme||{};
    const panels=rc4.panels && typeof rc4.panels==='object' ? rc4.panels : null;
    const tabs=sanitizeLayoutTabs(rc4.openTabs);
    let active=typeof rc4.activeTabId==='string' ? rc4.activeTabId : 'overview';
    if(!tabs.some(t=>t.id===active)) active=tabs[0]?.id || 'overview';
    return {
      source:'rc4c',
      layout:panels ? panelsToLayout(panels) : defaultLayout(),
      collapsedMap:panels ? panelsToCollapsed(panels) : {},
      visibleMap:panels ? panelsToVisible(panels) : defaultVisible(),
      z:Object.fromEntries(allWindowIds.map(id=>[id, Number(panels?.[id]?.z || 0)])),
      workspaceTabs:tabs,
      activeWorkspaceTab:active,
      compact:!!rc4.compactMode,
      storedLang:rc4.language==='en' ? 'en' : 'ru',
      workspaceMode:rc4.workspaceMode || 'custom',
      adapterMode:rc4.adapterMode || 'mock',
      selectedScenario:rc4.selectedScenario || 'HEALTHY_TRUSTED_READY',
      theme:th.name || 'aurora',
      density:th.density || 'comfort',
      scale:String(th.scale != null ? th.scale : '1'),
      radius:String(th.radius != null ? th.radius : '2'),
      uiFont:th.uiFont || 'system',
      monoFont:th.monoFont || 'consolas',
      saturation:String(th.saturation != null ? th.saturation : '1'),
      contrast:String(th.contrast != null ? th.contrast : '1'),
      glow:String(th.glow != null ? th.glow : '1'),
      hue:String(th.hue != null ? th.hue : '0'),
      panelOpacity:String(th.panelOpacity != null ? th.panelOpacity : '0.94'),
      gridPower:String(th.gridPower != null ? th.gridPower : '1'),
      headerPower:String(th.headerPower != null ? th.headerPower : '1'),
      shadowDepth:String(th.shadowDepth != null ? th.shadowDepth : '1'),
      scanlines:String(th.scanlines != null ? th.scanlines : '0'),
      noise:String(th.noise != null ? th.noise : '0'),
      textSharpness:String(th.textSharpness != null ? th.textSharpness : '1'),
      blockAccents:th.blockAccents && typeof th.blockAccents==='object' ? th.blockAccents : {}
    };
  }
  const layoutRaw=readLegacyJson('ocm_v081_layout', null);
  const layout=layoutRaw && typeof layoutRaw==='object' ? sanitizeLayout(layoutRaw) : defaultLayout();
  const collapsedRaw=readLegacyJson('ocm_v081_collapsed', null);
  const collapsedMap=collapsedRaw && typeof collapsedRaw==='object' ? collapsedRaw : {};
  const visibleRaw=readLegacyJson('ocm_v081_visible', null);
  const visibleMap=visibleRaw && typeof visibleRaw==='object' ? sanitizeVisible(visibleRaw) : defaultVisible();
  const tabs=sanitizeLayoutTabs(readLegacyJson('ocm_v081_workspace_tabs', null));
  let active=readLegacyJson('ocm_v081_active_workspace_tab', 'overview');
  if(typeof active!=='string' || !tabs.some(t=>t.id===active)) active=tabs[0]?.id || 'overview';
  return {
    source:'legacy',
    layout,
    collapsedMap,
    visibleMap,
    z:Object.fromEntries(allWindowIds.map(id=>[id, 0])),
    workspaceTabs:tabs,
    activeWorkspaceTab:active,
    compact:!!readLegacyJson('ocm_rc4c_compact', false),
    storedLang:readLegacyJson('ocm_v081_lang', 'ru') === 'en' ? 'en' : 'ru',
    workspaceMode:readLegacyJson('ocm_v081_workspace_mode', 'custom'),
    adapterMode:readLegacyJson('ocm_v081_adapter_mode', 'mock'),
    selectedScenario:readLegacyJson('ocm_v081_scenario', 'HEALTHY_TRUSTED_READY'),
    theme:readLegacyJson('ocm_v057_theme', 'aurora'),
    density:readLegacyJson('ocm_v057_density', 'comfort'),
    scale:String(readLegacyJson('ocm_v057_scale', '1')),
    radius:String(readLegacyJson('ocm_v057_radius', '2')),
    uiFont:readLegacyJson('ocm_v075_ui_font', 'system'),
    monoFont:readLegacyJson('ocm_v075_mono_font', 'consolas'),
    saturation:String(readLegacyJson('ocm_v075_saturation', '1')),
    contrast:String(readLegacyJson('ocm_v075_contrast', '1')),
    glow:String(readLegacyJson('ocm_v075_glow', '1')),
    hue:String(readLegacyJson('ocm_v092_hue', '0')),
    panelOpacity:String(readLegacyJson('ocm_v089_panel_opacity', '0.94')),
    gridPower:String(readLegacyJson('ocm_v089_grid_power', '1')),
    headerPower:String(readLegacyJson('ocm_v089_header_power', '1')),
    shadowDepth:String(readLegacyJson('ocm_v090_shadow_depth', '1')),
    scanlines:String(readLegacyJson('ocm_v090_scanlines', '0')),
    noise:String(readLegacyJson('ocm_v090_noise', '0')),
    textSharpness:String(readLegacyJson('ocm_v090_text_sharpness', '1')),
    blockAccents:readLegacyJson('ocm_v075_block_accents', {}) || {}
  };
}

function WorkspaceTabs({tabs,activeId,onSelect,onAdd,onRename,onDuplicate,onDelete,onExport,onImport,lang}){
  const t=T[lang];
  const scrollRef=useRef(null);
  useEffect(()=>{
    const el=scrollRef.current;
    if(!el) return;
    const active=el.querySelector('.workspace-tab-wrap.active');
    if(active) active.scrollIntoView({block:'nearest',inline:'nearest'});
  },[activeId,tabs.length]);
  function wheelTabs(e){
    const el=scrollRef.current;
    if(!el) return;
    if(e.shiftKey || Math.abs(e.deltaX)>Math.abs(e.deltaY)){
      el.scrollLeft += e.deltaX || e.deltaY;
    }else{
      el.scrollLeft += e.deltaY;
    }
    e.preventDefault();
  }
  return <div className="workspace-tabs" title={t.workspaceTabs} onWheel={wheelTabs}>
    <div className="tabs-scroll" ref={scrollRef} onWheel={wheelTabs}>
      {tabs.map((tab,index)=><div
        key={tab.id}
        className={'workspace-tab-wrap '+(tab.id===activeId?'active':'')+(tab.pinned?' pinned':'')}
        title={(lang==='ru'?'Открыть сцену: ':'Open scene: ')+tab.name}
      >
        <button
          className="workspace-tab"
          onClick={()=>onSelect(tab.id)}
          onDoubleClick={()=>onRename(tab.id)}
        >
          <span className="tab-index">{String(index+1).padStart(2,'0')}</span>
          <span className="tab-label">{tab.pinned?'● ':''}{tab.name}</span>{index<12 && <span className="hotkey-hint">F{index+1}</span>}
        </button>
        <button
          className="workspace-tab-close"
          onClick={(e)=>{e.stopPropagation(); onDelete(tab.id)}}
          title={lang==='ru'?'Удалить сцену':'Delete scene'}
        >
          ×
        </button>
      </div>)}
    </div>
    <div className="tabs-tools">
      <button className="tab-tool" onClick={onAdd} title={t.newScene}>＋</button>
      <button className="tab-tool" onClick={()=>onRename(activeId)} title={t.renameScene}>✎</button>
      <button className="tab-tool" onClick={()=>onDuplicate(activeId)} title={t.duplicateScene}>⧉</button>
      <button className="tab-tool danger" onClick={()=>onDelete(activeId)} title={t.del}>🗑</button>
      <button className="tab-tool" onClick={()=>onExport(activeId)} title={t.exportScene}>⇩</button>
      <button className="tab-tool" onClick={onImport} title={t.importScene}>⇧</button>
    </div>
  </div>
}

function workspacePreset(mode){
  const W=Math.max(1100,window.innerWidth), H=Math.max(650,window.innerHeight-92);
  const gap=10;
  const railY=8;
  const bottomY=Math.max(420,H-54);
  const base=defaultLayout();

  if(mode==='overview'){
    const layout={
      ...base,
      pulse:{x:8,y:8,w:250,h:H-80},
      event:{x:268,y:8,w:280,h:260},
      pipeline:{x:558,y:8,w:clampSize(W-900,620,980),h:230},
      verdict:{x:Math.min(W-340,558+clampSize(W-900,620,980)+gap),y:8,w:320,h:230},
      gateTrace:{x:558,y:250,w:clampSize(W-900,620,980),h:300},
      diff:{x:Math.min(W-340,558+clampSize(W-900,620,980)+gap),y:250,w:320,h:300},
      raw:{x:268,y:280,w:280,h:270},
      steps:{x:8,y:bottomY,w:142,h:120},
      formulas:{x:160,y:bottomY,w:142,h:120},
      rules:{x:312,y:bottomY,w:142,h:120}
    };
    return {layout:sanitizeLayout(layout), collapsed:{steps:true,formulas:true,rules:true,raw:true}};
  }

  if(mode==='compute'){
    const left=8, mid=320, right=Math.max(1120,W-430);
    const layout={
      ...base,
      event:{x:left,y:8,w:300,h:300},
      pipeline:{x:mid,y:8,w:Math.max(760,W-760),h:200},
      formulas:{x:mid,y:220,w:Math.max(760,W-760),h:360},
      steps:{x:right,y:8,w:410,h:H-80},
      pulse:{x:left,y:320,w:300,h:260},
      verdict:{x:left,y:bottomY,w:142,h:120},
      diff:{x:left+152,y:bottomY,w:142,h:120},
      rules:{x:left+304,y:bottomY,w:142,h:120},
      gateTrace:{x:left+456,y:bottomY,w:142,h:120},
      raw:{x:left+608,y:bottomY,w:142,h:120}
    };
    return {layout:sanitizeLayout(layout), collapsed:{verdict:true,diff:true,rules:true,gateTrace:true,raw:true}};
  }

  if(mode==='rules'){
    const layout={
      ...base,
      pulse:{x:8,y:8,w:250,h:260},
      pipeline:{x:268,y:8,w:700,h:190},
      rules:{x:268,y:210,w:Math.max(760,W-710),h:H-285},
      gateTrace:{x:Math.max(1040,W-430),y:8,w:420,h:H-80},
      verdict:{x:8,y:280,w:250,h:220},
      event:{x:8,y:bottomY,w:142,h:120},
      raw:{x:160,y:bottomY,w:142,h:120},
      formulas:{x:312,y:bottomY,w:142,h:120},
      steps:{x:464,y:bottomY,w:142,h:120},
      diff:{x:616,y:bottomY,w:142,h:120}
    };
    return {layout:sanitizeLayout(layout), collapsed:{event:true,raw:true,formulas:true,steps:true,diff:true}};
  }

  if(mode==='state'){
    const layout={
      ...base,
      diff:{x:8,y:8,w:Math.max(760,W-610),h:360},
      raw:{x:8,y:380,w:Math.max(520,W-900),h:H-455},
      event:{x:Math.max(540,W-590),y:380,w:280,h:H-455},
      pulse:{x:Math.max(830,W-300),y:8,w:280,h:360},
      pipeline:{x:8,y:bottomY,w:142,h:120},
      steps:{x:160,y:bottomY,w:142,h:120},
      formulas:{x:312,y:bottomY,w:142,h:120},
      rules:{x:464,y:bottomY,w:142,h:120},
      gateTrace:{x:616,y:bottomY,w:142,h:120},
      verdict:{x:768,y:bottomY,w:142,h:120}
    };
    return {layout:sanitizeLayout(layout), collapsed:{pipeline:true,steps:true,formulas:true,rules:true,gateTrace:true,verdict:true}};
  }

  if(mode==='audit'){
    const layout={
      ...base,
      gateTrace:{x:8,y:8,w:Math.max(680,W-620),h:440},
      verdict:{x:Math.max(700,W-600),y:8,w:280,h:220},
      rules:{x:Math.max(990,W-310),y:8,w:300,h:H-80},
      pulse:{x:Math.max(700,W-600),y:240,w:280,h:208},
      diff:{x:8,y:460,w:Math.max(680,W-620),h:H-535},
      event:{x:8,y:bottomY,w:142,h:120},
      raw:{x:160,y:bottomY,w:142,h:120},
      pipeline:{x:312,y:bottomY,w:142,h:120},
      steps:{x:464,y:bottomY,w:142,h:120},
      formulas:{x:616,y:bottomY,w:142,h:120}
    };
    return {layout:sanitizeLayout(layout), collapsed:{event:true,raw:true,pipeline:true,steps:true,formulas:true}};
  }

  return {layout:sanitizeLayout(base), collapsed:{}};
}


function Window({id,title,children,layout,setLayout,z,setZ,compact,collapsedMap,setCollapsedMap,zCounter,blockAccents,setBlockAccents,setVisibleMap,lang}){
  const ref=useRef(null);
  const t=T[lang] || T.ru;
  const l=layout[id] || defaultLayout()[id] || {x:20,y:20,w:300,h:200};
  const isCollapsed=!!compact || !!collapsedMap[id];
  const [drag,setDrag]=useState(null);
  const [colorOpen,setColorOpen]=useState(false);
  const resizing=useRef(false);
  const lastSize=useRef({w:l.w,h:l.h});

  function update(part){
    setLayout(prev=>{
      const base=prev[id] || l;
      const next={...base,...part};
      if(next.w !== undefined) next.w=clampSize(next.w, 260, 2400);
      if(next.h !== undefined) next.h=clampSize(next.h, 140, 1800);
      return {...prev,[id]:next};
    });
  }
  function top(){
    const next=(zCounter.current||100)+1;
    zCounter.current=next;
    setZ(prev=>({...prev,[id]:next}));
  }
  function saveRealSize(){
    const el=ref.current;
    if(!el || isCollapsed || compact) return;
    const r=el.getBoundingClientRect();
    const w=Math.round(r.width), h=Math.round(r.height);
    if(w>=260 && h>=140 && (Math.abs(w-lastSize.current.w)>1 || Math.abs(h-lastSize.current.h)>1)){
      lastSize.current={w,h};
      update({w,h});
    }
  }

  useEffect(()=>{
    const onMove=e=>{
      if(!drag) return;
      const nx=Math.max(0,drag.ox+e.clientX-drag.sx);
      const ny=Math.max(0,drag.oy+e.clientY-drag.sy);
      update({x:nx,y:ny});
    };
    const onUp=()=>{ if(drag){ setDrag(null); saveRealSize(); } };
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
    return()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp)};
  },[drag,isCollapsed,compact]);


  function cycleColor(e){
    e.stopPropagation();
    const current=blockAccents?.[id] || 'auto';
    const next=blockColorPalette[(blockColorPalette.indexOf(current)+1)%blockColorPalette.length] || 'auto';
    setBlockAccents(prev=>({...prev,[id]:next}));
  }
  const accentName=blockAccents?.[id] || 'auto';
  const accentColor=blockColorVars[accentName] || (String(accentName).startsWith('#') ? accentName : undefined);
  const style={left:l.x,top:l.y,width:l.w,height:isCollapsed?38:l.h,zIndex:z[id]||1,...(accentColor?{'--block-accent':accentColor}:{})};
  const paletteItems=blockColorPalette.map(name=>({name,color:blockColorVars[name]}));
  function setAccent(value){
    setBlockAccents(prev=>({...prev,[id]:value}));
    setColorOpen(false);
  }

  return <section
    ref={ref}
    className={'window '+(isCollapsed?'collapsed':'')}
    onPointerDownCapture={top}
    onMouseUp={saveRealSize}
    style={style}
  >
    <div className="window-header" onMouseDown={(e)=>{if(e.target.closest('button'))return;top();setDrag({sx:e.clientX,sy:e.clientY,ox:l.x,oy:l.y});}}>
      <div className="window-title">{title}</div>
      <div className="window-actions">
        <button className="wbtn close-wbtn" title={t.closeWindow || t.close} onClick={(e)=>{e.stopPropagation(); setVisibleMap?.(v=>({...sanitizeVisible(v),[id]:false}));}}>×</button>
        <div className="color-menu-wrap">
          <button className="wbtn color-wbtn" title="Block color" onClick={(e)=>{e.stopPropagation();setColorOpen(v=>!v)}}>●</button>
          {colorOpen && <div className="color-popover" onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
            <div className="color-popover-title">{lang==='ru'?'Цвет окна':'Window color'}</div>
            <div className="swatch-grid">
              {paletteItems.map(item=><button
                key={item.name}
                className={'swatch '+((blockAccents?.[id]||'auto')===item.name?'active':'')}
                title={item.name}
                style={item.color?{background:item.color}:{}}
                onClick={()=>setAccent(item.name)}
              >{item.name==='auto'?'A':''}</button>)}
            </div>
            <label className="custom-color-row">
              <span>{lang==='ru'?'Свой цвет':'Custom'}</span>
              <input type="color" value={accentColor || '#22d3ee'} onChange={e=>setBlockAccents(prev=>({...prev,[id]:e.target.value}))}/>
            </label>
          </div>}
        </div>
        <button className="wbtn" onClick={(e)=>{e.stopPropagation(); const url=new URL(location.href); url.searchParams.set('module',id); window.open(url.toString(),'OCM_'+id,'popup=yes,width=1100,height=760,left=100,top=80')}}>↗</button>
        <button className="wbtn" onClick={(e)=>{e.stopPropagation();setCollapsedMap(prev=>({...prev,[id]:!prev[id]}));}}>−</button>
      </div>
    </div>
    {!isCollapsed && <div className="window-body">{children}</div>}
  </section>
}



function blockIcon(color, status){
  const c = String(color || status || '').toLowerCase();
  if(c === 'green' || c === 'ok' || c === 'pass') return '🟢';
  if(c === 'yellow' || c === 'warning') return '🟡';
  if(c === 'red' || c === 'fail' || c === 'blocked') return '🔴';
  if(c === 'blue' || c === 'closed' || c === 'read-only') return '🔵';
  return '⚫';
}

/** RC4-D1: operator semantics — local core trust vs exchange trust vs proof (DTO values unchanged). */
function readSemanticTrustSignals(trace){
  const snapshot = trace.runtimeSnapshot || {};
  const semantic = snapshot.semantic || {};
  const exchange = semantic.exchangeTruth || {};
  const prov = semantic.provenance || {};
  const live = trace.liveStream?.status || {};
  const localState = String(snapshot.trust?.state || trace.machine?.trustState || 'UNCERTAIN');
  const proofOk = prov.exchangeProofValid === true && live.exchangeProofValid === true;
  const rawProof = live.exchangeProofStatus ?? exchange.proof ?? (proofOk ? 'valid' : 'missing');
  const proofToken = String(rawProof || 'missing').toLowerCase();
  const exTruth = String(exchange.status || prov.exchangeTruthStatus || 'unknown').toLowerCase();
  const exchangeTrustUncertain = !proofOk
    || exTruth === 'unknown'
    || exTruth === 'absent'
    || exTruth === 'missing'
    || proofToken === 'missing'
    || proofToken === 'absent';
  return { localState, proofToken, exchangeTrustUncertain, exTruth, proofOk };
}

function normalizeCoreOverview(trace){
  const live = trace.liveStream?.status || {};
  const snapshot = trace.runtimeSnapshot || {};
  const verdict = snapshot.verdict || trace.gateVerdict || {};
  const base = trace.coreOverview || {};
  const requiredBlocks = [
    ['pulse','Пульс машины'], ['event','Активное событие'], ['pipeline','Конвейер обработки'],
    ['raw','Сырой след'], ['steps','Шаги вычисления'], ['formulas','Инспектор формул'],
    ['rules','Правила ядра'], ['diff','Разница снимка'], ['verdict','Мини-вердикт'],
    ['gateTrace','След вердикта'], ['revision','Линия ревизий'], ['marketIntegrity','Целостность рынка'],
    ['provenance','Происхождение'], ['recovery','Восстановление'], ['replay','Панель повтора'],
    ['failure','Матрица отказов'], ['liveStream','Живой поток'], ['executionSurface','Поверхность исполнения']
  ];
  const incoming = Array.isArray(base.blocks) ? base.blocks : [];
  const byId = Object.fromEntries(incoming.map(b=>[b.id,b]));
  const blocks = requiredBlocks.map(([id,title])=>{
    if(byId[id]) return byId[id];
    if(id === 'liveStream') return {id,title,status: live.connectionStatus === 'connected' ? 'warning' : 'no_data', color: live.connectionStatus === 'connected' ? 'yellow' : 'black', message: live.connectionStatus === 'connected' ? 'подключён без биржевого proof' : 'не подключён'};
    if(id === 'executionSurface') return {id,title,status:'closed',color:'blue',message:'исполнение закрыто'};
    if(['verdict','marketIntegrity','provenance','failure'].includes(id)) return {id,title,status:'warning',color:'yellow',message:'действие запрещено / proof отсутствует'};
    return {id,title,status:'ok',color:'green',message:'работает'};
  });
  return {
    dto:'CoreOverviewDTO',
    overallState: base.overallState || 'SAFE_OBSERVE_ONLY',
    mode: base.mode || 'OBSERVE_ONLY',
    trustState: base.trustState || snapshot.trust?.state || 'UNCERTAIN',
    actionVerdict: base.actionVerdict || verdict.result || 'prohibited',
    executionSurface: base.executionSurface || 'closed',
    operatorRule: base.operatorRule || 'NO_PROOF_NO_ALLOW',
    liveStreamStatus: base.liveStreamStatus || (live.connectionStatus === 'connected' ? 'connected' : 'not_connected'),
    blocks
  };
}


function CoreOverviewPanel({lang='ru',trace,setVisibleMap,setZ,zCounter}){
  const dto = normalizeCoreOverview(trace);
  const sig = readSemanticTrustSignals(trace);
  const exchangeTrustValue = sig.exchangeTrustUncertain
    ? (lang==='ru'?'неопределено':'UNCERTAIN')
    : String(sig.exTruth || '').toUpperCase();
  function focusBlock(id){
    if(!id || id === 'executionSurface') return;
    setVisibleMap?.(v=>({...sanitizeVisible(v), [id]: true}));
    const next=(zCounter?.current||100)+1;
    if(zCounter) zCounter.current=next;
    setZ?.(prev=>({...prev,[id]:next}));
  }
  return <div className="panel core-overview-panel operator-terminal-panel">
    <div className="terminal-panel-head">
      <div>
        <h3>{lang==='ru'?'00 Пульт ядра':'00 Core Overview'}</h3>
        <p>{lang==='ru'?'Главная диспетчерская панель: статус ядра, закрытость исполнения и состояние живого потока.':'Main dispatcher panel: core status, execution lock and live stream state.'}</p>
      </div>
    </div>
    <StatusStrip items={[
      {label:lang==='ru'?'Итог ядра':'Core result', value:dto.overallState, tone:'blue'},
      {label:lang==='ru'?'Режим':'Mode', value:dto.mode, tone:'blue'},
      {label:lang==='ru'?'Локальное доверие':'Local trust', value:dto.trustState, tone:statusTone(dto.trustState)},
      {label:lang==='ru'?'Биржевое доверие':'Exchange trust', value:exchangeTrustValue, tone:'yellow'},
      {label:lang==='ru'?'Proof':'Proof', value:statusLabel(sig.proofToken, lang), tone:statusTone(sig.proofToken)},
      {label:lang==='ru'?'Вердикт действия':'Action verdict', value:dto.actionVerdict, tone:'red'},
      {label:lang==='ru'?'Исполнение':'Execution', value:dto.executionSurface, tone:'blue'},
      {label:lang==='ru'?'Живой поток':'Live stream', value:dto.liveStreamStatus, tone:statusTone(dto.liveStreamStatus)},
      {label:lang==='ru'?'Правило оператора':'Operator rule', value:dto.operatorRule, tone:'yellow'}
    ]}/>
    <div className="operator-explanation">
      {lang==='ru'?'Живой поток, свежие рыночные данные и локальная provenance-цепочка не являются разрешением на торговлю. NO PROOF → NO ALLOW.':'Live stream, fresh market data and local provenance chain are not trading permission. NO PROOF → NO ALLOW.'}
    </div>
    <div className="overview-block-list terminal-block-list">
      {dto.blocks.map(block=>{
        const tone=statusTone(block.status || block.color);
        return <button className={'overview-block-row tone-row-'+tone} key={block.id} onClick={()=>focusBlock(block.id)} title={lang==='ru'?'Открыть или сфокусировать соответствующий блок':'Open or focus the corresponding block'}>
          <span className="overview-icon">{blockIcon(block.color, block.status)}</span>
          <span className="overview-title">{block.title || block.id}</span>
          <span className={'status-badge tone-'+tone}>{ruStatus(block.status, lang)}</span>
          <span className="overview-message">{block.message || ruStatus(block.status, lang)}</span>
          <span className="open-target">{lang==='ru'?'открыть':'open'} ↗</span>
        </button>
      })}
    </div>
    <RawBlock title="Raw CoreOverviewDTO" value={dto}/>
  </div>
}

function normalizeLiveStream(trace){
  const dto = trace.liveStream?.status || {};
  return {
    dto:'LiveMarketStreamDTO',
    adapterMode: dto.adapterMode || 'live-readonly',
    provider: dto.provider || 'Binance',
    symbol: dto.symbol || 'BTCUSDT',
    connectionStatus: dto.connectionStatus || 'disconnected',
    liveExchangeConnected: !!dto.liveExchangeConnected,
    lastEventAt: dto.lastEventAt ?? null,
    ageMs: dto.ageMs ?? null,
    latencyMs: dto.latencyMs ?? null,
    marketFreshnessStatus: dto.marketFreshnessStatus || 'unknown',
    sequenceStatus: dto.sequenceStatus || 'unknown',
    reconnectCount: dto.reconnectCount ?? 0,
    disconnectReason: dto.disconnectReason ?? 'not_started',
    exchangeProofStatus: dto.exchangeProofStatus || 'missing',
    exchangeProofValid: dto.exchangeProofValid === true,
    executionSurface: dto.executionSurface || 'closed',
    actionVerdict: dto.actionVerdict || 'prohibited',
    trustState: dto.trustState || trace.runtimeSnapshot?.trust?.state || trace.machine?.trustState || 'UNCERTAIN',
    readOnly: dto.readOnly !== false
  };
}


function LiveMarketStreamPanel({lang='ru',trace}){
  const dto = normalizeLiveStream(trace);
  const sig = readSemanticTrustSignals(trace);
  const exchangeTrustValue = sig.exchangeTrustUncertain
    ? (lang==='ru'?'неопределено':'UNCERTAIN')
    : String(sig.exTruth || '').toUpperCase();
  const event = trace.liveStream?.lastEvent || {
    dto:'LiveMarketStreamEventDTO',
    eventType:'unknown',
    eventTime:null,
    receivedAt:null,
    price:null,
    quantity:null,
    rawSummary:{present:false, omittedForUiSafety:true, reason:'no_live_event_received'},
    executionSurface:'closed',
    readOnly:true
  };
  const connected = dto.connectionStatus === 'connected';
  const operatorMessage = connected
    ? (lang==='ru'?'Поток подключён, но биржевое доказательство не подтверждено. Торговое разрешение отсутствует. Исполнение закрыто.':'Stream is connected, but exchange proof is not verified. Trading permission is absent. Execution is closed.')
    : (lang==='ru'?'Поток не запущен или отключён. Торговое разрешение отсутствует. Исполнение закрыто.':'Stream is not started or disconnected. Trading permission is absent. Execution is closed.');
  return <div className="panel live-stream-panel operator-terminal-panel">
    <div className="terminal-panel-head">
      <div>
        <h3>{lang==='ru'?'17 Живой поток':'17 Live Market Stream'}</h3>
        <p>{lang==='ru'?'Первый внешний рыночный сенсор в режиме read-only / observe-only.':'First external market sensor in read-only / observe-only mode.'}</p>
      </div>
    </div>
    <StatusStrip items={[
      {label:lang==='ru'?'Статус подключения':'Connection status', value:dto.connectionStatus, tone:connected?'green':'gray'},
      {label:lang==='ru'?'Биржа':'Exchange', value:dto.liveExchangeConnected ? (lang==='ru'?'подключена':'connected') : (lang==='ru'?'нет':'no'), tone:dto.liveExchangeConnected?'green':'gray'},
      {label:lang==='ru'?'Свежесть':'Freshness', value:dto.marketFreshnessStatus, tone:statusTone(dto.marketFreshnessStatus)},
      {label:lang==='ru'?'Биржевое доказательство':'Exchange proof', value:statusLabel(dto.exchangeProofStatus, lang), tone:statusTone(dto.exchangeProofStatus)},
      {label:lang==='ru'?'Локальное доверие ядра':'Local core trust', value:dto.trustState, tone:statusTone(dto.trustState)},
      {label:lang==='ru'?'Биржевое доверие':'Exchange trust', value:exchangeTrustValue, tone:'yellow'},
      {label:'PLACE_ORDER', value:dto.actionVerdict, tone:'red'},
      {label:lang==='ru'?'Исполнение':'Execution', value:dto.executionSurface, tone:'blue'}
    ]}/>
    <div className="operator-explanation">{operatorMessage}<br/>{lang==='ru'?'Живой поток, свежие рыночные данные и локальная provenance-цепочка не являются биржевым proof. NO PROOF → NO ALLOW.':'Live stream, fresh market data and local provenance chain are not exchange proof. NO PROOF → NO ALLOW.'}</div>

    <h3>{lang==='ru'?'Технические параметры':'Technical parameters'}</h3>
    <CompactInfoGrid items={[
      [lang==='ru'?'Режим адаптера':'Adapter mode', statusLabel(dto.adapterMode, lang)],
      [lang==='ru'?'Провайдер':'Provider', dto.provider],
      [lang==='ru'?'Символ':'Symbol', dto.symbol],
      [lang==='ru'?'Статус подключения':'Connection status', statusLabel(dto.connectionStatus, lang)],
      [lang==='ru'?'Последнее событие':'Last event', dto.lastEventAt || emptyLabel(lang)],
      [lang==='ru'?'Возраст события':'Event age', dto.ageMs === null ? emptyLabel(lang) : `${dto.ageMs} ms`],
      [lang==='ru'?'Задержка':'Latency', dto.latencyMs === null ? emptyLabel(lang) : `${dto.latencyMs} ms`],
      [lang==='ru'?'Статус последовательности':'Sequence status', statusLabel(dto.sequenceStatus, lang)],
      [lang==='ru'?'Количество reconnect':'Reconnect count', dto.reconnectCount],
      [lang==='ru'?'Причина отключения':'Disconnect reason', statusLabel(dto.disconnectReason || 'no_data', lang)],
      [lang==='ru'?'Read-only режим':'Read-only mode', yesNo(dto.readOnly, lang)]
    ]}/>

    <h3>{lang==='ru'?'Последнее нормализованное событие':'Last normalized event'}</h3>
    <div className="event-summary-card">
      <CompactInfoGrid items={[
        [lang==='ru'?'Тип события':'Event type', statusLabel(event.eventType, lang)],
        [lang==='ru'?'Время события':'Event time', event.eventTime || emptyLabel(lang)],
        [lang==='ru'?'Получено':'Received at', event.receivedAt || emptyLabel(lang)],
        [lang==='ru'?'Цена':'Price', event.price ?? emptyLabel(lang)],
        [lang==='ru'?'Количество':'Quantity', event.quantity ?? emptyLabel(lang)],
        ['Raw payload', event.rawSummary?.present ? (lang==='ru'?'скрыт ради безопасности UI':'omitted for UI safety') : emptyLabel(lang)],
        [lang==='ru'?'Причина':'Reason', statusLabel(event.rawSummary?.reason || 'no_data', lang)]
      ]}/>
    </div>

    <RawBlock title="Raw LiveMarketStreamEventDTO" value={event}/>
    <RawBlock title="Raw LiveMarketStreamDTO" value={dto}/>
  </div>
}

function OperatorTruthSummary({lang='ru',trace}){
  const snapshot = trace.runtimeSnapshot || {};
  const semantic = snapshot.semantic || {};
  const exchange = semantic.exchangeTruth || {};
  const adapter = semantic.adapter || {};
  const recovery = semantic.recovery || {};
  const verdict = snapshot.verdict || trace.gateVerdict || {};
  const trust = snapshot.trust || {};
  const sig = readSemanticTrustSignals(trace);
  const exchangeTrustValue = sig.exchangeTrustUncertain
    ? (lang==='ru'?'неопределено':'UNCERTAIN')
    : String(sig.exTruth || '').toUpperCase();
  const exchangeProofSummary = statusLabel(sig.proofToken === 'valid' ? 'valid' : 'missing', lang);
  const L = lang === 'ru';
  return <div className="rows">
    <div className="card">
      <h2>{L ? 'Итоговая правда для оператора' : 'Operator truth summary'}</h2>
      <p>{L ? 'NO PROOF → NO ALLOW. Нет доказательств → нет разрешения.' : 'NO PROOF → NO ALLOW. No proof → no permission.'}</p>
      <InfoGrid items={[
        [L ? 'Режим адаптера' : 'Adapter mode', statusLabel(adapter.adapterMode, lang)],
        [L ? 'Источник данных' : 'Data source', statusLabel(adapter.sourceMode, lang)],
        [L ? 'Формат данных' : 'Data format', adapter.providerFormat || emptyLabel(lang)],
        [L ? 'Живой поток' : 'Live stream', statusLabel(trace.liveStream?.status?.connectionStatus || 'disconnected', lang)],
        [L ? 'Живое подключение к бирже' : 'Live exchange connected', yesNo(trace.liveStream?.status?.liveExchangeConnected || adapter.liveExchangeConnected, lang)],
        [L ? 'Локальное доверие ядра' : 'Local core trust', trust.state || 'UNCERTAIN'],
        [L ? 'Биржевое доверие' : 'Exchange trust', exchangeTrustValue],
        [L ? 'Биржевое доказательство' : 'Exchange proof', exchangeProofSummary],
        [L ? 'Биржевая истина (DTO)' : 'Exchange truth (DTO)', statusLabel(exchange.status, lang)],
        [L ? 'Действие PLACE_ORDER' : 'PLACE_ORDER action', statusLabel(verdict.result || 'prohibited', lang)],
        [L ? 'Поверхность исполнения' : 'Execution surface', statusLabel('closed', lang)],
        [L ? 'Автовосстановление' : 'Auto recovery', recovery.autoRecoveryEnabled ? (L ? 'включено' : 'enabled') : (L ? 'выключено' : 'disabled')],
        [L ? 'Режим восстановления' : 'Recovery mode', recovery.trustRecoverySuggested ? (L ? 'подсказка оператору требуется' : 'operator prompt suggested') : (L ? 'системное восстановление не требуется' : 'system recovery not required')]
      ]}/>
      <p className="hint">{L ? 'Свежие рыночные данные, локальная цепочка provenance или формат Binance-like не являются доказательством биржевой истины.' : 'Fresh market data, a local provenance chain, or a Binance-like format are not proof of exchange truth.'}</p>
    </div>
  </div>
}

function Pulse({lang,trace}){
  const m=trace.machine, t=T[lang];
  const items=[
    [t.machineStatus, lang==='ru'?m.statusRu:m.status, 'Machine Status'],
    [t.trustState, lang==='ru' ? `${m.trustState} / ${m.trustStateRu}` : m.trustState, 'Local core trust'],
    [t.runtimeMode, lang==='ru'?m.runtimeModeRu:m.runtimeMode, 'Runtime Mode'],
    [t.trading, `${m.tradingAllowed?t.yes:t.no} / ${m.tradingAllowed}`, 'gate'],
    [t.revision, '#'+m.revision, 'mock'],
    [t.lastEvent, m.lastEventType, 'eventType'],
    [t.lastTransition, m.lastTransition, 'state transition'],
    [t.mainReason, lang==='ru'?m.mainReasonRu:m.mainReason, 'reason']
  ];
  return <div className="rows">{items.map((it,i)=><div className="card" key={i}><div className="label">{it[0]}</div><b>{it[1]}</b><small>{it[2]}</small></div>)}<OperationalIndicators lang={lang} trace={trace}/></div>
}
function ActiveEvent({lang,trace}){
  const e=trace.event;
  const items=[['eventId',e.eventId],['eventType',e.eventType],['source',e.source],['provider',e.provider],['receivedAt',e.receivedAt],['eventTime',e.eventTime],['sequence',e.sequence],['payloadHash',e.payloadHash]];
  return <div className="rows">
    {items.map(([k,v])=><div className="card" key={k}><div className="label">{k}</div><b>{v}</b></div>)}
    <h2>Payload preview</h2>
    <pre className="code">{safeStringify(e.payloadPreview,2)}</pre>
  </div>
}
function RawTrace({trace}){return <pre className="code">{safeStringify(trace,2)}</pre>}

function OperationalIndicators({lang,trace}){
  const t=T[lang];
  const p=trace.provenance || {};
  const mi=trace.marketIntegrity || {};
  const rr=trace.replayRevision || {};
  const items=[
    [t.provenance, lang==='ru' ? (p.originRu || p.origin) : (p.origin || p.originRu), p.scenarioId || '—'],
    [t.marketIntegrity, lang==='ru' ? (mi.statusRu || mi.status) : (mi.status || mi.statusRu), `sequence: ${lang==='ru' ? (mi.sequenceStatusRu || mi.sequenceStatus) : (mi.sequenceStatus || mi.sequenceStatusRu)}`],
    [t.replayRevision, lang==='ru' ? (rr.replayStatusRu || rr.replayStatus) : (rr.replayStatus || rr.replayStatusRu), `${rr.fromRevision ?? '—'} → ${rr.toRevision ?? '—'}`]
  ];
  return <div className="grid3" style={{marginTop:10}}>
    {items.map(([label,value,sub])=><div className="card" key={label}><div className="label">{label}</div><b>{value || '—'}</b><small>{sub}</small></div>)}
  </div>
}

function Pipeline({lang,trace}){
  const t=T[lang];
  return <div className="pipeline">
    {trace.pipeline.map((s,i)=><div className="step" key={s.stepId}>
      <div><div className="num">{String(i+1).padStart(2,'0')}</div><h3>{lang==='ru'?s.labelRu:s.label}</h3><p>{getLabel(s,lang)}</p></div>
      <div><span className={'chip '+statusClass(s.status)}>{t[s.status]||s.status}</span><p style={{marginTop:10}}>latency: {s.latencyMs} ms<br/>counter: {s.counter}<br/>rev: #{s.revision}</p></div>
    </div>)}
  </div>
}
function MiniVerdict({lang,trace}){
  const t=T[lang], g=trace.gateVerdict;
  return <div className="card" style={{height:'100%',display:'grid',placeItems:'center',textAlign:'center'}}>
    <div>
      <div className="label">{t.result}</div>
      <b className="big" style={{color:'var(--bad)',background:'rgba(251,113,133,.18)',padding:'4px 12px',borderRadius:'4px'}}>{lang==='ru'?g.resultRu:g.result}</b>
      <p><b>{t.action}:</b> {lang==='ru'?g.actionRu:g.action}<br/><b>{t.trust}:</b> {g.kernelTrustState}<br/><b>{t.reason}:</b> {getLabel(g.blockingReasons[0],lang)}<br/><b>{t.ledger}:</b> {trace.ledger.permissionId}<br/><b>{t.quarantine}:</b> {trace.quarantine.quarantineId || 'none'}</p>
    </div>
  </div>
}
function ComputationSteps({lang,trace}){
  const t=T[lang];
  const groups=[
    ['Validation / Проверка события',trace.checks.validation],
    ['Idempotency / Проверка повтора',trace.checks.idempotency],
    ['Reducer / Вычисление редуктора',trace.checks.reducer],
  ];
  return <div className="rows">
    {groups.map(([title,items])=><div className="card" key={title}>
      <h2>{title}</h2>
      {items.map(x=><div className="box" key={x.checkId} style={{marginTop:8}}>
        <span className={'chip '+statusClass(x.status)}>{t[x.status]||x.status}</span>
        <h3>{x.checkId}<br/>{getLabel(x,lang)}</h3>
        <div className="code">{x.expression}</div>
        <small>actual: {pretty(x.actual)}<br/>result: {pretty(x.result)}</small>
      </div>)}
    </div>)}
  </div>
}
function FormulaInspector({lang,trace}){
  const [selected,setSelected]=useState(trace.formulas[0].formulaId);
  const f=trace.formulas.find(x=>x.formulaId===selected)||trace.formulas[0];
  const t=T[lang];
  return <div className="formula-layout">
    <div className="formula-list">
      {trace.formulas.map(x=><div key={x.formulaId} className={'formula-item '+(x.formulaId===selected?'active':'')} onClick={()=>setSelected(x.formulaId)}>
        <div className="label">{x.domain}</div><b>{getLabel(x,lang)}</b><small>{t[x.status]||x.status}</small>
      </div>)}
    </div>
    <div className="formula-detail">
      <h2>{f.formulaId}</h2><h3>{getLabel(f,lang)}</h3>
      <span className={'chip '+statusClass(f.status)}>{t[f.status]||f.status}</span>
      <div className="mini-grid" style={{marginTop:10}}>
        <div className="box"><div className="box-title">{t.inputs}</div><pre className="code">{pretty(f.inputs)}</pre></div>
        <div className="box"><div className="box-title">{t.expression}</div><pre className="code">{f.expression}</pre></div>
        <div className="box"><div className="box-title">{t.intermediate}</div><pre className="code">{pretty(f.intermediate)}</pre></div>
        <div className="box"><div className="box-title">{t.threshold}</div><pre className="code">{pretty(f.threshold)}</pre></div>
        <div className="box"><div className="box-title">{t.formulaResult}</div><b>{lang==='ru'?f.resultRu:f.result}</b></div>
        <div className="box"><div className="box-title">{t.explanation}</div>{lang==='ru'?f.explanationRu:f.explanation}</div>
      </div>
    </div>
  </div>
}
function SnapshotDiff({lang,trace}){
  const t=T[lang], d=trace.snapshotDiff;
  return <div>
    <div className="grid3">
      <div className="card"><div className="label">{t.revision}</div><b>{d.fromRevision} <span className="arrow">→</span> {d.toRevision}</b></div>
      <div className="card"><div className="label">Changed domains</div><b>{d.changedDomains.join(', ')}</b></div>
      <div className="card"><div className="label">Trace</div><b>{trace.traceId}</b></div>
    </div>
    <table className="diff-table">
      <thead><tr><th>path</th><th>{t.before}</th><th>{t.after}</th><th>{t.change}</th></tr></thead>
      <tbody>{d.changes.map(c=><tr key={c.path}><td><b>{c.path}</b><br/><small>{lang==='ru'?c.labelRu:c.label}</small></td><td>{pretty(c.before)}</td><td>{pretty(c.after)}</td><td>{c.delta!==undefined?pretty(c.delta):<span className="arrow">→</span>}</td></tr>)}</tbody>
    </table>
  </div>
}
function RuleEngine({lang,trace}){
  const rules = trace?.rules || {};
  const kernelRules = Array.isArray(rules.kernelAuthority) ? rules.kernelAuthority : [];
  const gateRules = Array.isArray(rules.actionGate) ? rules.actionGate : [];
  const all=[...kernelRules.map(r=>({...r,group:'kernel'})),...gateRules.map(r=>({...r,group:'gate'}))];
  const fallbackRule = {ruleId:'NO_RULES', status:'fail', condition:'trace.rules is missing', actual:'undefined', effect:'render guard blocked empty rules DTO', effectRu:'защита отображения: DTO rules отсутствует', severity:'block'};
  const [selected,setSelected]=useState(all.find(r=>r.status==='fail')?.ruleId || all[0]?.ruleId || fallbackRule.ruleId);
  const r=all.find(x=>x.ruleId===selected)||all[0]||fallbackRule;
  const t=T[lang];
  const score={
    kernel:{total:kernelRules.length,fail:kernelRules.filter(x=>x.status==='fail').length},
    gate:{total:gateRules.length,fail:gateRules.filter(x=>x.status==='fail').length}
  };
  return <div className="rule-layout">
    <div className="rule-list">
      <div className="card"><div className="label">{t.kernelRules}</div><b>{score.kernel.total-score.kernel.fail}/{score.kernel.total} pass</b><small>{score.kernel.fail} fail</small></div>
      <div className="card"><div className="label">{t.gateRules}</div><b>{score.gate.total-score.gate.fail}/{score.gate.total} pass</b><small>{score.gate.fail} fail</small></div>
      {all.map(x=><div key={x.ruleId} className={'rule-card '+(x.ruleId===selected?'active':'')} onClick={()=>setSelected(x.ruleId)}>
        <div className="rule-id">{x.ruleId}</div>
        <b>{getLabel(x,lang)}</b><br/>
        <span className={'chip '+statusClass(x.status)}>{t[x.status]||x.status}</span>
      </div>)}
    </div>
    <div className="rule-detail">
      <h2>{r.ruleId}</h2>
      <h3>{getLabel(r,lang)}</h3>
      <span className={'chip '+statusClass(r.status)}>{t[r.status]||r.status}</span>
      <div className="grid2" style={{marginTop:12}}>
        <div className="box"><div className="box-title">{t.condition}</div><pre className="code">{r.condition}</pre></div>
        <div className="box"><div className="box-title">{t.actual}</div><pre className="code">{r.actual}</pre></div>
        <div className="box"><div className="box-title">{t.effect}</div><b>{lang==='ru'?r.effectRu:r.effect}</b></div>
        <div className="box"><div className="box-title">{t.severity}</div><b>{r.severity}</b></div>
      </div>
      <h3 style={{marginTop:14}}>All rules</h3>
      <table className="rule-table">
        <thead><tr><th>ID</th><th>{t.condition}</th><th>{t.actual}</th><th>{t.effect}</th></tr></thead>
        <tbody>{all.map(x=><tr key={x.ruleId} onClick={()=>setSelected(x.ruleId)} style={{cursor:'pointer'}}>
          <td><span className="rule-id">{x.ruleId}</span><br/><span className={'chip '+statusClass(x.status)}>{t[x.status]||x.status}</span></td>
          <td>{x.condition}</td><td>{x.actual}</td><td>{lang==='ru'?x.effectRu:x.effect}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>
}


function GateLedgerTrace({lang,trace}){
  const t=T[lang], g=trace.gateVerdict, l=trace.ledger, q=trace.quarantine;
  const recovery = trace.recoveryPlan || {};
  const blocks = g.blockingReasons || [];
  const timeline = trace.gateLedgerTrace || [
    {id:'gate_input', label:'Gate input', labelRu:'Вход ворот', status:'pass', summary:'Action request received', summaryRu:'Запрос действия получен'},
    {id:'gate_rules', label:'Gate rules', labelRu:'Правила ворот', status:g.allowed?'allowed':'denied', summary:g.allowed?'Action allowed':'Action denied', summaryRu:g.allowed?'Действие разрешено':'Действие запрещено'},
    {id:'ledger_write', label:'Ledger write', labelRu:'Запись в журнал', status:l.recorded?'pass':'fail', summary:l.recorded?'Permission decision recorded':'Decision was not recorded', summaryRu:l.recorded?'Решение записано':'Решение не записано'},
    {id:'quarantine', label:'Quarantine', labelRu:'Карантин', status:q.recorded?'applied':'waiting', summary:q.recorded?'Quarantine record created':'No quarantine record', summaryRu:q.recorded?'Создана запись карантина':'Записи карантина нет'},
    {id:'recovery', label:'Recovery planner', labelRu:'Планировщик восстановления', status:recovery.required?'waiting':'pass', summary:recovery.required?'Recovery plan required':'No recovery required', summaryRu:recovery.required?'Требуется план восстановления':'Восстановление не требуется'}
  ];

  return <div className="gate-trace">
    <div className="grid3">
      <div className="card">
        <div className="label">{t.gateVerdict}</div>
        <b className={g.allowed?'ok-text':'bad-text'}>{lang==='ru'?g.resultRu:g.result}</b>
        <small>{lang==='ru'?g.actionRu:g.action} · {g.gateVersion}</small>
      </div>
      <div className="card">
        <div className="label">{t.ledgerResult}</div>
        <b>{l.recorded ? (lang==='ru'?'записано':'recorded') : (lang==='ru'?'не записано':'not recorded')}</b>
        <small>{l.permissionId || 'none'} · {l.decisionHash || 'no hash'}</small>
      </div>
      <div className="card">
        <div className="label">{t.quarantineResult}</div>
        <b>{q.recorded ? (lang==='ru'?'создано':'recorded') : (lang==='ru'?'нет записи':'none')}</b>
        <small>{q.quarantineId || 'none'}</small>
      </div>
    </div>

    <h2>{lang==='ru'?'След решения':'Decision trace'}</h2>
    <div className="trace-line">
      {timeline.map((x,i)=><div className="trace-node" key={x.id}>
        <div className="num">{String(i+1).padStart(2,'0')}</div>
        <h3>{lang==='ru'?(x.labelRu||x.label):x.label}</h3>
        <span className={'chip '+statusClass(x.status)}>{t[x.status]||x.status}</span>
        <small>{lang==='ru'?(x.summaryRu||x.summary):x.summary}</small>
      </div>)}
    </div>

    <h2>{lang==='ru'?'Причины блокировки':'Blocking reasons'}</h2>
    <div className="rows">
      {blocks.length ? blocks.map(b=><div className="box" key={b.code}>
        <span className={'chip '+(b.severity==='block'?'denied':'waiting')}>{b.severity}</span>
        <h3>{b.code}</h3>
        <div className="mini-grid two">
          <div><div className="box-title">domain</div><b>{b.domain}</b></div>
          <div><div className="box-title">message</div><b>{lang==='ru'?(b.messageRu||b.message):b.message}</b></div>
        </div>
      </div>) : <div className="box">{lang==='ru'?'Блокировок нет':'No blocking reasons'}</div>}
    </div>

    <h2>{t.recoveryResult}</h2>
    <div className="box">
      <span className={'chip '+(recovery.required?'waiting':'pass')}>{recovery.required ? (lang==='ru'?'требуется':'required') : (lang==='ru'?'не требуется':'not required')}</span>
      <h3>{recovery.mode || trace.machine.runtimeMode}</h3>
      <div className="rows compact-list">
        {(recovery.nextActions||[]).map(a=><div className="row-mini" key={a.code}>
          <b>{a.code}</b>
          <span>{lang==='ru'?(a.labelRu||a.label):a.label || a.labelRu}</span>
          <span className="chip waiting">{a.priority}</span>
        </div>)}
      </div>
    </div>
  </div>
}

function Settings({
  open,setOpen,theme,setTheme,density,setDensity,scale,setScale,radius,setRadius,
  uiFont,setUiFont,monoFont,setMonoFont,saturation,setSaturation,contrast,setContrast,glow,setGlow,hue,setHue,panelOpacity,setPanelOpacity,gridPower,setGridPower,headerPower,setHeaderPower,shadowDepth,setShadowDepth,scanlines,setScanlines,noise,setNoise,textSharpness,setTextSharpness,hotkeys,setHotkeys,blockAccents,setBlockAccents,
  layout,setLayout,collapsedMap,setCollapsedMap,visibleMap,setVisibleMap,workspaceMode,setWorkspaceMode,lang
}){
  const t=T[lang];
  const themeRu={aurora:'Аврора',core:'Тёмное ядро',deepsea:'Глубокое море',volcano:'Вулканический риск',day:'Светлая контрастная',dracula:'Дракула',nord:'Норд',tokyo:'Токио ночь',gruvbox:'Грувбокс тёмная',monokai:'Монокай'};
  const densityRu={comfort:'Удобная',compact:'Компактная',ultra:'Ультра-компактная'};
  const fontRu={system:'Системный интерфейс',inter:'Inter / современный',segoe:'Segoe UI',arial:'Arial',trebuchet:'Trebuchet MS',verdana:'Verdana',mono:'Моноширинный интерфейс',jetbrains:'JetBrains Mono',fira:'Fira Code',consolas:'Consolas',sfmono:'SF Mono',monaco:'Monaco',monospace:'Системный моноширинный'};
  const [profiles,setProfiles]=useLocalState('ocm_v072_workspace_profiles',{});
  const [name,setName]=useState(Object.keys(profiles)[0]||'1');

  function saveProfile(){
    const n=prompt(lang==='ru'?'Название рабочей области':'Workspace name',name||'1');
    if(!n) return;
    setProfiles({
      ...profiles,
      [n]:profilePayload({layout,collapsedMap,visibleMap,theme,density,scale,radius,workspaceMode,uiFont,monoFont,saturation,contrast,glow,hue,panelOpacity,gridPower,headerPower,shadowDepth,scanlines,noise,textSharpness,blockAccents})
    });
    setName(n);
  }
  function loadProfile(){
    const p=profiles[name];
    if(!p) return;
    if(p.layout) setLayout(stripLayout(p.layout));
    if(p.collapsedMap) setCollapsedMap(p.collapsedMap);
    if(p.visibleMap) setVisibleMap(sanitizeVisible(p.visibleMap));
    if(p.theme) setTheme(p.theme);
    if(p.density) setDensity(p.density);
    if(p.scale) setScale(String(p.scale));
    if(p.radius) setRadius(String(p.radius));
    if(p.workspaceMode) setWorkspaceMode(p.workspaceMode);
    if(p.uiFont) setUiFont(p.uiFont);
    if(p.monoFont) setMonoFont(p.monoFont);
    if(p.saturation) setSaturation(String(p.saturation));
    if(p.contrast) setContrast(String(p.contrast));
    if(p.glow) setGlow(String(p.glow));
    if(p.hue) setHue(String(p.hue));
    if(p.panelOpacity) setPanelOpacity(String(p.panelOpacity));
    if(p.gridPower) setGridPower(String(p.gridPower));
    if(p.headerPower) setHeaderPower(String(p.headerPower));
    if(p.textSharpness) setTextSharpness(String(p.textSharpness));
    if(p.noise) setNoise(String(p.noise));
    if(p.scanlines) setScanlines(String(p.scanlines));
    if(p.shadowDepth) setShadowDepth(String(p.shadowDepth));
    if(p.blockAccents) setBlockAccents(p.blockAccents);
  }
  function deleteProfile(){
    const cp={...profiles};
    delete cp[name];
    setProfiles(cp);
    setName(Object.keys(cp)[0]||'1');
  }
  function openDetached(id){
    const url=new URL(location.href);
    url.searchParams.set('module',id);
    window.open(url.toString(),'OCM_'+id,'popup=yes,width=1180,height=820,left=120,top=80');
  }
  function setAllVisible(value){
    setVisibleMap(Object.fromEntries(allWindowIds.map(id=>[id,value])));
  }

  return <aside className={'settings '+(open?'open':'')}>
    <div className="settings-head"><div><h2>{t.settings}</h2><small>{lang==='ru'?'удобства старой кабины сохранены':'old cockpit conveniences preserved'}</small></div><button onClick={()=>setOpen(false)}>{t.close}</button></div>
    <div className="theme-note">{lang==='ru'?'Настройки темы усилены. Горячие клавиши теперь отдельной кнопкой в верхней панели.':'Theme controls are stronger now. Hotkeys live in a separate right column.'}</div>

    <div className="setting"><label>{t.theme}</label><select value={theme} onChange={e=>setTheme(e.target.value)}>{themes.map(([v,l])=><option key={v} value={v}>{lang==='ru'?(themeRu[v]||l):l}</option>)}</select></div>
    <div className="setting"><label>{t.density}</label><select value={density} onChange={e=>setDensity(e.target.value)}>{densities.map(([v,l])=><option key={v} value={v}>{lang==='ru'?(densityRu[v]||l):l}</option>)}</select></div>
    <div className="setting"><label><span>{t.scale}</span><span>{scale}</span></label><input type="range" min=".75" max="1.35" step=".05" value={scale} onChange={e=>setScale(e.target.value)}/></div>
    <div className="setting"><label><span>{t.radius}</span><span>{radius}px</span></label><input type="range" min="0" max="34" step="1" value={radius} onChange={e=>setRadius(e.target.value)}/></div>
    <div className="setting"><label>{t.uiFont}</label><select value={uiFont} onChange={e=>setUiFont(e.target.value)}>{uiFonts.map(([v,l])=><option key={v} value={v}>{lang==='ru'?(fontRu[v]||l):l}</option>)}</select></div>
    <div className="setting"><label>{t.monoFont}</label><select value={monoFont} onChange={e=>setMonoFont(e.target.value)}>{monoFonts.map(([v,l])=><option key={v} value={v}>{lang==='ru'?(fontRu[v]||l):l}</option>)}</select></div>
    <div className="setting"><label><span>{t.saturation}</span><span>{saturation}</span></label><input type="range" min=".25" max="3.2" step=".05" value={saturation} onChange={e=>setSaturation(e.target.value)}/></div>
    <div className="setting"><label><span>{t.contrast}</span><span>{contrast}</span></label><input type="range" min=".45" max="2.4" step=".05" value={contrast} onChange={e=>setContrast(e.target.value)}/></div>
    <div className="setting"><label><span>{t.glow}</span><span>{glow}</span></label><input type="range" min="0" max="4" step=".1" value={glow} onChange={e=>setGlow(e.target.value)}/></div>
    <div className="setting theme-advanced"><label><span>{t.hue}</span><span>{hue}°</span></label><input type="range" min="-100" max="100" step="1" value={hue} onChange={e=>setHue(e.target.value)}/></div>
    <div className="setting theme-advanced"><label><span>{t.panelOpacity}</span><span>{panelOpacity}</span></label><input type="range" min=".35" max="1" step=".01" value={panelOpacity} onChange={e=>setPanelOpacity(e.target.value)}/></div>
    <div className="setting theme-advanced"><label><span>{t.gridPower}</span><span>{gridPower}</span></label><input type="range" min="0" max="5" step=".1" value={gridPower} onChange={e=>setGridPower(e.target.value)}/></div>
    <div className="setting theme-advanced"><label><span>{t.headerPower}</span><span>{headerPower}</span></label><input type="range" min="0" max="4" step=".1" value={headerPower} onChange={e=>setHeaderPower(e.target.value)}/></div>
    <div className="setting theme-advanced"><label><span>{t.shadowDepth}</span><span>{shadowDepth}</span></label><input type="range" min="0" max="5" step=".1" value={shadowDepth} onChange={e=>setShadowDepth(e.target.value)}/></div>
    <div className="setting theme-advanced"><label><span>{t.scanlines}</span><span>{scanlines}</span></label><input type="range" min="0" max="3" step=".05" value={scanlines} onChange={e=>setScanlines(e.target.value)}/></div>
    <div className="setting theme-advanced"><label><span>{t.noise}</span><span>{noise}</span></label><input type="range" min="0" max="3" step=".05" value={noise} onChange={e=>setNoise(e.target.value)}/></div>
    <div className="setting theme-advanced"><label><span>{t.textSharpness}</span><span>{textSharpness}</span></label><input type="range" min=".5" max="2.2" step=".05" value={textSharpness} onChange={e=>setTextSharpness(e.target.value)}/></div>

    <hr/>
    <div className="setting">
      <label>{t.blocks}</label>
      <div className="composer-list">
        {allWindowIds.map(id=>{
          const label=windowMeta[id]?.[lang] || id;
          const visible=visibleMap[id]!==false;
          const collapsed=!!collapsedMap[id];
          return <div className={'composer-row '+(!visible?'off':'')} key={id}>
            <label className="checkline">
              <input type="checkbox" checked={visible} onChange={e=>setVisibleMap(v=>({...sanitizeVisible(v),[id]:e.target.checked}))}/>
              <span><b>{label}</b><small>{id}</small></span>
            </label>
            <button className="mini-btn" title={collapsed?'expand':'collapse'} onClick={()=>setCollapsedMap(v=>({...v,[id]:!v[id]}))}>{collapsed?'□':'—'}</button>
            <select className="block-color-select" title={t.blockColors} value={(blockColorPalette.includes(blockAccents[id]) ? blockAccents[id] : 'auto') || 'auto'} onChange={e=>setBlockAccents(v=>({...v,[id]:e.target.value}))}>
              {blockColorPalette.map(c=><option key={c} value={c}>{c==='auto' && lang==='ru'?'авто':c}</option>)}
            </select>
            <input className="block-custom-color" type="color" title={lang==='ru'?'Свой цвет':'Custom color'} value={(String(blockAccents[id]||'').startsWith('#') ? blockAccents[id] : '#22d3ee')} onChange={e=>setBlockAccents(v=>({...v,[id]:e.target.value}))}/>
            <button className="mini-btn" title={t.openDetached} onClick={()=>openDetached(id)}>↗</button>
          </div>
        })}
      </div>
      <div className="setting-row" style={{marginTop:8}}>
        <button className="btn" onClick={()=>setAllVisible(true)}>{t.showAll}</button>
        <button className="btn" onClick={()=>setAllVisible(false)}>{t.hideAll}</button>
      </div>
    </div>

    <hr/>
    <div className="setting"><label>{t.workspaceProfiles}</label><select value={name} onChange={e=>setName(e.target.value)}><option value="1">1</option>{Object.keys(profiles).map(k=><option key={k} value={k}>{k}</option>)}</select></div>
    <div className="setting-row"><button className="btn" onClick={saveProfile}>{t.save}</button><button className="btn" onClick={loadProfile}>{t.load}</button><button className="btn" onClick={deleteProfile}>{t.del}</button></div>
    <div className="setting"><button className="btn" style={{width:'100%'}} onClick={()=>{ if(!window.confirm(lang==='ru'?'Сбросить стандартную раскладку?':'Reset default layout?')) return; setLayout(defaultLayout());setCollapsedMap({});setVisibleMap(defaultVisible());setWorkspaceMode('custom')}}>{t.standard}</button></div>
    <p style={{color:'var(--muted)',lineHeight:1.5}}>{t.layoutNote}<br/>{lang==='ru' ? 'v0.7.6: улучшены настройки, палитра блоков, заливка заголовков, скругление верхних полос и темы.' : 'v0.7.6: stronger settings, block palette, header fill, top rail radius, and themes.'}</p>
  </aside>
}


function currentUiLang(){ return (typeof window !== 'undefined' && window.__ocmLang === 'en') ? 'en' : 'ru'; }
function emptyLabel(lang=currentUiLang()){ return lang === 'en' ? 'no data' : 'нет данных'; }
function safeValue(value, lang=currentUiLang()){
  if(value===undefined || value===null || value==='') return emptyLabel(lang);
  if(typeof value==='object') return safeStringify(value,2);
  return String(value);
}
function statusLabel(value, lang=currentUiLang()){
  const ru={
    known:'известно', unknown:'неизвестно', valid:'валидно', invalid:'невалидно',
    matched:'совпало', current:'текущая', fresh:'свежие', stale:'устарело', deny:'запрещено',
    denied:'запрещено', blocked:'заблокировано', warning:'требует внимания',
    fallback:'резервный режим', provider:'формат провайдера', source:'источник',
    pass:'пройдено', fail:'ошибка', ok:'норма', present:'присутствует',
    absent:'отсутствует', missing:'отсутствует', prohibited:'запрещено',
    allowed:'разрешено', simulated:'симуляционный', 'local-dto':'локальные DTO',
    'runtime-readonly':'runtime read-only', 'live-readonly':'live read-only',
    connected:'подключён', disconnected:'отключён', connecting:'подключается',
    degraded:'деградировал', error:'ошибка', closed:'закрыта',
    not_connected:'не подключён', no_data:'нет данных', black:'не подключено',
    green:'работает', yellow:'требует внимания', blue:'read-only',
    pending:'ожидает доказательства', verified:'подтверждено', true:'да', false:'нет',
    disabled:'отключён', not_started:'не запущен', no_live_event_received:'живое событие не получено',
    uncertain:'неопределено', 'safe_observe_only':'безопасное наблюдение', 'no_proof_no_allow':'NO PROOF → NO ALLOW'
  };
  const en={
    known:'known', unknown:'unknown', valid:'valid', invalid:'invalid',
    matched:'matched', current:'current', fresh:'fresh', stale:'stale', deny:'denied',
    denied:'denied', blocked:'blocked', warning:'warning',
    fallback:'fallback mode', provider:'provider format', source:'source',
    pass:'pass', fail:'fail', ok:'ok', present:'present',
    absent:'absent', missing:'missing', prohibited:'prohibited',
    allowed:'allowed', simulated:'simulated', 'local-dto':'local DTO',
    'runtime-readonly':'runtime read-only', 'live-readonly':'live read-only',
    connected:'connected', disconnected:'disconnected', connecting:'connecting',
    degraded:'degraded', error:'error', closed:'closed',
    not_connected:'not connected', no_data:'no data', black:'not connected',
    green:'working', yellow:'attention required', blue:'read-only',
    pending:'proof pending', verified:'verified', true:'yes', false:'no',
    disabled:'disabled', not_started:'not started', no_live_event_received:'no live event received',
    uncertain:'uncertain', 'safe_observe_only':'safe observe-only', 'no_proof_no_allow':'NO PROOF → NO ALLOW'
  };
  const key=String(value ?? '').toLowerCase();
  return (lang==='en' ? en[key] : ru[key]) || safeValue(value, lang);
}
function ruStatus(value, lang=currentUiLang()){ return statusLabel(value, lang); }
function yesNo(value, lang=currentUiLang()){ return value ? (lang==='en'?'yes':'да') : (lang==='en'?'no':'нет'); }

function statusTone(value){
  const v=String(value ?? '').toLowerCase();
  if(['ok','pass','green','connected','fresh','работает'].includes(v)) return 'green';
  if(['warning','unknown','uncertain','pending','missing','yellow','degraded','отсутствует','неизвестно'].includes(v)) return 'yellow';
  if(['prohibited','blocked','fail','error','deny','denied','red','запрещено'].includes(v)) return 'red';
  if(['closed','read-only','readonly','observe-only','blue','safe_observe_only'].includes(v)) return 'blue';
  if(['disconnected','not_connected','no_data','disabled','not_started','black','gray','grey'].includes(v)) return 'gray';
  return 'gray';
}
function StatusCard({label,value,tone,sub}){
  const t=tone || statusTone(value);
  return <div className={'status-card tone-'+t}>
    <div className="status-label">{label}</div>
    <div className="status-value">{statusLabel(value)}</div>
    {sub!==undefined && <div className="status-sub">{safeValue(sub)}</div>}
  </div>
}
function StatusStrip({items}){
  return <div className="status-strip">{items.map((it,i)=><StatusCard key={i} {...it}/>)}</div>
}
function CompactInfoGrid({items}){
  return <div className="terminal-info-grid">{items.map(([k,v])=><div className="terminal-info-cell" key={k}>
    <b>{k}</b><span>{safeValue(v)}</span>
  </div>)}</div>
}
function RawBlock({title,value,defaultOpen=false}){
  const [open,setOpen]=useState(defaultOpen);
  return <div className="raw-block">
    <button className="raw-toggle" onClick={()=>setOpen(v=>!v)}>{open?'▾':'▸'} {title}</button>
    {open && <pre className="json raw-json">{safeValue(value)}</pre>}
  </div>
}
function InfoGrid({items}){
  return <div className="kv">{items.map(([k,v])=><div key={k}><b>{k}</b><span>{safeValue(v)}</span></div>)}</div>
}
function GenericDtoPanel({title,dto}){
  return <div className="panel dto-panel">
    <h3>{title}</h3>
    <pre className="json fill-json">{safeValue(dto)}</pre>
  </div>
}
function RevisionTimeline({lang='ru',trace}){
  const revisions=trace.replayRevision?.revisions || trace.revisionTimeline || [{revision:trace.machine?.revision, status:'current', hash:trace.snapshotHash}];
  const current = revisions.find(r=>String(r.status||r.label).toLowerCase()==='current') || revisions[revisions.length-1] || {};
  const verified = revisions.filter(r=>['verified','matched','pass'].includes(String(r.status||r.label).toLowerCase())).length;
  const replayStatus = trace.replayRevision?.replayStatus || trace.replay?.status || 'matched';
  return <div className="panel compact-content-panel revision-panel">
    <div className="panel-summary">
      <h3>{lang==='ru'?'Линия ревизий':'Revision Timeline'}</h3>
      <p>{lang==='ru'?'Краткая история снимков и проверка детерминизма replay.':'Snapshot history and replay determinism summary.'}</p>
    </div>
    <div className="summary-grid">
      <div className="summary-card"><span>{lang==='ru'?'Всего ревизий':'Total revisions'}</span><b>{revisions.length}</b></div>
      <div className="summary-card"><span>{lang==='ru'?'Текущая ревизия':'Current revision'}</span><b>{current.revision ?? trace.machine?.revision ?? emptyLabel(lang)}</b></div>
      <div className="summary-card"><span>{lang==='ru'?'Проверенные':'Verified'}</span><b>{verified}</b></div>
      <div className="summary-card"><span>{lang==='ru'?'Детерминизм replay':'Replay determinism'}</span><b>{statusLabel(replayStatus, lang)}</b></div>
    </div>
    <div className="timeline-strip">
      {revisions.map((r,i)=><div className="timeline-card" key={i}>
        <span className="pill">#{safeValue(r.revision, lang)}</span>
        <b>{statusLabel(r.status||r.label, lang)}</b>
        <code>{safeValue(r.hash||r.snapshotHash, lang)}</code>
      </div>)}
    </div>
    <RawBlock title={lang==='ru'?'Raw ReplayRevisionDTO':'Raw ReplayRevisionDTO'} value={trace.replayRevision || {dto:'ReplayRevisionDTO', revisions}}/>
  </div>
}

function MarketIntegrityPanel({lang='ru',trace}){
  const sem=trace.runtimeSnapshot?.semantic || {};
  const f=sem.marketFreshness || {};
  const e=sem.exchangeTruth || {};
  const sig = readSemanticTrustSignals(trace);
  const localValidity = String(trace.runtimeSnapshot?.trust?.state || 'UNCERTAIN');
  const exchangeTrustValue = sig.exchangeTrustUncertain
    ? (lang==='ru'?'неопределено':'UNCERTAIN')
    : String(sig.exTruth || '').toUpperCase();
  const exchangeProofSummary = statusLabel(sig.proofToken === 'valid' ? 'valid' : 'missing', lang);
  const L = lang === 'ru';
  const contractNote = 'Свежие рыночные данные не являются доказательством биржевой истины.';
  const hintBody = f.note
    ? (L ? f.note : (f.note === contractNote ? 'Fresh market data is not proof of exchange truth.' : f.note))
    : (L ? contractNote : 'Fresh market data is not proof of exchange truth.');
  return <div className="panel">
    <h3>{L ? 'Целостность рынка' : 'Market integrity'}</h3>
    <InfoGrid items={[
      [L ? 'Свежесть рыночных данных' : 'Market data freshness', ruStatus(f.status, lang)],
      [L ? 'Возраст данных, мс' : 'Data age, ms', f.ageMs ?? emptyLabel(lang)],
      [L ? 'Порог свежести, мс' : 'Freshness threshold, ms', f.thresholdMs ?? emptyLabel(lang)],
      [L ? 'Биржевая истина' : 'Exchange truth', ruStatus(e.status, lang)],
      [L ? 'Живой поток' : 'Live stream', ruStatus(trace.liveStream?.status?.connectionStatus || 'disconnected', lang)],
      [L ? 'Биржевое доказательство (поток)' : 'Exchange proof (stream)', ruStatus(trace.liveStream?.status?.exchangeProofStatus || e.proof || 'missing', lang)],
      [L ? 'Локальная валидность' : 'Local validity', localValidity],
      [L ? 'Биржевое доверие' : 'Exchange trust', exchangeTrustValue],
      [L ? 'Биржевое доказательство' : 'Exchange proof', exchangeProofSummary]
    ]}/>
    <p className="hint">{hintBody}</p>
    <pre className="json fill-json">{safeValue(trace.marketIntegrity || trace.marketInputIntegrity)}</pre>
  </div>
}
function ProvenancePanel({lang='ru',trace}){
  const p=trace.runtimeSnapshot?.semantic?.provenance || {};
  const a=trace.runtimeSnapshot?.semantic?.adapter || {};
  const L = lang === 'ru';
  return <div className="panel">
    <h3>{L ? 'Происхождение и доказательство биржи' : 'Provenance and exchange proof'}</h3>
    <InfoGrid items={[
      [L ? 'Режим адаптера' : 'Adapter mode', ruStatus(a.adapterMode, lang)],
      [L ? 'Источник' : 'Source', ruStatus(a.sourceMode, lang)],
      [L ? 'Формат данных' : 'Data format', a.providerFormat || emptyLabel(lang)],
      [L ? 'Локальная цепочка происхождения' : 'Local provenance chain', p.localProvenanceValid ? (L ? 'валидна' : 'valid') : (L ? 'не подтверждена' : 'unconfirmed')],
      [L ? 'Доказательство биржи' : 'Exchange proof', p.exchangeProofValid ? (L ? 'валидно' : 'valid') : (L ? 'отсутствует' : 'absent')],
      [L ? 'Статус биржевой истины' : 'Exchange truth status', ruStatus(p.exchangeTruthStatus, lang)],
      [L ? 'Тип хэша' : 'Hash type', p.hashType === 'demo' ? (L ? 'демонстрационный' : 'demo') : ruStatus(p.hashType, lang)],
      [L ? 'Сила хэша' : 'Hash strength', p.hashStrength || emptyLabel(lang)]
    ]}/>
    <p className="hint">{L ? 'Валидная локальная цепочка не означает подтверждённую биржевую истину.' : 'A valid local chain does not mean exchange truth is confirmed.'}</p>
    <pre className="json fill-json">{safeValue(trace.provenance)}</pre>
  </div>
}
function RecoveryPanel({lang='ru',trace}){
  const r=trace.runtimeSnapshot?.semantic?.recovery || {};
  const L = lang === 'ru';
  const hintMap = { 'Сверить биржевую истину': 'Verify exchange truth', 'Проверить источник рыночных данных': 'Verify market data source' };
  const rawHints = Array.isArray(r.hints) && r.hints.length ? r.hints : [emptyLabel(lang)];
  const displayHints = L ? rawHints : rawHints.map(h => hintMap[h] || h);
  return <div className="panel">
    <h3>{L ? 'Восстановление' : 'Recovery'}</h3>
    <InfoGrid items={[
      [L ? 'Системное восстановление' : 'System recovery', r.systemRecoveryRequired ? (L ? 'требуется' : 'required') : (L ? 'не требуется' : 'not required')],
      [L ? 'Восстановление доверия' : 'Trust recovery', r.trustRecoverySuggested ? (L ? 'требуется' : 'required') : (L ? 'не требуется' : 'not required')],
      [L ? 'Причина восстановления доверия' : 'Trust recovery reason', r.trustRecoveryReason || emptyLabel(lang)],
      [L ? 'Автоматическое восстановление' : 'Automatic recovery', r.autoRecoveryEnabled ? (L ? 'включено' : 'enabled') : (L ? 'выключено' : 'disabled')],
      [L ? 'Режим' : 'Mode', r.mode || 'OBSERVE_ONLY']
    ]}/>
    <h3>{L ? 'Подсказки оператору' : 'Operator hints'}</h3>
    {displayHints.map((x,i)=><div className="box" key={i}>{x}</div>)}
    <pre className="json fill-json">{safeValue(trace.recovery || trace.recoveryPlan || trace.recoveryHints)}</pre>
  </div>
}
function ReplayPanel({lang='ru',trace}){
  const dto = trace.replayRevision || trace.replay || {};
  const revisions = dto.revisions || trace.revisionTimeline || [];
  const current = revisions.find(r=>String(r.status||r.label).toLowerCase()==='current') || revisions[revisions.length-1] || {};
  const replayStatus = dto.replayStatus || dto.status || 'matched';
  return <div className="panel compact-content-panel replay-panel">
    <div className="panel-summary">
      <h3>{lang==='ru'?'Панель повтора':'Replay Panel'}</h3>
      <p>{lang==='ru'?'Проверка, что повтор вычисления совпадает с ожидаемой ревизией.':'Replay check showing whether recomputation matches the expected revision.'}</p>
    </div>
    <div className="summary-grid">
      <div className="summary-card"><span>{lang==='ru'?'Статус replay':'Replay status'}</span><b>{statusLabel(replayStatus, lang)}</b></div>
      <div className="summary-card"><span>{lang==='ru'?'Ревизий':'Revisions'}</span><b>{revisions.length}</b></div>
      <div className="summary-card"><span>{lang==='ru'?'Детерминизм':'Deterministic'}</span><b>{['matched','verified','pass'].includes(String(replayStatus).toLowerCase()) ? yesNo(true, lang) : statusLabel(replayStatus, lang)}</b></div>
      <div className="summary-card"><span>{lang==='ru'?'Текущая ревизия':'Current revision'}</span><b>{current.revision ?? trace.machine?.revision ?? emptyLabel(lang)}</b></div>
    </div>
    <div className="timeline-strip">
      {(revisions.length ? revisions : [{revision:trace.machine?.revision, status:'current', hash:trace.snapshotHash}]).map((r,i)=><div className="timeline-card" key={i}>
        <span className="pill">#{safeValue(r.revision, lang)}</span>
        <b>{statusLabel(r.status||r.label, lang)}</b>
        <code>{safeValue(r.hash||r.snapshotHash, lang)}</code>
      </div>)}
    </div>
    <RawBlock title="Raw ReplayRevisionDTO" value={dto}/>
  </div>
}
function FailurePanel({lang='ru',trace}){
  const dto=trace.failureVisualization || {};
  const f=trace.runtimeSnapshot?.semantic?.failureMatrix || {};
  const sig = readSemanticTrustSignals(trace);
  const gv = trace.gateVerdict || {};
  const verdictFromGate = gv.action === 'allow' ? 'allowed' : gv.action === 'deny' ? 'prohibited' : null;
  const verdictResult = String(trace.runtimeSnapshot?.verdict?.result || gv.result || verdictFromGate || 'prohibited').toLowerCase();
  const proofMissing = !sig.proofOk || ['missing','absent'].includes(sig.proofToken);
  const tradingProhibited = verdictResult === 'prohibited' || proofMissing;
  const rawFinal = String(f.finalSafetyState || dto.finalSafetyState || '').toLowerCase();
  const scenarioStateLabel = rawFinal === 'allowed'
    ? (lang==='ru'?'разрешён к отображению':'display allowed')
    : ruStatus(f.finalSafetyState || dto.finalSafetyState, lang);
  const tradingActionLabel = tradingProhibited
    ? statusLabel('prohibited', lang)
    : statusLabel(verdictResult, lang);
  const L = lang === 'ru';
  return <div className="panel">
    <h3>{L ? 'Матрица отказов / финальная безопасность' : 'Failure matrix / final safety'}</h3>
    <InfoGrid items={[
      [L ? 'Сценарий' : 'Scenario', trace.scenario?.scenarioId || trace.scenarioId],
      [L ? 'Защита рендера сработала:' : 'Render guard triggered:', yesNo(f.renderGuardTriggered, lang)],
      [L ? 'Fallback-режим активен:' : 'Fallback mode active:', yesNo(f.renderFallbackActive, lang)],
      [L ? 'Режим адаптера' : 'Adapter mode', ruStatus(f.adapterMode, lang)],
      [L ? 'Режим данных' : 'Data mode', ruStatus(f.dataMode, lang)],
      [L ? 'Состояние сценария' : 'Scenario state', scenarioStateLabel],
      [L ? 'Торговое действие' : 'Trading action', tradingActionLabel],
      [L ? 'Поверхность исполнения' : 'Execution surface', f.executionSurface === 'closed' || !f.executionSurface ? statusLabel('closed', lang) : ruStatus(f.executionSurface, lang)]
    ]}/>
    <pre className="json fill-json">{safeValue(dto && !Array.isArray(dto) ? dto : {dto:'FailureMatrixDTO', scenario: trace.scenario?.scenarioId || trace.scenarioId || 'unknown', renderGuardTriggered:false, renderFallbackActive:false, adapterMode:'unknown', dataMode:'unknown', finalSafetyState:'prohibited', executionSurface:'closed', severity:'warning', blocks:Array.isArray(dto)?dto:[]})}</pre>
  </div>
}
class ErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={err:null};}
  static getDerivedStateFromError(err){return {err};}
  componentDidCatch(err, info){console.error('Observable Core Machine render failure', err, info);}
  render(){
    if(this.state.err) return <div className="fatal-panel"><h1>Runtime render error</h1><p>{String(this.state.err?.message||this.state.err)}</p><pre>{String(this.state.err?.stack||'missing field')}</pre></div>;
    return this.props.children;
  }
}


function HotkeysPanel({open,setOpen,hotkeys,setHotkeys,lang}){
  const t=T[lang];
  if(!open) return null;
  return <aside className="hotkeys-drawer open">
    <div className="settings-head">
      <div><h2>{t.hotkeys}</h2><small>{lang==='ru'?'отдельная панель рядом с настройками':'separate panel near settings'}</small></div>
      <button onClick={()=>setOpen(false)}>{t.close}</button>
    </div>
    <div className="theme-note">{lang==='ru'?'Кликни в поле и нажми нужную комбинацию. Поддерживаются Ctrl / Alt / Shift / Meta / F1–F12.':'Click a field and press a shortcut. Ctrl / Alt / Shift / Meta / F1–F12 supported.'}</div>
    <div className="hotkey-editor hotkey-editor-standalone">
      <label>{t.hotkeys}</label>
      <div className="hotkey-grid">
        <div className="hotkey-head">{t.action}</div><div className="hotkey-head">{t.shortcut}</div>
        {hotkeyLabels.map(([id,label])=><React.Fragment key={id}>
          <div className="hotkey-action">{label[lang]}</div>
          <input className="hotkey-input" value={hotkeys[id]||''} placeholder={t.clickToRecord}
            onKeyDown={e=>{e.preventDefault(); const s=normalizeShortcut(e); if(s) setHotkeys(v=>({...v,[id]:s}));}}
            onFocus={e=>e.currentTarget.select()}
            onChange={e=>setHotkeys(v=>({...v,[id]:e.target.value}))}/>
        </React.Fragment>)}
      </div>
      <button className="btn" style={{width:'100%',marginTop:8}} onClick={()=>setHotkeys(defaultHotkeys)}>{t.resetHotkeys}</button>
    </div>
  </aside>
}

function App(){
  const boot=useMemo(()=>buildWorkspaceBootstrap(),[]);
  const [storedLang,setStoredLang]=usePersistedState('ocm_v081_lang', boot.storedLang);
  const lang = storedLang === 'en' ? 'en' : 'ru';
  const setLang = (next)=>setStoredLang(next === 'en' ? 'en' : 'ru');
  const [theme,setTheme]=usePersistedState('ocm_v057_theme', boot.theme);
  const [density,setDensity]=usePersistedState('ocm_v057_density', boot.density);
  const [scale,setScale]=usePersistedState('ocm_v057_scale', boot.scale);
  const [radius,setRadius]=usePersistedState('ocm_v057_radius', boot.radius);
  const [uiFont,setUiFont]=usePersistedState('ocm_v075_ui_font', boot.uiFont);
  const [monoFont,setMonoFont]=usePersistedState('ocm_v075_mono_font', boot.monoFont);
  const [saturation,setSaturation]=usePersistedState('ocm_v075_saturation', boot.saturation);
  const [contrast,setContrast]=usePersistedState('ocm_v075_contrast', boot.contrast);
  const [glow,setGlow]=usePersistedState('ocm_v075_glow', boot.glow);
  const [hue,setHue]=usePersistedState('ocm_v092_hue', boot.hue);
  const [panelOpacity,setPanelOpacity]=usePersistedState('ocm_v089_panel_opacity', boot.panelOpacity);
  const [gridPower,setGridPower]=usePersistedState('ocm_v089_grid_power', boot.gridPower);
  const [headerPower,setHeaderPower]=usePersistedState('ocm_v089_header_power', boot.headerPower);
  const [shadowDepth,setShadowDepth]=usePersistedState('ocm_v090_shadow_depth', boot.shadowDepth);
  const [scanlines,setScanlines]=usePersistedState('ocm_v090_scanlines', boot.scanlines);
  const [noise,setNoise]=usePersistedState('ocm_v090_noise', boot.noise);
  const [textSharpness,setTextSharpness]=usePersistedState('ocm_v090_text_sharpness', boot.textSharpness);
  const [hotkeys,setHotkeys]=useLocalState('ocm_v090_hotkeys',defaultHotkeys);
  const [blockAccents,setBlockAccents]=usePersistedState('ocm_v075_block_accents', boot.blockAccents);
  const [layout,setLayout]=usePersistedState('ocm_v081_layout', boot.layout);
  const [collapsedMap,setCollapsedMap]=usePersistedState('ocm_v081_collapsed', boot.collapsedMap);
  const [visibleMap,setVisibleMap]=usePersistedState('ocm_v081_visible', boot.visibleMap);
  const [compact,setCompact]=usePersistedState('ocm_rc4c_compact', boot.compact);
  const [z,setZ]=useState(boot.z);
  const zCounter=useRef(100);
  const [settings,setSettings]=useState(false);
  const [hotkeysOpen,setHotkeysOpen]=useState(false);
  const [workspaceMode,setWorkspaceMode]=usePersistedState('ocm_v081_workspace_mode', boot.workspaceMode);
  const [workspaceTabs,setWorkspaceTabs]=usePersistedState('ocm_v081_workspace_tabs', boot.workspaceTabs);
  const [activeWorkspaceTab,setActiveWorkspaceTab]=usePersistedState('ocm_v081_active_workspace_tab', boot.activeWorkspaceTab);
  const [selectedScenario,setSelectedScenario]=usePersistedState('ocm_v081_scenario', boot.selectedScenario);
  const [adapterMode,setAdapterMode]=usePersistedState('ocm_v081_adapter_mode', boot.adapterMode);
  const [apiState,setApiState]=useState({trace:null,error:null,status:'idle',scenarios:[]});
  const t=T[lang] || T.ru;

  useEffect(()=>{ window.__ocmLang = lang; }, [lang]);

  useEffect(()=>{
    saveRc4cLayoutState({
      layout, collapsedMap, visibleMap, compact, workspaceTabs, activeWorkspaceTab,
      theme, density, scale, radius, uiFont, monoFont, saturation, contrast, glow,
      hue, panelOpacity, gridPower, headerPower, shadowDepth, scanlines, noise,
      textSharpness, blockAccents, workspaceMode, adapterMode, selectedScenario, lang, z
    });
  },[layout,collapsedMap,visibleMap,compact,workspaceTabs,activeWorkspaceTab,theme,density,scale,radius,uiFont,monoFont,saturation,contrast,glow,hue,panelOpacity,gridPower,headerPower,shadowDepth,scanlines,noise,textSharpness,blockAccents,workspaceMode,adapterMode,selectedScenario,lang,z]);

  useEffect(()=>{
    const root=document.documentElement;
    const body=document.body;
    const densityPx = density==='ultra' ? 5 : density==='compact' ? 7 : 10;
    const scaleNum = Math.min(1.35, Math.max(0.75, Number(scale)||1));
    const radiusNum = Math.min(34, Math.max(0, Number(radius)||2));
    body.dataset.theme=theme;
    body.dataset.uiFont=uiFont;
    body.dataset.monoFont=monoFont;
    body.dataset.density=density;
    body.dataset.lang=lang;
    root.style.setProperty('--scale', String(scaleNum));
    root.style.setProperty('--ui-scale', String(scaleNum));
    root.style.setProperty('--radius', radiusNum + 'px');
    root.style.setProperty('--density', densityPx + 'px');
    root.style.setProperty('--saturation', String(Number(saturation)||1));
    root.style.setProperty('--contrast', String(Number(contrast)||1));
    root.style.setProperty('--glow', String(Number(glow)||1));
    const accentBalance = Math.min(100, Math.max(-100, Number(hue)||0));
    root.style.setProperty('--hue', String(accentBalance));
    root.style.setProperty('--accent-white', String(Math.max(0, accentBalance)));
    root.style.setProperty('--accent-black', String(Math.max(0, -accentBalance)));
    root.style.setProperty('--panel-opacity', String(Math.min(1, Math.max(.72, Number(panelOpacity)||.94))));
    root.style.setProperty('--grid-power', String(Number(gridPower)||1));
    root.style.setProperty('--header-power', String(Number(headerPower)||1));
    root.style.setProperty('--shadow-depth', String(Number(shadowDepth)||1));
    root.style.setProperty('--scanlines', String(Number(scanlines)||0));
    root.style.setProperty('--noise', String(Number(noise)||0));
    root.style.setProperty('--text-sharpness', String(Number(textSharpness)||1));
  },[theme,density,scale,radius,uiFont,monoFont,saturation,contrast,glow,hue,panelOpacity,gridPower,headerPower,shadowDepth,scanlines,noise,textSharpness,lang]);
  const mockTrace=useMemo(()=>buildCanonicalTrace(baseTrace, selectedScenario),[selectedScenario]);
  useEffect(()=>{
    if(adapterMode!=='api') return;
    let live=true; setApiState(s=>({...s,status:'loading',error:null}));
    const adapter=new ApiAdapter();
    adapter.loadScenario(selectedScenario).then(data=>{ if(live) setApiState({trace:data.trace,error:data.error||null,status:data.error?'fallback':'ready',scenarios:data.scenarios||[]}); })
      .catch(err=>{ if(live) setApiState({trace:buildCanonicalTrace(baseTrace,'API_FAILURE_FALLBACK'),error:String(err.message||err),status:'fallback',scenarios:[]}); });
    return()=>{live=false};
  },[adapterMode,selectedScenario]);
  const trace=adapterMode==='api' && apiState.trace ? apiState.trace : mockTrace;
  const options=(adapterMode==='api' && apiState.scenarios?.length ? apiState.scenarios : scenarioOptions).map(x=>typeof x==='string'?{id:x,label:x,labelRu:x}:x);
  const modeOptions=[['custom',t.customMode],['overview',t.overviewMode],['compute',t.computeMode],['rules',t.rulesMode],['audit',t.auditMode]];
  useEffect(()=>{
    if(!workspaceTabs.some(tab=>tab.id===activeWorkspaceTab) && workspaceTabs[0]){
      setActiveWorkspaceTab(workspaceTabs[0].id);
    }
  },[workspaceTabs,activeWorkspaceTab]);
  function currentWorkspacePayload(){ return profilePayload({layout,collapsedMap,visibleMap,theme,density,scale,radius,workspaceMode,uiFont,monoFont,saturation,contrast,glow,hue,panelOpacity,gridPower,headerPower,shadowDepth,scanlines,noise,textSharpness,blockAccents}); }
  useEffect(()=>{
    setWorkspaceTabs(prev=>prev.map(tab=>tab.id===activeWorkspaceTab ? {...tab,payload:currentWorkspacePayload()} : tab));
  },[layout,collapsedMap,visibleMap,theme,density,scale,radius,workspaceMode,uiFont,monoFont,saturation,contrast,glow,hue,panelOpacity,gridPower,headerPower,shadowDepth,scanlines,noise,textSharpness,blockAccents,activeWorkspaceTab]);
  function applyWorkspacePayload(payload){ if(!payload) return; if(payload.layout) setLayout(stripLayout(payload.layout)); if(payload.collapsedMap) setCollapsedMap(payload.collapsedMap); if(payload.visibleMap) setVisibleMap(sanitizeVisible(payload.visibleMap)); if(payload.theme) setTheme(payload.theme); if(payload.density) setDensity(payload.density); if(payload.scale) setScale(String(payload.scale)); if(payload.radius) setRadius(String(payload.radius)); if(payload.workspaceMode) setWorkspaceMode(payload.workspaceMode); if(payload.uiFont) setUiFont(payload.uiFont); if(payload.monoFont) setMonoFont(payload.monoFont); if(payload.saturation) setSaturation(String(payload.saturation)); if(payload.contrast) setContrast(String(payload.contrast)); if(payload.glow) setGlow(String(payload.glow)); if(payload.hue) setHue(String(payload.hue)); if(payload.panelOpacity) setPanelOpacity(String(payload.panelOpacity)); if(payload.gridPower) setGridPower(String(payload.gridPower)); if(payload.headerPower) setHeaderPower(String(payload.headerPower)); if(payload.shadowDepth) setShadowDepth(String(payload.shadowDepth)); if(payload.scanlines) setScanlines(String(payload.scanlines)); if(payload.noise) setNoise(String(payload.noise)); if(payload.textSharpness) setTextSharpness(String(payload.textSharpness)); if(payload.blockAccents) setBlockAccents(payload.blockAccents); }
  function selectWorkspaceTab(id){ const tab=workspaceTabs.find(x=>x.id===id); if(tab){ setActiveWorkspaceTab(id); applyWorkspacePayload(tab.payload); } }
  function applyWorkspaceMode(m){ setWorkspaceMode(m); applyWorkspacePayload(payloadFromPreset(m)); }
  function addWorkspaceTab(){ const id='ws_'+Date.now(); setWorkspaceTabs([...workspaceTabs,{id,name:lang==='ru'?'Новая сцена':'New Scene',pinned:false,payload:currentWorkspacePayload()}]); setActiveWorkspaceTab(id); }
  function renameWorkspaceTab(id){ const name=prompt(lang==='ru'?'Название рабочей сцены':'Workspace name', workspaceTabs.find(x=>x.id===id)?.name||'Workspace'); if(name) setWorkspaceTabs(workspaceTabs.map(x=>x.id===id?{...x,name}:x)); }
  function duplicateWorkspaceTab(id){ const tab=workspaceTabs.find(x=>x.id===id); if(tab){ const nid='ws_'+Date.now(); setWorkspaceTabs([...workspaceTabs,{...tab,id:nid,name:tab.name+(lang==='ru'?' копия':' copy'),pinned:false,payload:currentWorkspacePayload()}]); setActiveWorkspaceTab(nid); } }
  function deleteWorkspaceTab(id){ if(workspaceTabs.length<=1) return; const next=workspaceTabs.filter(x=>x.id!==id); setWorkspaceTabs(next); if(activeWorkspaceTab===id) setActiveWorkspaceTab(next[0].id); }
  function exportWorkspaceTab(id){ const tab=workspaceTabs.find(x=>x.id===id); if(!tab) return; const blob=new Blob([JSON.stringify(tab,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${tab.name}.json`; a.click(); URL.revokeObjectURL(a.href); }
  function importWorkspaceTab(){ alert(lang==='ru'?'Импорт рабочей области: используйте сохранённый JSON в файловом окне браузера.':'Import workspace: use saved JSON in a browser file picker in the full environment.'); }
  function resetAll(){
    const message = lang==='ru'
      ? 'Сбросить сохранённую раскладку? Это действие нельзя отменить.'
      : 'Reset saved layout? This action cannot be undone.';
    if(!window.confirm(message)) return;
    clearRc4cLayoutState();
    setCompact(false); setCollapsedMap({}); setVisibleMap(defaultVisible()); setWorkspaceMode('custom');
    setWorkspaceTabs(makeDefaultWorkspaceTabs()); setActiveWorkspaceTab('overview'); setBlockAccents({}); setLayout(defaultLayout());
    setZ(Object.fromEntries(allWindowIds.map(id=>[id,0])));
    window.alert(lang==='ru'?'Раскладка сброшена вручную.':'Layout was reset manually.');
  }

  useEffect(()=>{
    const onKey=(e)=>{
      const tag=(e.target?.tagName||'').toLowerCase();
      if(['input','textarea','select'].includes(tag)) return;
      const hk={...defaultHotkeys,...(hotkeys||{})};
      for(let i=1;i<=12;i++){
        if(shortcutMatches(e,hk['scene'+i])){
          const tab=workspaceTabs[i-1];
          if(tab){ e.preventDefault(); selectWorkspaceTab(tab.id); }
          return;
        }
      }
      if(shortcutMatches(e,hk.newScene)){ e.preventDefault(); addWorkspaceTab(); return; }
      if(shortcutMatches(e,hk.closeScene)){ e.preventDefault(); deleteWorkspaceTab(activeWorkspaceTab); return; }
      if(shortcutMatches(e,hk.nextScene) || shortcutMatches(e,hk.prevScene)){
        e.preventDefault();
        const idx=Math.max(0, workspaceTabs.findIndex(x=>x.id===activeWorkspaceTab));
        const dir=shortcutMatches(e,hk.prevScene) ? -1 : 1;
        const next=(idx+dir+workspaceTabs.length)%workspaceTabs.length;
        selectWorkspaceTab(workspaceTabs[next].id);
        return;
      }
      if(shortcutMatches(e,hk.saveScene)){ e.preventDefault(); setWorkspaceTabs(prev=>prev.map(tab=>tab.id===activeWorkspaceTab?{...tab,payload:currentWorkspacePayload()}:tab)); return; }
      if(shortcutMatches(e,hk.settings)){ e.preventDefault(); setSettings(v=>!v); return; }
      if(shortcutMatches(e,hk.hotkeys)){ e.preventDefault(); setHotkeysOpen(v=>!v); return; }
      if(shortcutMatches(e,hk.toggleCompact)){ e.preventDefault(); setCompact(v=>!v); return; }
      if(shortcutMatches(e,hk.resetLayout)){ e.preventDefault(); resetAll(); return; }
      if(shortcutMatches(e,hk.overviewMode)){ e.preventDefault(); applyWorkspaceMode('overview'); return; }
      if(shortcutMatches(e,hk.computeMode)){ e.preventDefault(); applyWorkspaceMode('compute'); return; }
      if(shortcutMatches(e,hk.rulesMode)){ e.preventDefault(); applyWorkspaceMode('rules'); return; }
      if(shortcutMatches(e,hk.auditMode)){ e.preventDefault(); applyWorkspaceMode('audit'); return; }
      if(shortcutMatches(e,hk.showAll)){ e.preventDefault(); setVisibleMap(defaultVisible()); return; }
      if(shortcutMatches(e,hk.hideAll)){ e.preventDefault(); setVisibleMap(Object.fromEntries(allWindowIds.map(id=>[id,false]))); return; }
    };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[workspaceTabs,activeWorkspaceTab,layout,collapsedMap,visibleMap,theme,density,scale,radius,workspaceMode,uiFont,monoFont,saturation,contrast,glow,hue,panelOpacity,gridPower,headerPower,shadowDepth,scanlines,noise,textSharpness,blockAccents,hotkeys]);


  const windows=[
    ['coreOverview',windowMeta.coreOverview?.[lang] || '00 Пульт ядра',<CoreOverviewPanel lang={lang} trace={trace} setVisibleMap={setVisibleMap} setZ={setZ} zCounter={zCounter}/>],
    ['liveStream',windowMeta.liveStream?.[lang] || '17 Живой поток',<LiveMarketStreamPanel lang={lang} trace={trace}/>],
    ['operatorTruth',windowMeta.operatorTruth?.[lang] || 'Правда для оператора',<OperatorTruthSummary lang={lang} trace={trace}/>],
    ['pulse',windowMeta.pulse?.[lang] || t.machinePulse,<Pulse lang={lang} trace={trace}/>],
    ['event',windowMeta.event?.[lang] || t.activeEvent,<ActiveEvent lang={lang} trace={trace}/>],
    ['pipeline',windowMeta.pipeline?.[lang] || t.pipeline,<Pipeline lang={lang} trace={trace}/>],
    ['raw',windowMeta.raw?.[lang] || t.rawTrace,<RawTrace trace={trace}/>],
    ['steps',windowMeta.steps?.[lang] || t.steps,<ComputationSteps lang={lang} trace={trace}/>],
    ['formulas',windowMeta.formulas?.[lang] || t.formulas,<FormulaInspector lang={lang} trace={trace}/>],
    ['rules',windowMeta.rules?.[lang] || t.rules,<RuleEngine lang={lang} trace={trace}/>],
    ['diff',windowMeta.diff?.[lang] || t.diff,<SnapshotDiff lang={lang} trace={trace}/>],
    ['verdict',windowMeta.verdict?.[lang] || t.miniVerdict,<MiniVerdict lang={lang} trace={trace}/>],
    ['gateTrace',windowMeta.gateTrace?.[lang] || t.gateTrace,<GateLedgerTrace lang={lang} trace={trace}/>],
    ['revision',windowMeta.revision?.[lang] || (lang==='ru'?'Линия ревизий':'Revision Timeline'),<RevisionTimeline lang={lang} trace={trace}/>],
    ['marketIntegrity',windowMeta.marketIntegrity?.[lang] || t.marketIntegrity,<MarketIntegrityPanel lang={lang} trace={trace}/>],
    ['provenance',windowMeta.provenance?.[lang] || t.provenance,<ProvenancePanel lang={lang} trace={trace}/>],
    ['recovery',windowMeta.recovery?.[lang] || (lang==='ru'?'Панель восстановления':'Recovery Panel'),<RecoveryPanel lang={lang} trace={trace}/>],
    ['replay',windowMeta.replay?.[lang] || (lang==='ru'?'Панель повтора':'Replay Panel'),<ReplayPanel lang={lang} trace={trace}/>],
    ['failure',windowMeta.failure?.[lang] || (lang==='ru'?'Матрица отказов / визуализация':'Failure Matrix / Failure Visualization'),<FailurePanel lang={lang} trace={trace}/>],
  ];
  return <div className="app">
    <header className="topbar">
      <div className="brand"><div className="kicker">{lang==='ru'?'Интерфейс MBG Core · Панель оператора':'MBG Core Interface · Operator Panel'}</div><h1>{t.title}</h1><p>{adapterMode==='api'?'ApiAdapter: http://localhost:3011':(lang==='ru'?'MockAdapter: локальные DTO / симуляция':'MockAdapter: local DTO / simulation')} · {apiState.error ? (lang==='ru'?`резервный режим: ${apiState.error}`:`fallback: ${apiState.error}`) : (lang==='ru'?'только отображение':'read-only display')}</p></div>
      <WorkspaceTabs tabs={workspaceTabs} activeId={activeWorkspaceTab} onSelect={selectWorkspaceTab} onAdd={addWorkspaceTab} onRename={renameWorkspaceTab} onDuplicate={duplicateWorkspaceTab} onDelete={deleteWorkspaceTab} onExport={exportWorkspaceTab} onImport={importWorkspaceTab} lang={lang}/>
      <div className="actions">
        <select className="mode-select" value={adapterMode} onChange={e=>setAdapterMode(e.target.value)}><option value="mock">MockAdapter</option><option value="api">ApiAdapter</option></select>
        <select className="mode-select" value={workspaceMode} onChange={e=>applyWorkspaceMode(e.target.value)} title={t.mode}>{modeOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
        <select className="mode-select" value={selectedScenario} onChange={e=>setSelectedScenario(e.target.value)} title={t.scenario}>{options.map(opt=><option key={opt.id} value={opt.id}>{lang==='ru'?(opt.labelRu||opt.id):(opt.label||opt.id)}</option>)}</select>
        <button className="btn" onClick={()=>setLang(lang==='ru'?'en':'ru')} title={lang==='ru'?'Переключить язык на EN':'Switch language to RU'}>RU / EN · {lang.toUpperCase()}</button>
        <button className="btn" onClick={()=>setSettings(true)}>⚙ {t.settings}</button>
        <button className="btn" onClick={()=>setHotkeysOpen(true)}>⌘ {t.hotkeys}</button>
        <button className="btn" onClick={()=>setCompact(v=>!v)}>{t.compact}</button>
        <button className="btn" onClick={resetAll}>↻ {t.reset}</button>
        <div className="badge">RC4-C · {lang==='ru'?'сохранение раскладки':'layout persistence'} · {selectedScenario}</div>
      </div>
    </header>
    {adapterMode==='api' && apiState.status==='loading' && <div className="api-banner">{lang==='ru'?'ApiAdapter: загрузка DTO ядра...':'ApiAdapter: loading core DTO...'}</div>}
    <main className="workspace">
      {windows.filter(w=>visibleMap[w[0]]!==false).map(([id,title,content])=><Window key={id} id={id} title={title} layout={layout} setLayout={setLayout} z={z} setZ={setZ} compact={compact} collapsedMap={collapsedMap} setCollapsedMap={setCollapsedMap} zCounter={zCounter} blockAccents={blockAccents} setBlockAccents={setBlockAccents} setVisibleMap={setVisibleMap} lang={lang}>{content}</Window>)}
    </main>
    <footer className="footer"><span>v0.9.2 · {adapterMode}</span><span>{lang==='ru'?'POST/PUT/PATCH/DELETE закрыты · execution/trading controls отсутствуют':'No POST/PUT/PATCH/DELETE · no execution/trading controls'}</span><span>trace: {safeValue(trace.traceId, lang)}</span></footer>
    <HotkeysPanel open={hotkeysOpen} setOpen={setHotkeysOpen} hotkeys={{...defaultHotkeys,...hotkeys}} setHotkeys={setHotkeys} lang={lang}/>
    <Settings open={settings} setOpen={setSettings} theme={theme} setTheme={setTheme} density={density} setDensity={setDensity} scale={scale} setScale={setScale} radius={radius} setRadius={setRadius} uiFont={uiFont} setUiFont={setUiFont} monoFont={monoFont} setMonoFont={setMonoFont} saturation={saturation} setSaturation={setSaturation} contrast={contrast} setContrast={setContrast} glow={glow} setGlow={setGlow} hue={hue} setHue={setHue} panelOpacity={panelOpacity} setPanelOpacity={setPanelOpacity} gridPower={gridPower} setGridPower={setGridPower} headerPower={headerPower} setHeaderPower={setHeaderPower} shadowDepth={shadowDepth} setShadowDepth={setShadowDepth} scanlines={scanlines} setScanlines={setScanlines} noise={noise} setNoise={setNoise} textSharpness={textSharpness} setTextSharpness={setTextSharpness} hotkeys={{...defaultHotkeys,...hotkeys}} setHotkeys={setHotkeys} blockAccents={blockAccents} setBlockAccents={setBlockAccents} layout={layout} setLayout={setLayout} collapsedMap={collapsedMap} setCollapsedMap={setCollapsedMap} visibleMap={sanitizeVisible(visibleMap)} setVisibleMap={setVisibleMap} workspaceMode={workspaceMode} setWorkspaceMode={setWorkspaceMode} lang={lang}/>
  </div>
}

const rootEl=document.getElementById('root');
if(!rootEl){
  document.body.innerHTML='<div class="fatal-panel"><h1>Runtime render error</h1><p>#root missing</p></div>';
}else{
  createRoot(rootEl).render(<ErrorBoundary><App/></ErrorBoundary>);
}
