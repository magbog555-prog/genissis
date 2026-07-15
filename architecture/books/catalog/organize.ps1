#Requires -Version 5.1
<#
.SYNOPSIS
  Professional library prep for D:\genessis\architecture\books
.NOTES
  Creates taxonomy folders, moves+renames files, writes catalog + rollback manifest.
#>
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Root = 'D:\genessis\architecture\books'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

# --- Taxonomy ---
$Folders = @(
  '01_technical_analysis',
  '02_trading_systems_practice',
  '03_market_wizards_bios',
  '04_psychology_behavior',
  '05_risk_money_management',
  '06_investing_fundamental',
  '07_crypto_defi',
  '08_derivatives_options',
  '09_programming_quant',
  '10_misc',
  '_archives',
  '_software',
  '_review_duplicates',
  'catalog'
)

foreach ($f in $Folders) {
  $p = Join-Path $Root $f
  if (-not (Test-Path -LiteralPath $p)) { New-Item -ItemType Directory -Path $p | Out-Null }
}

function Clean-BaseName([string]$name) {
  $b = [System.IO.Path]::GetFileNameWithoutExtension($name)
  $b = $b -replace '^\++', ''
  $b = $b -replace '^_+', ''
  $b = $b -replace '\s*\(1\)\s*$', ''
  $b = $b -replace '\.compressed$', ''
  $b = $b -replace '\.pdf$', ''
  $b = $b -replace '_+', ' '
  $b = $b -replace '\s+', ' '
  $b = $b.Trim(' ', '.', '-', '_')
  # fix common OCR/encoding artifacts in known patterns
  $b = $b -replace 'Trei_?774_?dery', 'Traders'
  $b = $b -replace 'bitkoi-?774-?n', 'bitcoin'
  $b = $b -replace 'Cfmou4itel', 'Samouchitel'
  $b = $b -replace 'encyiklopyedyiya', 'entsiklopediya'
  $b = $b -replace 'tryeydyera', 'treydera'
  $b = $b -replace 'tehnicheskiy', 'tekhnicheskiy'
  return $b
}

function Get-SafeFileName([string]$base, [string]$ext) {
  # Windows illegal chars
  $safe = $base -replace '[<>:"/\\|?*]', ''
  $safe = $safe.Trim()
  if ([string]::IsNullOrWhiteSpace($safe)) { $safe = 'untitled' }
  # max path safety: keep basename reasonably short
  if ($safe.Length -gt 120) { $safe = $safe.Substring(0, 120).Trim() }
  return "$safe$ext"
}

# Explicit overrides: OriginalName -> @{ Cat; NewBase; Author; Title; Tags; Notes; Dup }
# NewBase null => Clean-BaseName
$Overrides = @{}

function Add-O([string]$orig, [string]$cat, [string]$newBase, [string]$author, [string]$title, [string[]]$tags, [string]$notes = '', [bool]$dup = $false) {
  $Overrides[$orig] = @{
    Cat = $cat; NewBase = $newBase; Author = $author; Title = $title
    Tags = $tags; Notes = $notes; Dup = $dup
  }
}

# --- SOFTWARE ---
Add-O 'TelegramSender_Modul_L54_20231217.rar' '_software' 'TelegramSender_Modul_L54_20231217' '' 'TelegramSender Module L54' @('software','not-book') 'Not a book — messenger module archive'

# --- ARCHIVES ---
Add-O 'Методы Data Mining для анализа моделей сложных систем.zip' '_archives' 'Data Mining - metody analiza modeley slozhnyh sistem' '' 'Data Mining methods for complex systems' @('archive','quant','ml') 'Large archive 321MB — extract selectively'
Add-O 'Книга «Биржа. Будет не легко».zip' '_archives' 'Birzha - Budet ne legko' '' 'Birzha. Budet ne legko' @('archive','trading') 'Unextracted archive'
Add-O 'Черный Лебедь Талеб.zip' '_archives' 'Taleb - Chernyy Lebed' 'Nassim Taleb' 'The Black Swan (RU)' @('archive','risk','taleb')
Add-O 'bill_vilyams_torgovyj_haos_2.zip' '_archives' 'Williams Bill - Torgovyy haos 2' 'Bill Williams' 'Trading Chaos 2 (RU)' @('archive','williams','ta')

