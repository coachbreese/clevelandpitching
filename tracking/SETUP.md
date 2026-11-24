# Turn on weekly check-ins (about 15 minutes, once per team)

Athletes tap **Lifts done**, **Throwing plan followed** and **Arm care done** each week in the app (Calendar tab, or the **Check in** button on the Phases tab). Every check-in lands in a Google Sheet you own:

- **Summary** tab: one row per athlete, Weeks 1–16 across, Phase 1–4 completion.
  ✓ = all three done · 2/3 = some done · orange • = soreness · red ⚠ = PAIN (hover the cell to read where and the note) · blank = no check-in.
- **Arm reports** tab: every soreness or pain report with the date, where it hurts and the athlete's note. These are never overwritten, so a pain report stays even if the athlete updates that week later.
- **Pitcher Profiles** tab: one row per pitcher from the profile form (profile.html).
- **Coach Access** tab: your private code for the coach dashboard (see below).
- **Check-ins** tab: every check-in with the date, the three answers and any note. If an athlete updates a week, it replaces their earlier entry.

Use a personal Gmail account if your school account blocks scripts.

## 1. Make the sheet

1. Go to **sheets.new** and name the sheet, for example **Pitching Check-ins**.
2. Click **Extensions → Apps Script**.
3. Delete everything in the code box, then paste in all of **Code.gs** (it's in this `tracking` folder).
4. On the line `const NOTIFY_EMAIL = '';` put your email between the quotes, e.g. `'coach@example.com'`. You'll get an email the moment an athlete reports soreness or pain. To get emails only for pain, change `EMAIL_FOR = 'all'` to `EMAIL_FOR = 'pain'`.
5. Click the **Save** icon.

## 2. Run it once

1. In the toolbar, make sure **setup** is selected next to **Run**, then click **Run**.
2. Google asks for permission. Click **Review permissions**, pick your account.
3. You'll see "Google hasn't verified this app." That's normal for your own script: click **Advanced → Go to (your project) (unsafe) → Allow**.
4. Go back to your sheet: it now has **Summary** and **Check-ins** tabs.

## 3. Publish it as a web app

1. In Apps Script, click **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**. (Athletes don't need Google accounts. Only you can open the sheet.)
4. Click **Deploy**, then **Copy** the **Web app URL**. It starts with `https://script.google.com/macros/s/` and ends in `/exec`. **This is the link you paste into team.js.**

Paste that link into a browser tab to test it. You should see "Check-in tracking is connected." Don't copy the address from that test tab: Google changes it to a `script.googleusercontent.com/...echo...` link that can't receive check-ins. Always use the link from the Deploy screen (**Deploy → Manage deployments** shows it again anytime).

## 4. Connect the app

1. In your GitHub repository, open **team.js** and click the pencil icon.
2. Paste the link between the quotes on the `trackingUrl` line:
   `trackingUrl: "https://script.google.com/macros/s/…/exec"`
3. Also set `seasonStart` to the Monday of Week 1 so athletes see the right week and future weeks stay locked.
4. Click **Commit changes**. In a minute or two the check-in appears in the app.

Send one test check-in yourself and watch it appear in the sheet.

## Good to know

- **Names:** athletes enter their first and last name once; the app remembers it. Ask everyone to use the same spelling all season.
- **It's the honor system:** athletes check their own boxes. Use it to see who's engaged and who needs a nudge.
- **No signal:** check-ins are saved on the phone and send automatically when it's back online.
- **Changing the script later:** after editing Code.gs, use **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. The link stays the same.
- **Privacy:** the sheet is private to your Google account. Anyone with the web app link could send a check-in, so don't post the link publicly; it lives only inside the app.

## Coach dashboard

Your dashboard lives on your team's app site at **coach.html**, for example
`https://coachbreese.github.io/clevelandpitching/coach.html`. It shows who needs attention (pain, repeat soreness, missed check-ins),
the roster, each pitcher's season and profile, and team completion by week.

1. Open your check-in sheet and go to the **Coach Access** tab. Copy the code.
2. Open your team's `coach.html` on your phone, paste the code once, and tap **Open dashboard**. The phone remembers it.
3. Add it to your home screen: iPhone **Share → Add to Home Screen**, Android **⋮ → Add to Home screen**.

- **Another coach:** give them the link and the code. Anyone with both can see athletes' arm reports, so share it carefully.
- **Code got out?** In Apps Script, choose **newCoachKey** next to Run and click **Run**. The old code stops working and the new one appears on the Coach Access tab.
- The dashboard isn't linked from the athletes' app.

## Updating a sheet that already works

You only need to do this once, to get the dashboard (this is meant to be the last time):
1. Open the sheet → **Extensions → Apps Script**. Copy your `NOTIFY_EMAIL` line first (and note `EMAIL_EVERY_PROFILE`).
2. Select all of the code, delete it, paste in this folder's **Code.gs**, and put your settings back.
3. Click **Save**. Choose **setup** next to Run and click **Run** (this makes your Coach Access code).
4. **Deploy → Manage deployments → pencil → Version: New version → Deploy.** The link stays the same.
5. If you made a separate "Coach dashboard" deployment for an earlier version, you can archive it. It isn't used anymore.
