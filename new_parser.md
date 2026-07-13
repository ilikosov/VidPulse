# K-pop YouTube Fancam Title Parser

## Цель

Разработать детерминированный алгоритм извлечения структурированных данных из названий K-pop видео.

Алгоритм НЕ использует LLM.

Все решения принимаются на основе:

- словарей
- алиасов
- правил
- контекста
- графа сущностей

---

# Вход

Строка:

```text
[입덕직캠] 있지 예지 직캠 4K 'Motto' (ITZY YEJI FanCam) | @MCOUNTDOWN_2026.5.21
```

---

# Выход

```json
{
    "groups": [...],
    "members": [...],
    "songs": [...],
    "shows": [...],
    "events": [...],
    "dates": [...],
    "confidence": 0.99
}
```

или после Resolver

```json
{
    "performances": [
        {
            "group": "...",
            "members": [...],
            "songs": [...]
        }
    ]
}
```

---

# Общая архитектура

```
Raw title

↓

Normalizer

↓

Tokenizer

↓

Entity Extractor

↓

Resolver

↓

Confidence Scorer

↓

Structured Output
```

---

# Stage 1. Normalization

Цель:

Убрать шум, сохранив всю полезную информацию.

---

## Удаляем

Служебные слова

```
직캠
Fancam
FanCam
FaceCam
FocusCam
4K
8K
60FPS
HDR
UHD
FULL
LIVE
Vertical
Horizontal
```

Теги

```
[]
()
{}
<>
```

Лишние символы

```
|
@
#
/
\
_
~
•
```

Множественные пробелы.

---

## Не удаляем

Названия песен.

Например

```
'Motto'
```

становится

```
Motto
```

но слово остается.

---

## Нормализуем

Все варианты кавычек.

```
'
"
“
”
「」
『』
```

↓

удаляются.

---

Все разделители

```
/
|
&
+
,
```

заменяются пробелами.

---

# Stage 2. Date Extraction

Ищем даты до любого другого анализа.

Поддерживаем:

```
240521

20240521

2024.05.21

2024-05-21

2024/05/21

240521_
```

Преобразуем

```
2024-05-21
```

Удаляем из текста.

---

# Stage 3. Tokenization

Разбиваем строку.

Например

```
ITZY YEJI Motto MCOUNTDOWN
```

↓

```
ITZY
YEJI
Motto
MCOUNTDOWN
```

Но многословные алиасы должны сохраняться.

Например

```
LE SSERAFIM

Girls' Generation

Red Velvet

NCT DREAM
```

нельзя разбивать.

Поэтому используется словарь phrase aliases.

---

# Stage 4. Entity Extraction

На этом этапе ничего не связывается.

Мы только ищем известные сущности.

Получаем список кандидатов.

---

## Group Extractor

Использует

```
group_aliases
```

Например

```
ITZY

있지
```

↓

```
group_id=14
```

---

## Member Extractor

Использует

```
member_aliases
```

Например

```
예지

YEJI

황예지
```

↓

```
member_id=54
```

---

## Song Extractor

Использует

```
song_aliases
```

Например

```
Motto

모토
```

↓

```
song_id=121
```

---

## Show Extractor

```
Inkigayo

Music Bank

Music Core

MCOUNTDOWN

Show Champion
```

---

## Event Extractor

```
KCON

MAMA

AAA

Golden Disc

SBS Gayo

Dream Concert
```

---

После этого этапа результат выглядит так.

```json
{
    "groups":[...],
    "members":[...],
    "songs":[...],
    "shows":[...],
    "events":[...]
}
```

Никаких связей еще нет.

---

# Stage 5. Candidate Deduplication

Многие сущности встречаются дважды.

Например

```
있지

ITZY
```

Обе указывают

```
group_id=14
```

Оставляем одну сущность.

Но сохраняем источники.

```json
{
    "group":"ITZY",
    "sources":[
        "있지",
        "ITZY"
    ]
}
```

Это повышает confidence.

---

# Stage 6. Resolver

Самый важный этап.

Он строит связи.

---

## Правило 1

Каждый Member знает свою группу.

```
YEJI

↓

ITZY
```

Если группа отсутствует

она автоматически добавляется.

---

## Правило 2

Каждая Song знает группу.

```
Motto

↓

ITZY
```

---

## Правило 3

Если известна группа

поиск участников ограничивается только этой группой.

Например

```
ITZY
```

↓

ищем

```
YEJI

YUNA

LIA

RYUJIN

CHAERYEONG
```

---

## Правило 4

Если известна участница

поиск песни ограничивается песнями группы.

```
YEJI

↓

ITZY

↓

только песни ITZY
```

---

## Правило 5

Несколько песен допустимы.

```
Motto

Wannabe

Untouchable
```

↓

```
songs=[
...
]
```

---

## Правило 6

Несколько участников допустимы.

```
YEJI

YUNA
```

↓

```
members=[
...
]
```

---

## Правило 7

Несколько групп допустимы.

Например

```
YEJI

KARINA

Motto

Supernova
```

↓

```
ITZY

aespa
```

---

# Построение графа

После Resolver создается граф.

Например

```
ITZY
    │
    ├──── YEJI
    │
    ├──── YUNA
    │
    ├──── Motto
    │
    └──── Wannabe
```

---

Если две группы

```
ITZY

├── YEJI

└── Motto

aespa

├── KARINA

└── Supernova
```

---

# Stage 7. Performance Builder

Из графа строятся выступления.

Например

```
YEJI

Motto
```

↓

```json
{
    "group":"ITZY",
    "members":[
        "YEJI"
    ],
    "songs":[
        "Motto"
    ]
}
```

---

Другой пример

```
YEJI

YUNA

Motto

Wannabe
```

↓

```json
{
    "group":"ITZY",
    "members":[
        "YEJI",
        "YUNA"
    ],
    "songs":[
        "Motto",
        "Wannabe"
    ]
}
```

---

# Stage 8. Confidence

Каждая найденная сущность имеет score.

Например

```
ITZY
```

найдена по

```
있지

ITZY
```

Score

```
1.0
```

---

YEJI

найдена

```
예지

YEJI
```

↓

```
1.0
```

---

Песня

```
Motto
```

↓

```
0.99
```

---

Итоговый confidence

например

```
0.996
```

---

# Conflict Detection

Если найдено

```
ITZY

KARINA
```

Resolver знает

```
KARINA

↓

aespa
```

Конфликт.

Создается ошибка.

```json
{
    "type":"GROUP_MEMBER_CONFLICT"
}
```

---

Если

```
Motto

↓

ITZY
```

но группа

```
IVE
```

аналогично.

---

# Database Requirements

## Groups

```
id

name

aliases[]
```

---

## Members

```
id

group_id

name

aliases[]
```

---

## Songs

```
id

group_id

title

aliases[]
```

---

## Shows

```
id

aliases[]
```

---

## Events

```
id

aliases[]
```

---

# Основные принципы

1. Никогда не искать песню среди всех песен, если уже известна группа.
2. Никогда не искать участницу среди всех участниц, если уже известна группа.
3. Всегда сначала извлекать сущности, затем строить связи.
4. Разрешать любое количество песен, участников и групп.
5. Каждая сущность должна иметь список алиасов.
6. Каждая найденная сущность должна хранить исходный текст, по которому она была найдена.
7. Все конфликты должны фиксироваться и не скрываться.
8. Все этапы должны быть независимыми, чтобы их можно было тестировать отдельно.