# --- TECHNICAL ANALYSIS ---
Add-O 'S.Nison._The_Japanese_candles._The_graphic_analysis_financial_market.pdf' '01_technical_analysis' 'Nison Steve - Yapounskie svechi' 'Steve Nison' 'Japanese Candlestick Charting (RU)' @('candles','nison','ta')
Add-O 'Stiv-Nison.-Za-granyu-yaponskikh-svechey.pdf' '01_technical_analysis' 'Nison Steve - Za granyu yaponskih svechey' 'Steve Nison' 'Beyond Candlesticks (RU)' @('candles','nison','ta')
Add-O 'G.Morris.Yaponskie-svechi-metody-analiza-akciy-proverennye-vr.pdf' '01_technical_analysis' 'Morris Greg - Yapounskie svechi metody analiza' 'Greg Morris' 'Candlestick Charting Explained (RU)' @('candles','ta')
Add-O 'bollindzher_o_lentah_bollindzhera.pdf' '01_technical_analysis' 'Bollinger John - O lentah Bollingera' 'John Bollinger' 'Bollinger on Bollinger Bands (RU)' @('bollinger','ta')
Add-O 'T_Demark-tehnicheskiy-analiz.pdf' '01_technical_analysis' 'DeMark Tom - Tekhnicheskiy analiz' 'Tom DeMark' 'The New Science of Technical Analysis (RU)' @('demark','ta')
Add-O 'T.Dzhozef._The_simplified_analysis_of_a_wave_of_Elliotta.pdf' '01_technical_analysis' 'Joseph T - Uproshchennyy analiz voln Elliotta' 'T. Joseph' 'Simplified Elliott Wave (RU)' @('elliott','ta')
Add-O '+Сафонов.Практическое использование волн Эллиотта.djvu' '01_technical_analysis' 'Safonov - Prakticheskoe ispolzovanie voln Elliotta' 'Safonov' 'Practical Elliott Wave (RU)' @('elliott','ta')
Add-O 'А.Г.Болтон.Полное собрание работ по волнам Эллиотта.pdf' '01_technical_analysis' 'Bolton A.G. - Polnoe sobranie rabot po volnam Elliotta' 'A.G. Bolton' 'Complete Elliott Wave Works (RU)' @('elliott','ta')
Add-O 'R_Fisher_Posledovatelnost_Fibonachchi_Prilozhenia_i_strategii_dlya_treyderov.pdf' '01_technical_analysis' 'Fisher R - Fibonacci dlya treyderov' 'Robert Fisher' 'Fibonacci Applications for Traders (RU)' @('fibonacci','ta')
Add-O 'Р.Фишер.Новые методы торговли по Фибоначчи.pdf' '01_technical_analysis' 'Fisher R - Novye metody torgovli po Fibonachchi' 'Robert Fisher' 'New Fibonacci Trading Methods (RU)' @('fibonacci','ta')
Add-O 'D.Hatson._Method_Vaykoffa.pdf' '01_technical_analysis' 'Hutson D - Metod Wyckoffa' 'D. Hutson' 'Wyckoff Method (RU)' @('wyckoff','ta')
Add-O 'tom-williams-hozyaeva-rinka.compressed.pdf' '01_technical_analysis' 'Williams Tom - Hozyaeva rynka' 'Tom Williams' 'Master the Markets / VSA (RU)' @('vsa','williams','ta')
Add-O 'Tehanaliz-polnyy-kurs-D.-Shvager.pdf' '01_technical_analysis' 'Schwager Jack - Tehanaliz polnyy kurs' 'Jack Schwager' 'Technical Analysis (full course, RU)' @('schwager','ta')
Add-O 'Мэрфи - тех анализ.pdf' '01_technical_analysis' 'Murphy John - Tekhnicheskiy analiz' 'John Murphy' 'Technical Analysis of the Financial Markets (RU)' @('murphy','ta')
Add-O 'Технический анализ от А до Я (Акелис).doc' '01_technical_analysis' 'Achelis Steven - Tekhnicheskiy analiz ot A do Ya' 'Steven Achelis' 'Technical Analysis from A to Z (RU)' @('ta')
Add-O 'Энциклопедия технических индикаторов рынка.pdf' '01_technical_analysis' 'Entsiklopediya tehnicheskih indikatorov rynka' '' 'Encyclopedia of Technical Market Indicators (RU)' @('indicators','ta')
Add-O 'самый_сильный_сигнал_в_техническом_анализе_расхождения_и_развороты_трендов.pdf' '01_technical_analysis' 'Samyy silnyy signal - rashozhdeniya i razvoroty' '' 'Strongest Signal: Divergences and Reversals (RU)' @('divergence','ta')
Add-O 'R.Bensignor_(sost).Novoe_myishlenie_v_tehnicheskom_analize.pdf' '01_technical_analysis' 'Bensignor R - Novoe myshlenie v tehanalize' 'Rick Bensignor' 'New Thinking in Technical Analysis (RU)' @('ta')
Add-O 'Мартин Принг О ценовых моделях.pdf' '01_technical_analysis' 'Pring Martin - O tsenovyh modelyah' 'Martin Pring' 'On Price Patterns (RU)' @('patterns','ta')
Add-O 'Метод графического анализа Крестики-нолики.pdf' '01_technical_analysis' 'Metod krestiki-noliki' '' 'Point and Figure Charting (RU)' @('pnf','ta')
Add-O 'Модель, цена и время. Применение теории Ганна (Хьержик Джеймс).pdf' '01_technical_analysis' 'Hyerczyk James - Model tsena i vremya (Gann)' 'James Hyerczyk' 'Pattern, Price & Time / Gann (RU)' @('gann','ta')
Add-O 'Моментум, направленность и расхождение.pdf' '01_technical_analysis' 'Momentum napravlennost i rashozhdenie' '' 'Momentum, Direction and Divergence (RU)' @('momentum','ta')
Add-O 'В.Борискин.Гармонический волновой анализ финансовых рынков.pdf' '01_technical_analysis' 'Boriskin V - Garmonicheskiy volnovoy analiz' 'V. Boriskin' 'Harmonic Wave Analysis (RU)' @('harmonic','ta')
Add-O '_Алмазов А.А., Фрактальная теория.pdf' '01_technical_analysis' 'Almazov A.A. - Fraktalnaya teoriya' 'A.A. Almazov' 'Fractal Theory (RU)' @('fractals','ta')
Add-O 'Эдгар Петерс, Фрактальный анализ финансовых рынков.djvu' '01_technical_analysis' 'Peters Edgar - Fraktalnyy analiz finansovyh rynkov' 'Edgar Peters' 'Fractal Market Analysis (RU)' @('fractals','ta')
Add-O 'James Dalton-Markets in Profile.pdf' '01_technical_analysis' 'Dalton James - Markets in Profile' 'James Dalton' 'Markets in Profile' @('market-profile','ta')
Add-O 'ДжеймсДалтон-Разум над рынками-футпринт.pdf' '01_technical_analysis' 'Dalton James - Razum nad rynkami footprint' 'James Dalton' 'Mind Over Markets / Footprint (RU)' @('market-profile','footprint','ta')
Add-O 'dinapoli.pdf' '01_technical_analysis' 'DiNapoli Joe - Torgovye urovni' 'Joe DiNapoli' 'DiNapoli Levels (RU)' @('dinapoli','ta')
Add-O 'ИНДИКАТОР ИШИМОКУ 1.doc' '01_technical_analysis' 'Indikator Ishimoku 1' '' 'Ichimoku Indicator (notes)' @('ichimoku','ta')
Add-O 'Сафин В.И. - Кому светят японские свечи[q] (2004)(ru).djvu' '01_technical_analysis' 'Safin V.I. - Komu svetyat yaponskie svechi' 'V.I. Safin' 'Who Do Japanese Candles Shine For (RU)' @('candles','safin','ta')
Add-O 'Билл Вильямс Новые измерения.pdf' '01_technical_analysis' 'Williams Bill - Novye izmereniya' 'Bill Williams' 'New Trading Dimensions (RU)' @('williams','ta')
Add-O 'элиот.pdf' '01_technical_analysis' 'Elliott - Materialy' '' 'Elliott materials (unidentified)' @('elliott','ta','needs-review') 'Short/unclear file — review content'
Add-O 'Элиот. Интервал торговли золотом.pdf' '01_technical_analysis' 'Elliott - Interval torgovli zolotom' '' 'Elliott: Gold Trading Interval (RU)' @('elliott','gold','ta')
Add-O 'К.Царихин.Фундаментальный анализ.pdf.pdf' '06_investing_fundamental' 'Tsarikhin K - Fundamentalnyy analiz' 'K. Tsarikhin' 'Fundamental Analysis (RU)' @('fundamental') 'Renamed from double .pdf.pdf'

