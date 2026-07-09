# Fatgo

A web app (phone app later) that helps you lower your body fat percentage using research-backed formulas and a data-driven plan.

## The idea

- You enter your stats (age, sex, height, weight, body fat % if known, activity level).
- Fatgo calculates your daily energy burn and sets a safe calorie deficit and macro targets.
- It tells you **what to do workout-wise** (weekly plan built around resistance training + cardio, which research shows preserves muscle while losing fat).
- It tells you **what to eat** (calorie + protein/fat/carb targets and food suggestions).
- It shows a **daily timeline** of when to eat and train relative to your wake time.
- You log your weight daily and the app tracks your trend — you are test user #1.

## The science it uses (v1)

- **BMR**: Mifflin-St Jeor equation (or Katch-McArdle when body fat % is provided — more accurate for lean mass).
- **TDEE**: BMR × activity multiplier.
- **Deficit**: ~20% below TDEE (roughly 0.5–1% of body weight lost per week — the range studies show preserves muscle).
- **Protein**: ~1.8 g per kg body weight (high protein preserves lean mass in a deficit).
- **Fat**: ~25% of calories; carbs fill the rest, timed around training.

A note on "when metabolism kicks in": metabolism runs 24/7 — it doesn't switch on at a certain hour. What *does* change through the day is insulin sensitivity, digestion (the thermic effect of each meal), and workout performance. So instead of a metabolism on-switch, Fatgo shows the moments that matter: when to eat after waking, when to train, and when to stop eating before bed.

## Run it

Open `index.html` in a browser. All data is stored locally in your browser (localStorage) — no account needed.

## Later

- Wrap with Capacitor to ship as an iOS/Android app.
- Sync data to a backend so it works across devices.
- Smarter algorithm: adjust calories weekly based on actual weight-trend data.

## Disclaimer

Fatgo gives general fitness guidance, not medical advice. Check with a doctor before big diet or exercise changes.
