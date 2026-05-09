# SJ Giants Tracker

A Progressive Web App to track every San Jose Giants game you attend.

## Setup

### 1. Supabase — run the schema
1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Paste the contents of `supabase/schema.sql` and click **Run**
4. This creates all tables and seeds your prospect database

### 2. Deploy to Vercel
1. Push this repo to GitHub at `github.com/xmdii/sj-giants-tracker`
2. Go to vercel.com and click **Add New Project**
3. Import the `sj-giants-tracker` repo
4. Click **Deploy** — no environment variables needed (keys are in app.js)
5. Your app will be live at `https://sj-giants-tracker.vercel.app`

### 3. Install on iPhone
1. Open your Vercel URL in **Safari** on your iPhone
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add**
5. The app icon appears on your home screen — tap it to open like a native app

## Features
- **Home** — season summary, fan record, recent games
- **Games** — full game log, tap any game for box score detail
- **Players** — cumulative stats leaderboard with AVG/Hits/RBI/HR sorting
- **Prospects** — SF Giants and opposing prospects seen, with org rank and MLB Pipeline top-100 badges
- **Record** — W-L record overall, home/away split, by opponent

## Adding a game
- Tap **Add game** on Home or Games screen
- If SJ Giants play today, the app fetches the schedule automatically — tap the game
- After the game ends, the full box score loads automatically with all stats and prospect tags
- No box score yet? Enter manually with the fallback form

## Updating prospects
When MLB Pipeline updates their top 100, go to Supabase SQL Editor and run:
```sql
update prospect_db set mlb_rank = [new_rank], mlb_top100 = true where name_lower = '[player name]';
```
Or paste the full seed section from schema.sql with updated numbers.