# --- TRADING SYSTEMS / PRACTICE ---
Add-O 'Alexandr_Kurguzkin_Treyding-struktura_igry.pdf' '02_trading_systems_practice' 'Kurguzkin A - Treyding struktura igry' 'Alexander Kurguzkin' 'Trading: Game Structure (RU)' @('kurguzkin','systems')
Add-O 'Kurguzkin-Labyrinth.pdf' '02_trading_systems_practice' 'Kurguzkin A - Labyrinth' 'Alexander Kurguzkin' 'Labyrinth (RU)' @('kurguzkin','systems')
Add-O 'V.Safin_Vnutridnevnaja_torgovaja_sistema_5_ballov_za_uspeh.pdf' '02_trading_systems_practice' 'Safin V.I. - Vnutridnevnaya TS 5 ballov' 'V.I. Safin' 'Intraday System: 5 Points for Success (RU)' @('safin','intraday')
Add-O '_Сафин В.И., Торговая система трейдера. Фактор успеха.pdf' '02_trading_systems_practice' 'Safin V.I. - Torgovaya sistema treydera Faktor uspeha' 'V.I. Safin' 'Trader Trading System: Success Factor (RU)' @('safin','systems')
Add-O 'Сафин В.И. - Как увидеть деньги на экране монитора (2004)(ru).djvu' '02_trading_systems_practice' 'Safin V.I. - Kak uvidet dengi na ekrane monitora' 'V.I. Safin' 'How to See Money on the Monitor (RU)' @('safin')
Add-O 'А.Герчик, С.Быченок. Курс активного трейдера.pdf' '02_trading_systems_practice' 'Gerchik A Bychenok S - Kurs aktivnogo treydera' 'A. Gerchik, S. Bychenok' 'Active Trader Course (RU)' @('gerchik')
Add-O 'Solabuto_Treyding._Torgovyie_sistemyi_i_metodyi.pdf' '02_trading_systems_practice' 'Solabuto - Treyding torgovye sistemy i metody' 'Solabuto' 'Trading Systems and Methods (RU)' @('systems')
Add-O 'С.Беляев._Торговая_система_Расчет_следующей_свечи.PDF' '02_trading_systems_practice' 'Belyaev S - TS Raschet sleduyushchey svechi' 'S. Belyaev' 'Trading System: Next Candle Calculation (RU)' @('systems','candles')
Add-O 'Энциклопедия-торговых-стратегий.pdf' '02_trading_systems_practice' 'Entsiklopediya torgovyh strategiy' '' 'Encyclopedia of Trading Strategies (RU)' @('strategies')
Add-O 'Механические торговые системы. Психология трейдинга и технический анализ.pdf' '02_trading_systems_practice' 'Mehanicheskie torgovye sistemy' '' 'Mechanical Trading Systems (RU)' @('systems','psychology')
Add-O 'Механизмы трейдинга.pdf' '02_trading_systems_practice' 'Mehanizmy treydinga' '' 'Trading Mechanisms (RU)' @('systems')
Add-O 'Chebotarev_Yu_Torgovye_roboty_na_rossijskom_fondovom_rynke.pdf' '02_trading_systems_practice' 'Chebotarev Yu - Torgovye roboty na RF rynke' 'Yu. Chebotarev' 'Trading Robots on Russian Equity Market (RU)' @('algo','robots')
Add-O 'Robert_Pardo_Razrabotka_Razrabotka_testirovan.pdf' '02_trading_systems_practice' 'Pardo Robert - Razrabotka i testirovanie TS' 'Robert Pardo' 'Design, Testing, and Optimization of Trading Systems (RU)' @('systems','backtest')
Add-O 'L.Borselino.Zadachnik-po-deytreydingu.pdf' '02_trading_systems_practice' 'Borsellino L - Zadachnik po daytreydingu' 'Lewis Borsellino' 'Day Trading Workbook (RU)' @('daytrading')
Add-O 'К.Фаррел.Дейтрейд онлайн.doc' '02_trading_systems_practice' 'Farrell K - Daytrade online' 'K. Farrell' 'Day Trade Online (RU)' @('daytrading')
Add-O 'Price Action Intraday Trading Strategy for Crude Oil_ NO loss Day Trading - with price action (volume Book 1).pdf' '02_trading_systems_practice' 'Price Action Intraday Crude Oil Book 1' '' 'Price Action Intraday Crude Oil (Book 1)' @('price-action','intraday','oil')
Add-O 'Dnevnik hedjera.pdf' '02_trading_systems_practice' 'Dnevnik hedzhera' '' 'Hedger Diary (RU)' @('diary','hedging')
Add-O 'trading_web.pdf' '02_trading_systems_practice' 'Trading Web' '' 'Trading Web (materials)' @('needs-review')
Add-O 'lektsia-1-lektsia-2-lektsia-3-lektsia-4-lektsia-5-lektsia-6-merged.pdf' '02_trading_systems_practice' 'Lektsii 1-6 merged' '' 'Lectures 1–6 (merged)' @('course','lectures')
Add-O 'Школа успешного трейдера - 1 курс.pdf' '02_trading_systems_practice' 'Shkola uspeshnogo treydera - 1 kurs' '' 'Successful Trader School — Course 1' @('course')
Add-O 'Школа успешного трейдера - 2 курс.pdf' '02_trading_systems_practice' 'Shkola uspeshnogo treydera - 2 kurs' '' 'Successful Trader School — Course 2' @('course')
Add-O 'Школа успешного трейдера - 3 курс.pdf' '02_trading_systems_practice' 'Shkola uspeshnogo treydera - 3 kurs' '' 'Successful Trader School — Course 3' @('course')
Add-O 'Stanbadjer-Cfmou4itel tradera.pdf' '02_trading_systems_practice' 'Stanbridge - Samouchitel treydera' 'Stanbridge' 'Trader Self-Study Guide (RU)' @('course') 'Filename OCR-fixed'
Add-O 'Кетти-Лин Секреты проп трейдинга.pdf' '02_trading_systems_practice' 'Lien Kathy - Sekrety prop treydinga' 'Kathy Lien' 'Prop Trading Secrets (RU)' @('prop','forex')
Add-O 'Lin_Ketti_Treidery-millionery.fb2' '02_trading_systems_practice' 'Lien Kathy - Treydry millionery' 'Kathy Lien' 'Millionaire Traders (RU)' @('prop')
Add-O 'enayman_malaya_encyiklopyedyiya_tryeydyera.pdf' '02_trading_systems_practice' 'Nayman Erik - Malaya entsiklopediya treydera' 'Erik Nayman' 'Small Trader Encyclopedia (RU)' @('nayman')
Add-O 'nayman_master_traiding.pdf' '02_trading_systems_practice' 'Nayman Erik - Master trading' 'Erik Nayman' 'Master Trading (RU)' @('nayman')
Add-O 'Эрик Найман, Трейдер-Инвестор.pdf' '02_trading_systems_practice' 'Nayman Erik - Treydr-Investor' 'Erik Nayman' 'Trader-Investor (RU)' @('nayman')
Add-O 'erik_naiman_kak_pokupat_deshevo_prodavat_dorogo.fb2' '02_trading_systems_practice' 'Nayman Erik - Kak pokupat deshevo prodavat dorogo' 'Erik Nayman' 'Buy Cheap Sell Expensive (RU)' @('nayman')
Add-O 'Элдер А. - Основы биржевой торговли(ru).pdf' '02_trading_systems_practice' 'Elder Alexander - Osnovy birzhevoy torgovli' 'Alexander Elder' 'Trading for a Living basics (RU)' @('elder')
Add-O 'Александр Элдер. Трейдинг. Первые шаги.pdf' '02_trading_systems_practice' 'Elder Alexander - Treyding Pervye shagi' 'Alexander Elder' 'Trading: First Steps (RU)' @('elder')
Add-O 'Тарп - Трейдинг ваш путь.djvu' '02_trading_systems_practice' 'Tharp Van - Treyding vash put' 'Van Tharp' 'Trade Your Way to Financial Freedom (RU)' @('tharp')
Add-O 'Ван К. Тарп, Супертрейдер.djvu' '02_trading_systems_practice' 'Tharp Van - Supertreyder' 'Van Tharp' 'Super Trader (RU)' @('tharp')
Add-O 'Ван Тарп и Брайан Джун.Внутридневный трейдинг.Секреты масте.djvu' '02_trading_systems_practice' 'Tharp Van June B - Vnutridnevnyy treyding' 'Van Tharp, Brian June' 'Intraday Trading Secrets (RU)' @('tharp','intraday')
Add-O 'Майкл Ковел - Биржевая торговля по трендам.pdf' '02_trading_systems_practice' 'Covel Michael - Birzhevaya torgovlya po trendam' 'Michael Covel' 'Trend Following (RU)' @('trend-following')
Add-O 'Майкл Ковел, Черепахи-трейдеры.djvu' '02_trading_systems_practice' 'Covel Michael - Cherepahi-treydry' 'Michael Covel' 'The Complete TurtleTrader (RU)' @('turtles','trend-following')
Add-O 'путь_черепах_из_дилетантов_в_легендарные_трейдеры.pdf' '02_trading_systems_practice' 'Put cherepah - iz diletantov v legendarnye treydry' 'Curtis Faith?' 'Way of the Turtle (RU)' @('turtles')
Add-O 'Куртис Фейс, Трейдинг, основанный на интуиции.doc' '02_trading_systems_practice' 'Faith Curtis - Treyding osnovannyy na intuitsii' 'Curtis Faith' 'Trading from Your Gut (RU)' @('turtles')
Add-O '50_shades_of_Forex_RU.pdf' '02_trading_systems_practice' '50 Shades of Forex RU' '' '50 Shades of Forex (RU)' @('forex')
Add-O 'Ahundov_F._Vsya_Pravda_O_Forex_Razob.a6.pdf' '02_trading_systems_practice' 'Ahundov F - Vsya pravda o Forex' 'F. Ahundov' 'The Whole Truth About Forex (RU)' @('forex')
Add-O 'Азбука валютного дилинга.doc' '02_trading_systems_practice' 'Azbuka valyutnogo dilinga' '' 'FX Dealing ABC (RU)' @('forex')
Add-O 'sekrety_torgovli_aktsiyami_on-line.pdf' '02_trading_systems_practice' 'Sekrety torgovli aktsiyami online' '' 'Online Stock Trading Secrets (RU)' @('stocks')
Add-O 'birzhevye_sekrety_Rashke_Konnors.pdf' '02_trading_systems_practice' 'Raschke Connors - Birzhevye sekrety' 'Linda Raschke, Laurence Connors' 'Street Smarts (RU)' @('raschke','systems')
Add-O 'lebo.pdf' '02_trading_systems_practice' 'Lebo Charles - Day trading' 'Charles Le Beau?' 'Lebo materials' @('daytrading','needs-review')
Add-O 'М.Фридфертиг,Д.Уэст.Электронная внутридневная торговля ценными бумагами.djvu' '02_trading_systems_practice' 'Friedfertig West - Elektronnaya vnutridnevnaya torgovlya' 'M. Friedfertig, D. West' 'Electronic Day Trading (RU)' @('intraday')
Add-O 'Р.Джонс.Биржевая игра.doc' '02_trading_systems_practice' 'Jones R - Birzhevaya igra' 'R. Jones' 'The Trading Game (RU)' @('practice')
Add-O 'Гэри Смит. Как я играю и выигрываю на бирже.djvu' '02_trading_systems_practice' 'Smith Gary - Kak ya igrayu i vyigryvayu na birzhe' 'Gary Smith' 'How I Trade and Invest (RU)' @('practice')
Add-O 'Формула Ливермора.pdf' '02_trading_systems_practice' 'Formula Livermora' 'Jesse Livermore (about)' 'Livermore Formula (RU)' @('livermore')
Add-O 'Высокочастотная революция.pdf' '02_trading_systems_practice' 'Vysokochastotnaya revolyutsiya' '' 'HFT Revolution (RU)' @('hft')
Add-O 'ОНил. Как делать деньги на фондовом рынке.djvu' '02_trading_systems_practice' 'ONeil William - Kak delat dengi na fondovom rynke' 'William O''Neil' 'How to Make Money in Stocks (RU)' @('oneil','stocks')
Add-O 'Дебора Вейр, Тайминг финансовых рынков.djvu' '02_trading_systems_practice' 'Weir Deborah - Tayming finansovyh rynkov' 'Deborah Weir' 'Timing the Markets (RU)' @('timing')
Add-O 'С.Булашев - Статистика для трейдеров.pdf' '02_trading_systems_practice' 'Bulashev S - Statistika dlya treyderov' 'S. Bulashev' 'Statistics for Traders (RU)' @('stats')
Add-O 'Д.Фергюсон.Метод Мартингейла.doc' '02_trading_systems_practice' 'Ferguson D - Metod Martingeyla' 'D. Ferguson' 'Martingale Method (RU)' @('martingale','caution') 'Martingale — high-risk concept'
Add-O 'Momentum Investing (Вольф Кен).doc' '02_trading_systems_practice' 'Wolff Ken - Momentum Investing' 'Ken Wolff' 'Momentum Investing (RU)' @('momentum')
Add-O 'Визуальный инвестор. Как определять тренды.djvu' '02_trading_systems_practice' 'Vizualnyy investor - Kak opredelyat trendy' 'John Murphy?' 'The Visual Investor (RU)' @('trends','ta')

