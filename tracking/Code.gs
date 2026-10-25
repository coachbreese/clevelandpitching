/**
 * Pitching App: weekly check-in tracker
 * --------------------------------------
 * Paste this whole file into Extensions > Apps Script of a Google Sheet,
 * run setup once, then Deploy > New deployment > Web app (see SETUP.md).
 *
 * Tabs it creates:
 *   Summary    one row per athlete, Weeks 1-16 across, phase totals
 *   Check-ins  every check-in (an update replaces that athlete's earlier one for the week)
 */

// Optional: get an email whenever an athlete reports soreness or pain.
// Put your address between the quotes, e.g. 'coach@example.com'. Leave '' for no emails.
const NOTIFY_EMAIL = '';

const LOG = 'Check-ins';
const SUMMARY = 'Summary';
const HEADERS = ['Submitted', 'Athlete', 'Week', 'Phase', 'Lifts', 'Throwing', 'Arm care', 'All 3 done', 'Sore / pain note', 'Check-in ID'];
const WEEKS = 16;

/** Run once from the editor (select "setup", click Run) to create the tabs and approve access. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let log = ss.getSheetByName(LOG);
  if (!log) log = ss.insertSheet(LOG);
  log.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#e5e7eb');
  log.setFrozenRows(1);
  let sum = ss.getSheetByName(SUMMARY);
  if (!sum) sum = ss.insertSheet(SUMMARY, 0);
  rebuildSummary_();
  return 'Ready';
}

/** The app sends check-ins here. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const name = clean_(d.name, 60);
    const week = Math.round(Number(d.week));
    if (!name || !(week >= 1 && week <= WEEKS)) return json_({ ok: false, error: 'Missing name or week' });
    const row = [
      new Date(),
      name,
      week,
      Math.ceil(week / 4),
      d.lifts ? 'Yes' : 'No',
      d.throwing ? 'Yes' : 'No',
      d.armcare ? 'Yes' : 'No',
      d.lifts && d.throwing && d.armcare ? 'Yes' : 'No',
      clean_(d.pain, 500),
      clean_(d.id, 80) || (name + '-w' + week)
    ];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let log = ss.getSheetByName(LOG);
    if (!log) { setup(); log = ss.getSheetByName(LOG); }
    // An update replaces that athlete's earlier check-in for the same week
    const last = log.getLastRow();
    let target = 0;
    if (last > 1) {
      const ids = log.getRange(2, HEADERS.length, last - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === row[9]) { target = i + 2; break; }
    }
    if (target) log.getRange(target, 1, 1, row.length).setValues([row]);
    else log.appendRow(row);
    rebuildSummary_();
    if (row[8] && NOTIFY_EMAIL) {
      MailApp.sendEmail(NOTIFY_EMAIL, 'Pitching check-in: ' + name + ' reported soreness (Week ' + week + ')',
        name + ' wrote: "' + row[8] + '"\n\nWeek ' + week + ' · Lifts: ' + row[4] + ' · Throwing: ' + row[5] + ' · Arm care: ' + row[6] +
        '\n\nOpen your check-in sheet: ' + ss.getUrl());
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/** Opening the web app link in a browser shows this, so you can confirm it's live. */
function doGet() {
  return ContentService.createTextOutput('Check-in tracking is connected. Paste this page\'s link into team.js as trackingUrl.');
}

/** Rebuilds the Summary tab from the Check-ins log. */
function rebuildSummary_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = ss.getSheetByName(LOG);
  let sum = ss.getSheetByName(SUMMARY);
  if (!sum) sum = ss.insertSheet(SUMMARY, 0);
  const rows = log && log.getLastRow() > 1 ? log.getRange(2, 1, log.getLastRow() - 1, HEADERS.length).getValues() : [];

  // athlete -> week -> { done: count of 3, pain }
  const people = {};
  rows.forEach(r => {
    const display = String(r[1]).trim();
    const key = display.toLowerCase();
    if (!key) return;
    const w = Number(r[2]);
    const done = (r[4] === 'Yes') + (r[5] === 'Yes') + (r[6] === 'Yes');
    const p = people[key] || (people[key] = { name: display, weeks: {} });
    const prev = p.weeks[w];
    if (!prev || done >= prev.done) p.weeks[w] = { done: done, pain: String(r[8] || '') };
    else if (r[8]) prev.pain = String(r[8]);
  });

  const header = ['Athlete'];
  for (let w = 1; w <= WEEKS; w++) header.push('Wk ' + w);
  header.push('Weeks done', 'Phase 1', 'Phase 2', 'Phase 3', 'Phase 4');

  const names = Object.keys(people).sort();
  const values = [header], colors = [header.map(() => '#e5e7eb')], notes = [header.map(() => '')];
  names.forEach(k => {
    const p = people[k];
    const v = [p.name], c = ['#ffffff'], n = [''];
    let full = 0; const phaseFull = [0, 0, 0, 0];
    for (let w = 1; w <= WEEKS; w++) {
      const x = p.weeks[w];
      let cell = '', color = '#ffffff', note = '';
      if (x) {
        if (x.done === 3) { cell = '✓'; color = '#bbf7d0'; full++; phaseFull[Math.ceil(w / 4) - 1]++; }
        else { cell = x.done + '/3'; color = '#fef08a'; }
        if (x.pain) { cell += ' ⚠'; color = '#fecaca'; note = 'Sore / pain: ' + x.pain; }
      }
      v.push(cell); c.push(color); n.push(note);
    }
    v.push(full + ' / ' + WEEKS); c.push('#ffffff'); n.push('');
    phaseFull.forEach(f => { v.push(f === 4 ? 'Complete' : f + ' / 4'); c.push(f === 4 ? '#bbf7d0' : '#ffffff'); n.push(''); });
    values.push(v); colors.push(c); notes.push(n);
  });

  sum.clear();
  const range = sum.getRange(1, 1, values.length, header.length);
  range.setValues(values).setBackgrounds(colors).setNotes(notes).setHorizontalAlignment('center');
  sum.getRange(1, 1, values.length, 1).setHorizontalAlignment('left');
  sum.getRange(1, 1, 1, header.length).setFontWeight('bold');
  sum.setFrozenRows(1); sum.setFrozenColumns(1);
  sum.setColumnWidth(1, 180);
  for (let col = 2; col <= WEEKS + 1; col++) sum.setColumnWidth(col, 56);
  const keyRow = values.length + 2;
  sum.getRange(keyRow, 1, 1, 1).setValue('Key: ✓ = lifts, throwing and arm care all done · 2/3 = some done · ⚠ = athlete reported soreness (hover the cell to read it) · blank = no check-in').setFontColor('#4b5563');
}

function clean_(s, max) {
  s = String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim();
  if (/^[=+\-@]/.test(s)) s = "'" + s; // keep the sheet from treating text as a formula
  return s.slice(0, max);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
