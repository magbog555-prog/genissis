# Карта библиотеки для рыночного архитектора

Источник: `library.json` · ~151 единица · Genessis books  
Роль: **рыночный архитектор** — проектирует структуру рынка/системы: аукцион, край, риск, валидацию и исполнение — а не «набор индикаторов».

---

## 1. Логика слоёв (от рынка к коду)

```
L0  Микроструктура / аукцион     → как формируется цена
L1  Рыночная структура           → фазы, волны, уровни, режимы
L2  Наблюдаемость (TA toolkit)   → что измеряем на графике
L3  Дизайн системы               → правила, гипотезы, портфель систем
L4  Риск и капитал               → выживаемость и масштаб
L5  Поведение / процесс          → оператор и дисциплина
L6  Макро / фундаментал            → контекст режима
L7  Деривативы / волатильность   → перенос риска
L8  Quant / ML research          → исследовательский контур
LX  Опыт мастеров (семантика)    → паттерны мышления, не копипаст
```

Слои **родственны по вертикали**: L0→L3 — «как устроен край»; L4→L5 — «как не умереть»; L6→L7 — «в каком режиме»; L8 — «как исследовать честно».

---

## 2. Кластеры родства (семьи знаний)

### A. Аукцион и объём (Market Architecture core)
| Родство | Книги / авторы |
|---|---|
| Market Profile / auction | Dalton — Markets in Profile; Dalton — footprint / «Разум над рынками» |
| VSA / operators | Tom Williams — «Хозяева рынка» |
| Wyckoff | Hutson — метод Wyckoff |
| Связка | Аукцион (Dalton) + операторы (Williams) + накопление/распределение (Wyckoff) = **каркас чтения потока** |

### B. Волны и геометрия цены
| Родство | Книги |
|---|---|
| Elliott | Frost & Prechter; Bolton; Safonov; Joseph |
| Fibonacci | Fisher ×2 |
| Fractals / chaos | Peters; Almazov; Bill Williams (Chaos 2, New Dimensions) |
| Gann / time | Hyerczyk |

Использовать как **язык режимов и пропорций**, не как единственный сигнал.

### C. Классический TA (инструментарий)
Murphy · Schwager TA · Nison / Morris (свечи) · Bollinger · DeMark · Colby (энциклопедия индикаторов) · Pring · DiNapoli · Ichimoku (заметки)

Это **библиотека наблюдаемых признаков**, не архитектура сама по себе.

### D. Системный дизайн и валидация
| Родство | Книги |
|---|---|
| Design / test | Pardo — разработка и тестирование ТС |
| Strategies catalog | Katz/McCormick — энциклопедия стратегий |
| Systems practice | Kurguzkin (структура игры + системный подход); Solabuto; mechanical systems; Chebotarev (роботы RF) |
| Stats / features | Bulashev — статистика; LeBeau & Lucas — компьютерный анализ фьючерсов |
| Process / psychol. of systems | Tharp (×3); Elder; Raschke/Connors Street Smarts |

### E. Риск и капитал (скелет архитектора)
Vince (математика капитала) · Grant (риск в трейдинге) · Taleb (Fooled + Black Swan) · Bernstein (asset allocation) · Chekulaev (risk + volatility) · CCP clearing

Без этого слоя «система» — декорация.

### F. Поведение
Burnham (lizard brain) · Cohen (страх/алчность) · Nudge · Akerlof/Shiller Phishing for Phools · Feniks brochure (ошибки)

### G. Фундамент / макро / value
Graham Security Analysis · Fisher (growth) · Bogle · Yamarone (econ indicators) · Fundamentalnyy analiz (крупный том) · Hayek / Vera Smith (деньги/ЦБ)

### H. Деривативы
Burenin · Feldman · Shvedov · Connolly (vol) · Chekulaev vol

### I. Research / ML (современный контур)
**Lopez de Prado — AFML (RU)** · Data Mining (`_large`, ~328 MB) · CS/Rust/C# (инфраструктура) · Patterson Quants · Weatherall Physics of Wall Street

### J. Семантика мастеров (не сигналы)
Schwager Wizards trilogy · Lefèvre / Livermore circle · Covel Turtles · Sperandeo · Lewis Big Short · Das Traders Guns Money

### K. Вне контура архитектора
Fiction: Ridpath, Davidson · business outlier: Kotin · Popper (наука, полезен как эпистемология) · `_software` вынесен · TelegramSender не в библиотеке

---

## 3. Что брать в работу как рыночный архитектор

### Ядро (читать / держать открытым)
1. **Dalton** (Profile + footprint) + **Tom Williams VSA** + **Wyckoff** → модель аукциона  
2. **Pardo** + **Kurguzkin (системный подход)** + **Katz encyclopedia** → дизайн и каталог гипотез  
3. **Vince** + **Grant** + **Taleb** → каркас риска и масштаб  
4. **Lopez de Prado (AFML)** → честный research / anti-overfit контур  
5. **Murphy / Schwager TA / Nison** → общий язык признаков  
6. **Tharp / Elder** → процесс и размер позиции как часть архитектуры  

### Усилители (по задаче)
- Режим волатильности / опционы → Connolly, Chekulaev vol, Burenin  
- Волновой/геометрический слой → Frost/Prechter, Fisher, Williams Chaos  
- Макро-контекст → Yamarone, Graham, fundamental tome  
- Crypto perimeter → Mastering Bitcoin, How to DeFi (отдельный контур)

### Вторично / осторожно
- Retail Forex (50 Shades, Ahundov) — шум относительно архитектуры  
- Короткие курсы «Школа успешного трейдера», Feniks brochure — мотивация/чеклисты, не каркас  
- Огромные сканы без структуры (`Ispoved` — всё ещё неопознан; Fundamentalnyy 54 MB) — не приоритет  
- Data Mining 328 MB — справочник в `_large`, не daily driver  

### Не путать с работой архитектора
- Художественная проза про рынки (Ridpath и т.п.)  
- Копирование «магов» без своей спецификации гипотез и риска  

---

## 4. Рекомендуемый порядок работы (практический трек)

| Этап | Цель | Материал |
|---|---|---|
| 1 | Модель рынка | Dalton → Williams VSA → Wyckoff |
| 2 | Язык признаков | Murphy / Nison; выборочно Colby |
| 3 | Спецификация системы | Kurguzkin + Pardo |
| 4 | Риск-архитектура | Vince + Grant; Taleb как эпистемология |
| 5 | Research hygiene | Lopez de Prado AFML |
| 6 | Расширение режимов | vol/derivatives; Elliott/Fib как опциональный слой |
| 7 | Калибровка мышления | Schwager Wizards; Tharp |

---

## 5. Заключение

Библиотека **сильная для рыночного архитектора** в части:
- аукциона / профиля / VSA / Wyckoff  
- системного дизайна и тестирования  
- риска и антихрупкой эпистемологии  
- ML-research (Prado)

Слабее / шумнее:
- разрозненный retail Forex  
- неопознанные/тяжёлые сканы  
- дублирующий курсный материал  

**Рабочий вывод:** строить архитектуру вокруг связки  
`Аукцион (Dalton/VSA/Wyckoff) → Система (Pardo/Kurguzkin) → Риск (Vince/Grant/Taleb) → Research (Prado)`,  
а остальное подключать как модули признаков и контекста.