# --- WIZARDS / BIOS ---
Add-O 'Биржевые маги. Швагер .pdf' '03_market_wizards_bios' 'Schwager Jack - Birzhevye magi' 'Jack Schwager' 'Market Wizards (RU)' @('schwager','wizards')
Add-O 'Д.Швагер. Маги фондового рынка.djvu' '03_market_wizards_bios' 'Schwager Jack - Magi fondovogo rynka' 'Jack Schwager' 'Stock Market Wizards (RU)' @('schwager','wizards')
Add-O 'Швагер - Новые маги рынка.pdf' '03_market_wizards_bios' 'Schwager Jack - Novye magi rynka' 'Jack Schwager' 'The New Market Wizards (RU)' @('schwager','wizards')
Add-O 'Vospominania_Birzhevogo_Spekulyanta.pdf' '03_market_wizards_bios' 'Lefevre Edwin - Vospominaniya birzhevogo spekulyanta' 'Edwin Lefèvre' 'Reminiscences of a Stock Operator (RU)' @('livermore','classic')
Add-O 'Zhizn_i_Smert_velichayshego_spekulyanta.pdf' '03_market_wizards_bios' 'Zhizn i smert velichayshego spekulyanta' '' 'Life and Death of the Greatest Speculator (RU)' @('livermore','bio')
Add-O 'Аксимы_биржевого_спекулянта_-_М.Гюнтер.pdf' '03_market_wizards_bios' 'Gunther M - Aksromy birzhevogo spekulyanta' 'Max Gunther' 'The Zurich Axioms (RU)' @('axioms')
Add-O 'Виктор Сперандео. Trader Vic II - Принципы профессиональной спекуляции.djvu' '03_market_wizards_bios' 'Sperandeo Victor - Trader Vic II' 'Victor Sperandeo' 'Trader Vic II (RU)' @('sperandeo')
Add-O '+Толли Игра на понижение.djvu' '03_market_wizards_bios' 'Tolly - Igra na ponizhenie' 'Tolly' 'Playing the Short Side (RU)' @('shorting')
Add-O 'Большая игра на понижение. Тайные пружины финансовой катастрофы (Майкл Льюис) 2011.pdf' '03_market_wizards_bios' 'Lewis Michael - Bolshaya igra na ponizhenie' 'Michael Lewis' 'The Big Short (RU)' @('lewis','crisis')
Add-O 'Trei_774_dery_Pushki_i_Dengi_Satyadzhit_Das.pdf' '03_market_wizards_bios' 'Das Satyajit - Traders Guns and Money' 'Satyajit Das' 'Traders, Guns & Money (RU)' @('das','derivatives-narrative')
Add-O 'Исповедь.pdf' '03_market_wizards_bios' 'Ispoved' '' 'Confession (needs content ID)' @('needs-review') 'Large PDF — identify author/title'
Add-O 'К.Брук.Бал хищников.doc' '03_market_wizards_bios' 'Bruck Connie - Bal hishchnikov' 'Connie Bruck' 'The Predators'' Ball (RU)' @('history')
Add-O 'Бегущие по граблям.pdf' '03_market_wizards_bios' 'Begushchie po grablyam' '' 'Running Over Rakes (RU)' @('narrative','needs-review')

