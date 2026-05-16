# NoSQL Task 1: Spotify Analytics on MongoDB

Цей проєкт реалізує повний пайплайн:
1. Завантаження CSV у `tracks_raw`.
2. Трансформацію у документоорієнтовану схему `tracks`.
3. Запити (Частина 2) і аналітичні агрегації (Частина 3).
4. Оптимізацію запитів через індекси та `explain()` (Частина 4).

## Структура

```
.
├── .env
├── .gitignore
├── requirements.txt
├── scripts/
│   ├── 01_load_data.py
│   └── 02_transform.js
├── queries/
│   ├── part2_queries.js
│   ├── part3_aggregations.js
│   └── part4_indexes.js
└── README.md
```

## 1. Налаштування оточення

1. Створіть віртуальне оточення та активуйте його.
2. Встановіть залежності:

```bash
pip install -r requirements.txt
```

3. Створіть `.env`:

```env
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/
```
4. Покладіть [dataset.csv](https://www.kaggle.com/datasets/maharshipandya/-spotify-tracks-dataset) у корінь проєкту.

5. Важливо для MongoDB команд:
    - `mongosh` не читає файл `.env` автоматично.
    - Тому в командах нижче URI підтягується напряму з `.env` через `grep` + `cut`.

## 2. Порядок запуску

### Крок 1: Завантаження сирих даних

```bash
python scripts/01_load_data.py
```

Очікування:
- `tracks_raw` перестворено (drop + insert).
- Виведено кількість документів та приклад документа.

### Крок 2: Трансформація в `tracks`

```bash
MONGO_URI=$(grep '^MONGO_URI=' .env | cut -d= -f2-) && mongosh "$MONGO_URI" --file scripts/02_transform.js
```

Очікування:
- Створено `tracks` через aggregation + `$out`.
- Є поля `artists` (масив), `audio_features` (вкладений об'єкт), `duration_sec`, `popularity_tier`.

<img src="sceenshots/part_1.png" width="300" style="border: 1px solid grey;">

### Крок 3: Частина 2 - Запити до даних

```bash
MONGO_URI=$(grep '^MONGO_URI=' .env | cut -d= -f2-) && mongosh "$MONGO_URI" --file queries/part2_queries.js
```

Скрипт виконує:
- 2.1 Треки для вечірки

<img src="sceenshots/part_2.1.png" width="300" style="border: 1px solid grey;">

- 2.2 Виконавці, у яких усі треки популярні

<img src="sceenshots/part_2.2.png" width="300" style="border: 1px solid grey;">

- 2.3  Нетипові треки

<img src="sceenshots/part_2.3.png" width="300" style="border: 1px solid grey;">

- 2.4 Треки для фонової роботи

<img src="sceenshots/part_2.4.png" width="300" style="border: 1px solid grey;">


### Крок 4: Частина 3 - Аналітика через Aggregation Pipeline

```bash
MONGO_URI=$(grep '^MONGO_URI=' .env | cut -d= -f2-) && mongosh "$MONGO_URI" --file queries/part3_aggregations.js
```

Скрипт виконує:
- 3.1 Топ-10 артистів (min 5 tracks)

<img src="sceenshots/part_3.1.png" width="300" style="border: 1px solid grey;">

- 3.2 Розподіл треків за настроєм

<img src="sceenshots/part_3.2.png" width="300" style="border: 1px solid grey;">

- 3.3 Найтанцювальніші жанри (min 100 tracks)

<img src="sceenshots/part_3.1.png" width="300" style="border: 1px solid grey;">


### Крок 5: Частина 4 - Індекси та оптимізація

```bash
MONGO_URI=$(grep '^MONGO_URI=' .env | cut -d= -f2-) && mongosh "$MONGO_URI" --file queries/part4_indexes.js
```

Скрипт:
- Порівнює explain до/після індексу для повільного запиту.

<img src="sceenshots/part_4.1.png" width="300" style="border: 1px solid grey;">

- Створює індекс для work-music use case і перевіряє explain.

<img src="sceenshots/part_4.2.png" width="300" style="border: 1px solid grey;">

- Перевіряє covered query сценарій з правильною проєкцією.

<img src="sceenshots/part_4.3.png" width="300" style="border: 1px solid grey;">


## 3. Підсумкова схема `tracks`

Приклад структури документа:

```json
{
  "track_id": "...",
  "track_name": "...",
  "album_name": "...",
  "artists": ["Artist A", "Artist B"],
  "explicit": false,
  "popularity": 68,
  "popularity_tier": "medium",
  "duration_ms": 212345,
  "duration_sec": 212.3,
  "track_genre": "pop",
  "audio_features": {
    "danceability": 0.79,
    "energy": 0.82,
    "loudness": -5.1,
    "speechiness": 0.04,
    "acousticness": 0.12,
    "instrumentalness": 0.0,
    "liveness": 0.11,
    "valence": 0.67,
    "tempo": 121.9,
    "key": 5,
    "mode": 1,
    "time_signature": 4
  }
}
```

## 4. Теоретичні відповіді

### Частина 1

1. Чому аудіо-характеристики винесені в окремий об’єкт `audio_features`, а не зберігаються плоско? Коли таке вкладення вигідне, а коли створює проблеми?
    - Плюси: логічне групування пов'язаних полів, чистіша схема, простіше підтримувати запити типу `audio_features.tempo`.
    - Мінуси: більше вкладеності у деяких проєкціях/індексах, складніше для систем, що очікують плоску таблицю.

2. Чому виконавці зберігаються як масив, а не як рядок? Які запити стають простішими?
    - Дає можливість `$unwind`, `$in`, `$all`, агрегації по артистах.
    - Якщо зберігати рядком, пошук по конкретному артисту стає неточним (substring-помилки) і дорожчим.

3. Що таке $out і чим він відрізняється від $merge? Коли використовувати кожен?
    - `$out` повністю перезаписує цільову колекцію результатом pipeline.
    - `$merge` дозволяє апсерт/оновлення за ключем і гнучку поведінку при match/not-match.
    - У цьому завданні для повної регенерації `tracks` зручно використовувати `$out`.

### Частина 2

1. Для чого використовується інструкція `$unwind`?
    - Розгортає елементи масиву в окремі документи потоку.
    - Дає змогу агрегувати/групувати по елементах масиву (`artists`).

2. Чим `$stdDevPop` відрізняється від `$stdDevSamp`?
    - `$stdDevPop` обчислює стандартне відхилення для всієї генеральної сукупності (ділить на n).
    - `$stdDevSamp` обчислює стандартне відхилення для вибірки (ділить на n-1, поправка Бесселя).

### Частина 3

1. У запиті 1 ми фільтруємо виконавців, у яких менше 5 треків. Як зміниться результат, якщо знизити поріг до 1? А що станеться, якщо вибирати виконавців із більш ніж 50 треками? Поясніть результат.
    - Поріг 1: у топі з'являються артисти з випадково високим середнім на 1-2 треках (шум).
    - Поріг 50: результат стабільніший, але менш різноманітний, зміщується до масових артистів.

2. У запиті 3 ми фільтруємо жанри з менше ніж 100 треками. Чи зміниться результат, якщо знизити поріг до 50? Поясніть результат.
    - Зростає покриття менш популярних жанрів.
    - Але середні значення стають менш стабільними через менший розмір груп.

## 5. Частина 4: explain() до/після

Нижче зафіксовані фактичні значення з запуску `queries/part4_indexes.js`.

### 4.1 Повільний запит

#### До індексу (COLLSCAN)

```json
{
  "winningStages": ["SORT", "COLLSCAN"],
  "totalKeysExamined": 0,
  "totalDocsExamined": 113999,
  "nReturned": 354,
  "executionTimeMillis": 49
}
```

#### Після індексу `idx_genre_dance_popularity` (IXSCAN)

```json
{
  "winningStages": ["FETCH", "SORT", "IXSCAN"],
  "totalKeysExamined": 354,
  "totalDocsExamined": 354,
  "nReturned": 354,
  "executionTimeMillis": 2
}
```

**Пояснення змін:**
- ✅ winningStages змінилися з `COLLSCAN` на `IXSCAN` — тепер використовується індекс
- ✅ totalDocsExamined впали з 113999 → 354 (економія: 113645 документів)
- ✅ executionTimeMillis впали з 49ms → 2ms (прискорення в ~25 разів)
- ✅ totalKeysExamined = nReturned, що означає точне влучання в індекс

### 4.2 Індекс для work-music use case

Індекс: `idx_work_music` на полях:
- `explicit`
- `audio_features.instrumentalness`
- `audio_features.speechiness`

```json
{
  "winningStages": ["FETCH", "IXSCAN"],
  "totalKeysExamined": 16602,
  "totalDocsExamined": 16141,
  "nReturned": 16141,
  "executionTimeMillis": 30
}
```

**Висновок:** наявність `IXSCAN` у winningStages підтверджує, що індекс успішно використовується. Запит отримав доступ до 16602 ключів індексу та повернув 16141 документ.

### 4.3 Covered query

Запит з умови:

```js
db.tracks.find({
  track_genre: "pop",
  popularity: { $gte: 70 }
});
```

#### Варіант 1: Без проєкції (НЕ покривний)

```json
{
  "winningStages": ["FETCH", "IXSCAN"],
  "totalKeysExamined": 317,
  "totalDocsExamined": 317,
  "nReturned": 317,
  "executionTimeMillis": 2
}
```

**Аналіз:** Наявність `FETCH` означає, що MongoDB мусив витягти повні документи з колекції (не покривний запит).

#### Варіант 2: З покривною проєкцією (ПОКРИВНИЙ ✅)

```js
db.tracks.find(
  { track_genre: "pop", popularity: { $gte: 70 } },
  { _id: 0, track_name: 1, popularity: 1, track_genre: 1 }
);
```

```json
{
  "winningStages": ["PROJECTION_COVERED", "IXSCAN"],
  "totalKeysExamined": 317,
  "totalDocsExamined": 0,
  "nReturned": 317,
  "executionTimeMillis": 0
}
```

**Аналіз:** `PROJECTION_COVERED` + `totalDocsExamined = 0` означає, що запит 100% покривний — MongoDB взяв усі потрібні дані прямо з індексу, без звернення до колекції.

**Висновок про covered query:**
Це підтверджує, що covered query досягається лише при одночасному виконанні двох умов:
1. **Індекс містить усі поля запиту**: `idx_genre_popularity_cover(track_genre, popularity, track_name)`
2. **Проєкція містить лише ці поля та виключає `_id`**: `{ _id: 0, track_name: 1, popularity: 1, track_genre: 1 }`

Щоб запит став покривним, потрібні одночасно:
1. Індекс, що містить усі поля фільтрації і проєкції.
2. Явна проєкція лише цих полів і виключення `_id` (або `_id` теж має бути в індексі).

