# Pitching App

A 16-week pitcher off-season plan that installs like an app. Everything team-specific lives in **team.js**, so one set of files works for any team.

| File | What it does |
|---|---|
| `team.js` | **Team settings:** school, mascot, coach name and email, colors, season start date. The only file that differs between teams |
| `index.html` | The app: Phases, Calendar, Strength, Arm Care, Throwing, Nutrition and Ask Coach |
| `faq.js` | Ask Coach questions and answers |
| `manifest.webmanifest` | App name, colors and icons for installing on phones |
| `sw.js` | Lets the app open with no signal and pick up updates automatically |
| `icons/` | Home-screen icons |
| `setup.html` | Team setup tool (keep this on your own site only) |

## Set up a new team (about 5 minutes)

1. Open `setup.html` on your site, e.g. `https://coachbreese.github.io/clevelandpitching/setup.html`.
2. Fill in the team, coach and colors. Check the preview and the color checks.
3. Click **Download team package**. Unzip it.
4. Create a new public GitHub repository (e.g. `lincolnpitching`), upload **everything inside** the folder including `icons`, then turn on **Settings → Pages** (Deploy from branch, `main`, `/(root)`).
5. Send the coach their link.

## Change a team's settings

Open `team.js` in that team's repository, click the pencil icon, change the value, and click **Commit changes**. To change the app icon or the name under it, make a new package with `setup.html` and upload the new `manifest.webmanifest` and `icons` folder.

**Season start:** set `seasonStart` to the Monday of Week 1 (`"2026-11-02"`). The app then shows "This week" on the Phases tab, opens the Calendar to the current week, and answers "what do I do this week/today?" in Ask Coach.

## Update the plan for every team

Changes to `index.html`, `faq.js` or `sw.js` are the same for all teams: upload the new file to each team's repository. Their `team.js` stays as it is.

## Adding an Ask Coach answer

Open `faq.js`, click the pencil icon, and copy any block like this:

```js
{ q: "Question athletes ask?", k: "other words they might type", tab: "throwing",
  a: "The answer. Use **double stars** for bold and \n for a new line." },
```

`tab` can be `overview`, `calendar`, `training`, `armcare`, `throwing` or `nutrition`.

Questions that don't match an answer, and anything that sounds like pain or injury, open an email to the coach in `team.js`.