# --- PSYCHOLOGY ---
Add-O 'Terri-Bernhem-Podlyie-ryinki-i-mozg-yashhera.pdf' '04_psychology_behavior' 'Burnham Terry - Podlye rynki i mozg yashchera' 'Terry Burnham' 'Mean Markets and Lizard Brains (RU)' @('behavior')
Add-O 'nudge-28-6-17.pdf' '04_psychology_behavior' 'Thaler Sunstein - Nudge' 'Richard Thaler, Cass Sunstein' 'Nudge' @('behavior','nudge')
Add-O 'oxota-na-prostaka-9785001004677.pdf' '04_psychology_behavior' 'Akerlof Shiller - Ohota na prostaka' 'George Akerlof, Robert Shiller' 'Phishing for Phools (RU)' @('behavior')
Add-O 'Дэвид Кохен, Психология фондового рынка - страх, алчность и паника.pdf' '04_psychology_behavior' 'Cohen David - Psihologiya fondovogo rynka' 'David Cohen' 'Fear, Greed and Panic (RU)' @('psychology')
Add-O 'Все продается.doc' '04_psychology_behavior' 'Vse prodaetsya' '' 'Everything Is For Sale (RU)' @('needs-review')

# --- RISK / MONEY ---
Add-O 'Кеннет Л. Грант, Управление рисками в трейдинге.pdf' '05_risk_money_management' 'Grant Kenneth - Upravlenie riskami v treydinge' 'Kenneth Grant' 'Trading Risk (RU)' @('risk')
Add-O 'М.Чекулаев.Риск менеджмент.Управление финансовыми рисками н.djvu' '05_risk_money_management' 'Chekulaev M - Risk menedzhment' 'M. Chekulaev' 'Risk Management (RU)' @('risk')
Add-O 'М.Чекулаев.Торговля волатильностью.doc' '_review_duplicates' 'Chekulaev M - Torgovlya volatilnostyu' 'M. Chekulaev' 'Trading Volatility (RU)' @('volatility','dup-candidate') 'Pair with …volatilnostyu1.doc'
Add-O 'М.Чекулаев.Торговля волатильностью1.doc' '_review_duplicates' 'Chekulaev M - Torgovlya volatilnostyu (copy1)' 'M. Chekulaev' 'Trading Volatility copy' @('volatility','dup-candidate') '' $true
Add-O 'Р. Винс.Математика управления капиталом.pdf' '05_risk_money_management' 'Vince Ralph - Matematika upravleniya kapitalom' 'Ralph Vince' 'The Mathematics of Money Management (RU)' @('money-management','kelly')
Add-O 'P.Bernstayn.Protiv-bogov.pdf' '05_risk_money_management' 'Bernstein Peter - Protiv bogov' 'Peter Bernstein' 'Against the Gods (RU)' @('risk-history')
Add-O 'Нассим_Николас_Талеб_Одураченные случайностью (1).pdf' '05_risk_money_management' 'Taleb Nassim - Odurachennye sluchaynostyu' 'Nassim Taleb' 'Fooled by Randomness (RU)' @('taleb','risk')
Add-O 'Как предсказывать крахи фин. рынков.djvu' '05_risk_money_management' 'Kak predskazyvat krahi fin rynkov' '' 'How to Predict Financial Crashes (RU)' @('crashes','risk')
Add-O 'Управляя рисками. Клиринг с участием центральных контрагентов на глобальных финансовых рынках.pdf' '05_risk_money_management' 'Upravlyaya riskami - Kliring i CCP' '' 'Managing Risk: CCP Clearing (RU)' @('clearing','risk')
Add-O 'Бернстайн Уильям. Разумное распределение активов. Как построить портфель с максимальной доходностью и минимальным риском.pdf' '05_risk_money_management' 'Bernstein William - Razumnoe raspredelenie aktivov' 'William Bernstein' 'The Intelligent Asset Allocator (RU)' @('asset-allocation')
Add-O 'Всё о распределении активов1.pdf' '05_risk_money_management' 'Vse o raspredelenii aktivov' '' 'All About Asset Allocation (RU)' @('asset-allocation')

