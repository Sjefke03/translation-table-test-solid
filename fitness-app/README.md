# Lift Log: a Hevy-style tracker for every physical activity

React + TypeScript (Vite). Logs strength training the way Hevy does (sets, previous values, rest timer, warm-up/drop/failure sets, PRs), and uses the same input screen for running, swimming, climbing, racket and team sports, combat, winter sports, yoga and dance. An activity ontology decides what each input screen shows.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # ontology integrity, units, stats, records, reducer
npm run build      # typecheck + production build into dist/
```

Data is stored in the browser's `localStorage`. Settings has JSON export and import.

## The ontology

```
Metric ──┐                 (atoms: weight, reps, time, distance, grade, score …)
         ▼
Tracking profile ──► what repeats (set / interval / round / climb / run / game / session)
         │             core columns · optional columns · per-session fields · completion rule
         ▼
Activity ──► picks one profile and can refine it (default-on columns, extra metrics, own row name)
         │   classified by category · equipment · environment · movement pattern · muscles · MET
         ▼
Stats ──► derived from metrics, not activities (weight+reps → volume, e1RM; distance+time → pace)
```

| Layer | File | Notes |
|---|---|---|
| Units & dimensions | `src/ontology/units.ts` | Values are stored in SI (kg, m, s) and converted only for display, so switching metric/imperial never changes history. |
| Climbing grades | `src/ontology/grades.ts` | Stored as a rank on aligned ladders (V ↔ Font, YDS ↔ French) and shown in the scale you prefer. |
| Metrics | `src/ontology/metrics.ts` | 32 metrics. The kind (quantity / duration / choice / grade) picks the input widget, and the dimension picks the unit. |
| Taxonomy | `src/ontology/taxonomy.ts` | 10 categories, plus environment, equipment, muscles and movement patterns. |
| Profiles | `src/ontology/profiles.ts` | 17 profiles. They generalise Hevy's exercise types to all physical activity. |
| Activities | `src/ontology/activities.ts` | 137 built-in activities. Users can add custom activities by choosing a category and a profile. |
| Integrity | `src/ontology/index.ts` | `validateVocabulary()` and `validateActivities()` check the built-in list in tests and custom activities in the UI. |
| Derived stats & PRs | `src/model/stats.ts` | Each stat declares the metrics it needs. |

Examples of how activities refine a profile: in Tennis the *Match* profile's row is called "Set", and in BJJ the *Timed rounds* profile's row is called "Roll". Pool swimming adds a per-session pool length. Surfing adds an optional "Waves" metric, which then unlocks a Waves stat. On the Treadmill, distance and incline columns are switched on by default.

## Input screen

- Every activity card has the same flow: fill in a row, tick it, the rest timer starts, add the next row.
- Placeholders show the same row from the last time you did this activity, or the row above. Ticking a row fills empty fields from those placeholders. A row that still isn't complete shakes instead of ticking.
- Tap the row number to mark warm-up, drop or failure sets, or to remove the row. Tap *previous* to copy that row.
- Time is entered like a timer keypad: typing 1-3-0 gives 1:30.
- Chips under each card switch optional columns on or off (RPE, heart rate, incline …).
- Finishing drops rows you didn't tick. Workout detail shows stats and 🏆 for new records, and has *Repeat workout*.

## Not yet

Routines and templates, charts, a body-measurement log, supersets, a plate calculator, and sync. The ontology is plain data, so it could also be published as RDF and used by the Solid translation service in this repo.
