# Cleveland Warriors Pitching App

Files for the GitHub Pages site. Upload everything in this folder, including the `icons` folder, to the root of your repository.

| File | What it does |
|---|---|
| `index.html` | The whole plan: Phases, Strength, Arm Care, Throwing, Nutrition and Ask Coach |
| `faq.js` | The Ask Coach questions and answers. Edit this to add or change answers |
| `manifest.webmanifest` | App name, colors and icons, so phones can install it |
| `sw.js` | Lets the app open with no signal and pick up your updates automatically |
| `icons/` | Home-screen icons |

## Upload steps

1. In your repository, click **Add file → Upload files**.
2. Drag in all the files **and the `icons` folder**, then click **Commit changes**.
3. Go to **Settings → Pages**, set Source to **Deploy from a branch**, pick **main** and **/(root)**, and click **Save**.
4. After a minute or two, your link appears at the top of the Pages screen.

## Updating later

Upload the changed file (usually `index.html` or `faq.js`) to the same repository. The link stays the same. Athletes get the new version the next time they open the app with signal.

## Adding an Ask Coach answer

Open `faq.js` on GitHub, click the pencil icon, and copy any block that looks like this:

```js
{ q: "Question athletes ask?", k: "other words they might type", tab: "throwing",
  a: "The answer. Use **double stars** for bold and \n for a new line." },
```

`tab` can be `overview`, `training`, `armcare`, `throwing` or `nutrition`. Click **Commit changes** when done.

Questions that don't match an answer, and anything that sounds like pain or injury, open an email to coachjbreese@gmail.com.