# --- INVESTING / FUNDAMENTAL ---
Add-O 'Bendzhamin_Grekhem_-_Analiz_tsennykh_bumag.djvu' '06_investing_fundamental' 'Graham Benjamin - Analiz tsennyh bumag' 'Benjamin Graham' 'Security Analysis (RU)' @('graham','value')
Add-O 'Ф.Фишер.Обыкновенные акции и необыкновенные доходы.djvu' '06_investing_fundamental' 'Fisher Philip - Obyknovennye aktsii i neobyknovennye dohodi' 'Philip Fisher' 'Common Stocks and Uncommon Profits (RU)' @('fisher','growth')
Add-O 'Фундаментальный анализ.pdf' '06_investing_fundamental' 'Fundamentalnyy analiz (sbornik)' '' 'Fundamental Analysis (large volume)' @('fundamental') '54MB — likely multi-part/scan'
Add-O 'Джон Богл-Инвесторы против спекулянтоврынком.PDF' '06_investing_fundamental' 'Bogle John - Investory protiv spekulyantov' 'John Bogle' 'The Clash of the Cultures (RU)' @('bogle','index')
Add-O 'Питер Красс, Книга инвестиционной мудрости.pdf' '06_investing_fundamental' 'Krass Peter - Kniga investitsionnoy mudrosti' 'Peter Krass' 'The Book of Investing Wisdom (RU)' @('anthology')
Add-O 'Р.Ямароне.Ключевые экономические индикаторы.Руководство трейдера.djvu' '06_investing_fundamental' 'Yamarone R - Klyuchevye ekonomicheskie indikatory' 'R. Yamarone' 'The Trader''s Guide to Key Economic Indicators (RU)' @('macro','indicators')
Add-O 'Рынок ценных бумаг и производных финансовых инструментов.pdf' '06_investing_fundamental' 'Rynok tsennyh bumag i PFI' '' 'Securities and Derivatives Market (RU)' @('markets','textbook')
Add-O 'Американский фондовый рынок без воды.pdf' '06_investing_fundamental' 'Amerikanskiy fondovyy rynok bez vody' '' 'US Stock Market Without the Fluff (RU)' @('us-markets')
Add-O 'Hayek-Money.pdf' '06_investing_fundamental' 'Hayek F - Money' 'F.A. Hayek' 'Hayek on Money' @('hayek','macro')
Add-O 'Вера Смит. Происхождение центральных банков.doc' '06_investing_fundamental' 'Smith Vera - Proishozhdenie tsentralnyh bankov' 'Vera Smith' 'The Rationale of Central Banking (RU)' @('central-banking')
Add-O 'Джеймс Уэзеролл-Физика фондового рынка.pdf' '06_investing_fundamental' 'Weatherall James - Fizika fondovogo rynka' 'James Weatherall' 'The Physics of Wall Street (RU)' @('quant-history')
Add-O 'Skott_Patterson_Kvanty.docx' '06_investing_fundamental' 'Patterson Scott - Kvanty' 'Scott Patterson' 'The Quants (RU)' @('quant','narrative')
Add-O 'I_botaniki_delayut_biznes_-_Maxim_Kotin.pdf' '10_misc' 'Kotin Maxim - I botaniki delayut biznes' 'Maxim Kotin' 'Geeks Do Business Too (RU)' @('business','startup')

