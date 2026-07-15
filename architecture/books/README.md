# Genessis Books Library

Профессионально организованная библиотека: `D:\genessis\architecture\books`

| | |
|---|---|
| Всего единиц | **152** (после очистки дублей) |
| Каталог | `catalog/library.json` + `catalog/library.csv` |
| Манифест перемещений | `catalog/move-manifest-*.json` (откат old→new) |
| Лог удалений | `catalog/deletion-log-*.json` |

## Как пользоваться

### Быстрый поиск (Excel / Notion / таблица)
Откройте `catalog/library.csv` — колонки: `id`, `category`, `author`, `title`, `tags`, `notes`, `duplicate_candidate`, `format`, `size_mb`, `relative_path`, `original_name`.

### Программный доступ
```powershell
$lib = Get-Content 'D:\genessis\architecture\books\catalog\library.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$lib.items | Where-Object { $_.tags -contains 'wyckoff' }
$lib.items | Where-Object { $_.author -match 'Schwager' }
$lib.items | Where-Object { $_.category -eq '07_crypto_defi' }
```

Или helper:
```powershell
D:\genessis\architecture\books\catalog\Search-Library.ps1 -Query "nison"
D:\genessis\architecture\books\catalog\Search-Library.ps1 -Tag "risk"
D:\genessis\architecture\books\catalog\Search-Library.ps1 -Category "01_technical_analysis"
```

### Открыть книгу по id
```powershell
$b = ($lib.items | Where-Object id -eq 'B042')
Invoke-Item $b.absolute_path
```

## Таксономия

| Папка | Содержание |
|-------|------------|
| `01_technical_analysis` | Свечи, индикаторы, Эллиотт, Фибоначчи, Wyckoff, VSA, Market Profile, Ганн |
| `02_trading_systems_practice` | ТС, daytrading, Forex, курсы, Elder/Tharp/Nayman/Safin/Gerchik |
| `03_market_wizards_bios` | «Маги рынка», биографии, Lefèvre, Lewis |
| `04_psychology_behavior` | Поведенческие финансы, nudge, психология рынка |
| `05_risk_money_management` | Риск, MM, Taleb, asset allocation |
| `06_investing_fundamental` | Грэм, Богл, фундаментальный анализ, макро |
| `07_crypto_defi` | Bitcoin, DeFi, ICO |
| `08_derivatives_options` | Фьючерсы, опционы, волатильность |
| `09_programming_quant` | C#, Rust, CS, ML |
| `10_misc` | Вне основного контура |
| `_archives` | ZIP — смотреть/распаковать избирательно |
| `_software` | Не книги (TelegramSender и т.п.) |
| `_review_duplicates` | Кандидаты на удаление после проверки |
| `catalog/` | Индексы и манифесты |

## Очистка дублей (2026-07-16)

Удалено (~31 MB): 6 глав Mastering Bitcoin · Фленов C# 2016 · C Sharp materials 2.  
Оставлено и перенесено: оба файла Чекулаева «Торговля волатильностью» → `08_derivatives_options` (разные SHA256).

## Распаковка архивов (2026-07-16)

Все 4 ZIP извлечены, контейнеры удалены:

| Было (ZIP) | Куда |
|---|---|
| Taleb «Чёрный лебедь» | `05_risk_money_management/` |
| Williams «Торговый хаос 2» | `01_technical_analysis/` |
| «Биржа. Будет не легко» (PDF; DJVU отброшен) | `03_market_wizards_bios/` |
| Data Mining (~328 MB PDF) | `09_programming_quant/` |

Лог: `catalog/archives-cleanup-*.json`. Папка `_archives` пуста.

## Ревью неясных книг (2026-07-16)

Идентифицированы и переименованы:
- Trading Web → **Кургузкин** «Биржевой трейдинг: системный подход»
- Elliott Materialy → **Frost & Prechter** «Волновой принцип Эллиотта»
- Lebo → **LeBeau & Lucas** «Компьютерный анализ фьючерсных рынков»
- Бегущие по граблям → брошюра **Феникс** (в practice)
- Льюис «Большая игра на понижение» → из `10_misc` в wizards

Вынесено:
- TelegramSender → `D:\genessis\tools\`
- Data Mining (~328 MB) → `_large/`

## Карта для рыночного архитектора

См. `catalog/ARCHITECT_MAP.md` — слои, кластеры родства, что брать в работу.

## Official Knowledge Base (v1)

`knowledge_base/` — reverse map по 15 органам и 8 семьям мышления, реестры, crowd map, algorithms reuse.  
Handoff zip: `D:\genessis\architecture\handoff\GENESIS_TRADER_KNOWLEDGE_BASE_DISCOVERY_AND_REVERSE_MAP_v1.zip`  
Доктрина: **знание из книги ≠ edge ≠ production rule**.

## Очередь на ревью

1. `03_market_wizards_bios/Ispoved.pdf` — 354 стр., скан без текста (единственный неопознанный)
2. ~~Mashinnoe obuchenie~~ → **Lopez de Prado AFML** (опознан, переименован)

## Именование

Шаблон: `Author - Title.ext` (латиница/транслит для стабильности путей и Git).

Оригинальные имена сохранены в поле `original_name` и в `move-manifest-*.json`.

## Откат перемещения

```powershell
$m = Get-Content 'D:\genessis\architecture\books\catalog\move-manifest-20260716-013048.json' -Raw -Encoding UTF8 | ConvertFrom-Json
# Внимание: откат вручную — from был корень, to = относительный путь
foreach ($e in $m) {
  $src = Join-Path 'D:\genessis\architecture\books' ($e.to -replace '/','\')
  $dst = Join-Path 'D:\genessis\architecture\books' $e.from
  if (Test-Path -LiteralPath $src) { Move-Item -LiteralPath $src -Destination $dst }
}
```

## Добавление новой книги

1. Положить файл в нужную папку таксономии (или в корень и перезапустить `catalog/organize.ps1` после доработки rules).
2. Дописать запись в `library.json` / пересобрать CSV — либо расширить `organize.ps1` и прогнать только на новые файлы.
3. Теги держать короткими: `ta`, `risk`, `bitcoin`, `elder`, …

---
Сгенерировано автоматически при подготовке библиотеки. Дальше каталог — источник истины для поиска и автоматизации.