# --- CRYPTO ---
Add-O 'Книга  - Mastering Bitcoin.pdf' '07_crypto_defi' 'Antonopoulos Andreas - Mastering Bitcoin' 'Andreas Antonopoulos' 'Mastering Bitcoin' @('bitcoin','core')
Add-O 'Глава 1 Введение в криптографию и криптовалюты.pdf' '_review_duplicates' 'Mastering Bitcoin - Glava 1' 'Andreas Antonopoulos' 'Mastering Bitcoin Ch.1 (split)' @('bitcoin','dup-of-full-book') '' $true
Add-O 'Глава 2 Как биткоин достигает децентрализации.pdf' '_review_duplicates' 'Mastering Bitcoin - Glava 2' 'Andreas Antonopoulos' 'Mastering Bitcoin Ch.2 (split)' @('bitcoin','dup-of-full-book') '' $true
Add-O 'Глава 3 Механика Биткоина.pdf' '_review_duplicates' 'Mastering Bitcoin - Glava 3' 'Andreas Antonopoulos' 'Mastering Bitcoin Ch.3 (split)' @('bitcoin','dup-of-full-book') '' $true
Add-O 'Глава 4 Как хранить и использовать биткоины.pdf' '_review_duplicates' 'Mastering Bitcoin - Glava 4' 'Andreas Antonopoulos' 'Mastering Bitcoin Ch.4 (split)' @('bitcoin','dup-of-full-book') '' $true
Add-O 'Глава 5 Майнинг биткоинов.pdf' '_review_duplicates' 'Mastering Bitcoin - Glava 5' 'Andreas Antonopoulos' 'Mastering Bitcoin Ch.5 (split)' @('bitcoin','dup-of-full-book') '' $true
Add-O 'Глава 7 Сообщество, политика и регулирование.pdf' '_review_duplicates' 'Mastering Bitcoin - Glava 7' 'Andreas Antonopoulos' 'Mastering Bitcoin Ch.7 (split)' @('bitcoin','dup-of-full-book') 'Missing chapter 6 in set' $true
Add-O 'How_to_DeFi_Russian.pdf' '07_crypto_defi' 'How to DeFi (Russian)' '' 'How to DeFi (RU)' @('defi')
Add-O 'Цифровое Золото.pdf' '07_crypto_defi' 'Popper Nathaniel - Tsifrovoe Zoloto' 'Nathaniel Popper' 'Digital Gold (RU)' @('bitcoin','history')
Add-O 'adam-tepper-bitkoi-774-n-dengi-dlya-v.pdf' '07_crypto_defi' 'Tepper Adam - Bitcoin i dengi' 'Adam Tepper' 'Bitcoin and Money (RU)' @('bitcoin')
Add-O 'Владимир Попов - ICO сущность, проблемы, закон.pdf' '07_crypto_defi' 'Popov Vladimir - ICO sushchnost problemy zakon' 'Vladimir Popov' 'ICO: Essence, Problems, Law (RU)' @('ico')

# --- DERIVATIVES ---
Add-O 'А.Буренин.Фьючерсные, форвардные и опционные рынки.pdf' '08_derivatives_options' 'Burenin A - Fyuchersnye forvardnye i optsionnye rynki' 'A. Burenin' 'Futures, Forwards and Options Markets (RU)' @('derivatives')
Add-O 'А.Фельдман.Производные финансовые и товарные инструменты.doc' '08_derivatives_options' 'Feldman A - Proizvodnye finansovye i tovarnye instrumenty' 'A. Feldman' 'Derivatives: Financial and Commodity (RU)' @('derivatives')
Add-O 'А.Шведов.Процентные финансовые инструменты-оценка и хеджирование.djvu' '08_derivatives_options' 'Shvedov A - Protsentnye instrumenty otsenka i hedzhirovanie' 'A. Shvedov' 'Interest Rate Instruments: Pricing & Hedging (RU)' @('rates','hedging')
Add-O 'K_Konnolli_Pokupka_i_prodazha_volatilnosti.pdf' '08_derivatives_options' 'Connolly K - Pokupka i prodazha volatilnosti' 'Kevin Connolly' 'Buying and Selling Volatility (RU)' @('volatility','options')

# --- PROGRAMMING / QUANT ---
Add-O 'Библия C# 4е изд. Михаил Фленов 2019 (1).pdf' '09_programming_quant' 'Flenov Mikhail - Bibliya C Sharp 4e izd 2019' 'Mikhail Flenov' 'C# Bible 4th ed. 2019 (RU)' @('csharp')
Add-O 'Фленов Михаил. Библия C#. 2016.pdf' '_review_duplicates' 'Flenov Mikhail - Bibliya C Sharp 2016' 'Mikhail Flenov' 'C# Bible 2016 (RU)' @('csharp','older-edition') '' $true
Add-O 'c_sharp2.pdf' '_review_duplicates' 'C Sharp materials 2' '' 'C# materials (unidentified edition)' @('csharp','needs-review') '' $true
Add-O 'Программирование_на_Rust.pdf' '09_programming_quant' 'Programmirovanie na Rust' '' 'Programming in Rust (RU)' @('rust')
Add-O 'Альткофф_Кори_Computer_Science_для_программиста_самоучки.pdf' '09_programming_quant' 'Althoff Cory - Computer Science dlya programmista samouchki' 'Cory Althoff' 'Self-Taught Computer Scientist (RU)' @('cs')
Add-O 'Мэтт Вайсфельд - Объектно-ориентированный подход.pdf' '09_programming_quant' 'Weisfeld Matt - Obektno-orientirovannyy podhod' 'Matt Weisfeld' 'The Object-Oriented Thought Process (RU)' @('oop')
Add-O 'Машинное_обучение__а.pdf' '09_programming_quant' 'Mashinnoe obuchenie' '' 'Machine Learning (RU, partial name)' @('ml','needs-review')

# --- MISC ---
Add-O 'Поппер Карл Логика научного исследования (2004).fb2' '10_misc' 'Popper Karl - Logika nauchnogo issledovaniya' 'Karl Popper' 'The Logic of Scientific Discovery (RU)' @('philosophy','science')
Add-O 'skolzyashiy_po_lezviyu_fondovogo_rinka.doc' '10_misc' 'Skolzyashchiy po lezviyu fondovogo rynka' '' 'Sliding on the Edge of the Stock Market (RU)' @('narrative','needs-review')

# Fallback rules when not in overrides
function Resolve-Category([string]$name) {
  $n = $name.ToLowerInvariant()
  if ($n -match '\.(zip|rar)$') { return '_archives' }
  if ($n -match 'bitcoin|биткоин|defi|крипто|ico|цифров') { return '07_crypto_defi' }
  if ($n -match 'c#|фленов|rust|computer.?science|машинн|программ|ооп|объектно') { return '09_programming_quant' }
  if ($n -match 'риск|volatil|волатил|хедж|маржин|капитал|против.?бог|талеб|распределен') { return '05_risk_money_management' }
  if ($n -match 'психолог|nudge|поведен|ящер|страх|алчност') { return '04_psychology_behavior' }
  if ($n -match 'опцион|фьючерс|форвард|производн|volatil') { return '08_derivatives_options' }
  if ($n -match 'грехем|graham|богл|фундамент|инвест|hayek|ценн.?бумаг|квинт') { return '06_investing_fundamental' }
  if ($n -match 'маги|schwager|швагер|лефевр|спекулянт|livermore|lewis') { return '03_market_wizards_bios' }
  if ($n -match 'свеч|murphy|мэрфи|elliot|эллиот|fibonacc|wyckoff|вайкофф|bollinger|боллинд|индикатор|tehanaliz|техническ|фрактал|gann|ганн|profile|футпринт|ishimoku|дим.?напол|dinapoli') { return '01_technical_analysis' }
  if ($n -match 'трейд|trad|forex|форекс|сафин|герчик|найман|elder|элдер|тарп|tharp|robot|систем|day.?trad|дейтр|проп|школа') { return '02_trading_systems_practice' }
  return '10_misc'
}

# --- Process ---
$files = Get-ChildItem -LiteralPath $Root -File -Force | Where-Object {
  $_.Name -notin @('_organize.ps1', '_audit_snapshot.json') -and
  $_.Extension -notin @('.ps1') -and
  $_.Name -notmatch '^catalog' 
}

$manifest = [System.Collections.Generic.List[object]]::new()
$catalog = [System.Collections.Generic.List[object]]::new()
$id = 0
$errors = [System.Collections.Generic.List[string]]::new()

foreach ($file in ($files | Sort-Object Name)) {
  $id++
  $origName = $file.Name
  $ext = $file.Extension.ToLowerInvariant()
  if ($ext -eq '.pdf') { } # normalize later for .PDF
  $extNorm = $ext
  if ($extNorm -eq '.pdf') { $extNorm = '.pdf' }

  $meta = $null
  if ($Overrides.ContainsKey($origName)) { $meta = $Overrides[$origName] }

  $cat = if ($meta) { $meta.Cat } else { Resolve-Category $origName }
  $newBase = if ($meta -and $meta.NewBase) { $meta.NewBase } else { Clean-BaseName $origName }
  $author = if ($meta) { $meta.Author } else { '' }
  $title = if ($meta) { $meta.Title } else { $newBase }
  $tags = if ($meta) { $meta.Tags } else { @() }
  $notes = if ($meta) { $meta.Notes } else { '' }
  $dup = if ($meta) { [bool]$meta.Dup } else { $false }

  # Force extension lowercase
  $destName = Get-SafeFileName $newBase $extNorm
  $destDir = Join-Path $Root $cat
  $destPath = Join-Path $destDir $destName

  # Collision handling
  $n = 2
  while (Test-Path -LiteralPath $destPath) {
    $destName = Get-SafeFileName "$newBase ($n)" $extNorm
    $destPath = Join-Path $destDir $destName
    $n++
  }

  $relOld = $origName
  $relNew = Join-Path $cat $destName

  try {
    Move-Item -LiteralPath $file.FullName -Destination $destPath
    $status = 'moved'
  } catch {
    $status = 'error'
    $errors.Add("$origName :: $($_.Exception.Message)")
  }

  $entry = [ordered]@{
    id           = ('B{0:D3}' -f $id)
    status       = $status
    category     = $cat
    author       = $author
    title        = $title
    tags         = @($tags)
    notes        = $notes
    duplicate_candidate = $dup
    format       = $extNorm.TrimStart('.')
    size_bytes   = $file.Length
    size_mb      = [math]::Round($file.Length / 1MB, 2)
    original_name = $origName
    relative_path = ($relNew -replace '\\','/')
    absolute_path = $destPath
  }
  $catalog.Add([pscustomobject]$entry)
  $relNewSlash = ($relNew -replace '\\','/')
  $manifest.Add([pscustomobject]@{
    id = $entry.id
    from = $relOld
    to = $relNewSlash
    status = $status
  })
}

# --- Write catalogs ---
$catDir = Join-Path $Root 'catalog'
$jsonPath = Join-Path $catDir 'library.json'
$csvPath = Join-Path $catDir 'library.csv'
$manifestPath = Join-Path $catDir "move-manifest-$Stamp.json"
$summaryPath = Join-Path $catDir 'summary.json'

$library = [ordered]@{
  generated_at = (Get-Date).ToString('o')
  root         = $Root
  total_books  = $catalog.Count
  taxonomy     = $Folders | Where-Object { $_ -ne 'catalog' }
  items        = @($catalog)
  errors       = @($errors)
}

$library | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

$catalog | Select-Object id, category, author, title,
  @{n='tags';e={ $_.tags -join ';' }},
  notes, duplicate_candidate, format, size_mb, relative_path, original_name |
  Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding UTF8

$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$byCat = $catalog | Group-Object category | ForEach-Object {
  [pscustomobject]@{
    category = $_.Name
    count = $_.Count
    size_mb = [math]::Round(($_.Group | Measure-Object size_bytes -Sum).Sum / 1MB, 2)
  }
} | Sort-Object category

$summary = [ordered]@{
  generated_at = (Get-Date).ToString('o')
  total = $catalog.Count
  errors = $errors.Count
  by_category = @($byCat)
  duplicate_candidates = @($catalog | Where-Object duplicate_candidate | Select-Object id, title, relative_path)
  needs_review = @($catalog | Where-Object { $_.tags -contains 'needs-review' -or $_.notes -match 'needs' } | Select-Object id, title, relative_path, notes)
}
$summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $summaryPath -Encoding UTF8

# Cleanup temp snapshot if present
$snap = Join-Path $Root '_audit_snapshot.json'
if (Test-Path -LiteralPath $snap) { Remove-Item -LiteralPath $snap -Force }

Write-Host "DONE books=$($catalog.Count) errors=$($errors.Count)"
Write-Host "JSON: $jsonPath"
Write-Host "CSV:  $csvPath"
Write-Host "MANIFEST: $manifestPath"
$byCat | Format-Table -AutoSize | Out-String | Write-Host
if ($errors.Count) { Write-Host "ERRORS:"; $errors | ForEach-Object { Write-Host $_ } }
