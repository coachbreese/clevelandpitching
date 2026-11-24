/**
 * Pitching App: check-ins, arm reports, pitcher profiles and the coach dashboard
 * -------------------------------------------------------------------------------
 * Paste this whole file into Extensions > Apps Script of a Google Sheet,
 * run setup once, then Deploy > New deployment > Web app (see SETUP.md).
 *
 * This is meant to be the LAST version you paste. New app and dashboard features
 * ship through the team's GitHub site; new check-in fields are saved automatically
 * in the Extra column, so this script doesn't have to change for them.
 *
 * Tabs it creates:
 *   Summary    one row per athlete, Weeks 1-16 across, phase totals
 *   Check-ins  every check-in (an update replaces that athlete's earlier one for the week)
 *   Arm reports  every soreness or pain report, never overwritten
 *   Pitcher Profiles  one row per pitcher from the profile form (profile.html), updated if they resend
 *   Coach Access  your private code for the coach dashboard (coach.html on your team's site)
 */

// Get an email the moment an athlete reports soreness or pain.
// Put your address between the quotes, e.g. 'coach@example.com'. Leave '' for no emails.
const NOTIFY_EMAIL = '';
// 'all' = email for soreness and pain · 'pain' = email only when an athlete reports pain
const EMAIL_FOR = 'all';

const LOG = 'Check-ins';
const SUMMARY = 'Summary';
const ARMLOG = 'Arm reports';
const HEADERS = ['Submitted', 'Athlete', 'Week', 'Phase', 'Lifts', 'Throwing', 'Arm care', 'All 3 done', 'Sore / pain note', 'Check-in ID', 'Arm', 'Where', 'Extra'];
// Check-in fields this script knows; anything else the app sends is kept as JSON in the Extra column
const KNOWN_FIELDS = ['type', 'id', 'device', 'team', 'name', 'week', 'phase', 'lifts', 'throwing', 'armcare', 'arm', 'areas', 'note', 'pain', 'at', 'key'];
const ACCESS = 'Coach Access';
const ID_COL = 10; // column J: keep it here so sheets made with the first version still work
const ARM_HEADERS = ['Submitted', 'Athlete', 'Week', 'Level', 'Where', 'Note'];
const PROFILES = 'Pitcher Profiles';
// [sheet column, field the form sends]
const PROFILE_COLS = [
  ['Updated', 'at'], ['Athlete', 'name'], ['Grade', 'grade'], ['Throws', 'throws'], ['Pitched for last spring', 'level'], ['Role', 'role'],
  ['Other positions', 'positions'], ['Height', 'height'], ['Weight', 'weight'],
  ['Pitches', 'pitches'], ['Best pitch', 'best'], ['Fastball', 'velo'],
  ['Top goals', 'goals'], ['New pitch wanted', 'newPitch'], ['#1 goal (own words)', 'goalText'], ['College interest', 'college'],
  ['What worked last season', 'worked'], ["What didn't work", 'didnt'],
  ['Arm, last 12 months', 'arm'], ['Where', 'armWhere'], ['Pain right now', 'painNow'],
  ['Other winter sports', 'sports'], ['Where they lift', 'gym'], ['Days/week', 'days'], ['Private coach', 'privateCoach'], ['Sleep', 'sleep'],
  ['Notes', 'notes'], ['Device ID', 'id']
];
// Set to true to get an email every time a pitcher sends a profile (pain alerts always email if NOTIFY_EMAIL is set)
const EMAIL_EVERY_PROFILE = false;
const WEEKS = 16;

/** Run once from the editor (select "setup", click Run) to create the tabs and approve access. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let log = ss.getSheetByName(LOG);
  if (!log) log = ss.insertSheet(LOG);
  log.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#e5e7eb');
  log.setFrozenRows(1);
  let arm = ss.getSheetByName(ARMLOG);
  if (!arm) arm = ss.insertSheet(ARMLOG);
  arm.getRange(1, 1, 1, ARM_HEADERS.length).setValues([ARM_HEADERS]).setFontWeight('bold').setBackground('#e5e7eb');
  arm.setFrozenRows(1);
  let sum = ss.getSheetByName(SUMMARY);
  if (!sum) sum = ss.insertSheet(SUMMARY, 0);
  rebuildSummary_();
  writeAccessTab_(coachKey_());
  return 'Ready';
}

/** The private code the coach dashboard uses. Made once by setup and kept in the script's settings. */
function coachKey_() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('COACH_KEY');
  if (!key) { key = Utilities.getUuid().replace(/-/g, '').slice(0, 24); props.setProperty('COACH_KEY', key); writeAccessTab_(key); }
  return key;
}

/** Run this (select "newCoachKey", click Run) if the code ever gets out. The old code stops working. */
function newCoachKey() {
  PropertiesService.getScriptProperties().deleteProperty('COACH_KEY');
  const key = coachKey_();
  writeAccessTab_(key);
  return key;
}

function writeAccessTab_(key) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ACCESS);
  if (!sh) sh = ss.insertSheet(ACCESS);
  sh.clear();
  sh.getRange(1, 1, 6, 1).setValues([
    ['Coach dashboard code (keep this private: it shows athletes\' arm reports)'],
    [key],
    [''],
    ['To open your dashboard: go to your team\'s app site and add coach.html to the end,'],
    ['for example https://coachbreese.github.io/clevelandpitching/coach.html, then enter this code once on each phone or computer.'],
    ['Code got out? In Apps Script, select newCoachKey and click Run to make a new one.']
  ]);
  sh.getRange(1, 1).setFontWeight('bold');
  sh.getRange(2, 1).setFontSize(18).setFontWeight('bold').setFontFamily('Courier New');
  sh.setColumnWidth(1, 900);
}

/** The app sends check-ins here. */
function doPost(e) {
  let d;
  try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'Bad request' }); }
  if (d.type === 'dashboard') return json_(dashboardResponse_(d.key));
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    if (d.type === 'profile') return json_(saveProfile_(d));
    const name = clean_(d.name, 60);
    const week = Math.round(Number(d.week));
    if (!name || !(week >= 1 && week <= WEEKS)) return json_({ ok: false, error: 'Missing name or week' });
    // Arm: 'good' | 'sore' | 'pain'. Older app versions only send a pain note.
    let level = ['good', 'sore', 'pain'].indexOf(d.arm) >= 0 ? d.arm : (clean_(d.pain, 500) ? 'sore' : 'good');
    const where = (Array.isArray(d.areas) ? d.areas : []).map(a => clean_(a, 30)).filter(String).slice(0, 8).join(', ');
    const note = d.arm ? clean_(d.note, 500) : clean_(d.pain, 500);
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
      clean_(d.id, 80) || (name + '-w' + week),
      level === 'pain' ? 'PAIN' : level === 'sore' ? 'Sore' : 'Good',
      where,
      extra_(d)
    ];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let log = ss.getSheetByName(LOG);
    if (!log || !ss.getSheetByName(ARMLOG) || log.getRange(1, HEADERS.length).getValue() !== HEADERS[HEADERS.length - 1]) { setup(); log = ss.getSheetByName(LOG); }
    // An update replaces that athlete's earlier check-in for the same week
    const last = log.getLastRow();
    let target = 0;
    if (last > 1) {
      const ids = log.getRange(2, ID_COL, last - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === row[ID_COL - 1]) { target = i + 2; break; }
    }
    if (target) log.getRange(target, 1, 1, row.length).setValues([row]);
    else log.appendRow(row);
    // Soreness and pain reports are also kept in their own log, so a later update can't erase them
    if (level !== 'good') {
      const armLog = ss.getSheetByName(ARMLOG);
      const prev = armLog.getLastRow() > 1 ? armLog.getRange(armLog.getLastRow(), 2, 1, 5).getValues()[0] : [];
      const dup = prev[0] === name && Number(prev[1]) === week && prev[2] === row[10] && prev[3] === where && prev[4] === note;
      if (!dup) {
        armLog.appendRow([new Date(), name, week, row[10], where, note]);
        armLog.getRange(armLog.getLastRow(), 1, 1, ARM_HEADERS.length).setBackground(level === 'pain' ? '#fecaca' : '#fed7aa');
        if (NOTIFY_EMAIL && (EMAIL_FOR === 'all' || level === 'pain')) {
          const subject = (level === 'pain' ? 'PAIN reported: ' : 'Soreness: ') + name + ' · ' + (where || 'arm') + ' (Week ' + week + ')';
          const body = name + ' reported ' + (level === 'pain' ? 'PAIN' : 'normal soreness') + (where ? ' in: ' + where : '') + '.\n' +
            (note ? '\nTheir note: "' + note + '"\n' : '') +
            '\nWeek ' + week + ' · Lifts: ' + row[4] + ' · Throwing: ' + row[5] + ' · Arm care: ' + row[6] +
            (level === 'pain' ? '\n\nThe app told them to stop throwing and talk to you or the trainer.' : '') +
            '\n\nOpen your check-in sheet: ' + ss.getUrl();
          MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
        }
      }
    }
    rebuildSummary_();
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/** Pitcher profile form: one row per athlete (matched by name), replaced when they resend. */
function saveProfile_(d) {
  const name = clean_(d.name, 60);
  if (!/\S+\s+\S+/.test(name)) return { ok: false, error: 'Missing name' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(PROFILES);
  const headers = PROFILE_COLS.map(c => c[0]);
  if (!sh) {
    sh = ss.insertSheet(PROFILES);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#e5e7eb').setWrap(true);
    sh.setFrozenRows(1); sh.setFrozenColumns(2);
    sh.setColumnWidth(2, 160);
    [13, 15, 17, 18, 27].forEach(c => sh.setColumnWidth(c, 260));
  }
  const row = PROFILE_COLS.map(c => c[1] === 'at' ? new Date() : clean_(d[c[1]], c[1] === 'name' ? 60 : 600));
  const last = sh.getLastRow();
  let target = 0;
  if (last > 1) {
    const names = sh.getRange(2, 2, last - 1, 1).getValues();
    for (let i = 0; i < names.length; i++) if (String(names[i][0]).trim().toLowerCase() === name.toLowerCase()) { target = i + 2; break; }
  }
  const isNew = !target;
  if (!target) target = last + 1;
  const range = sh.getRange(target, 1, 1, row.length);
  range.setValues([row]).setWrap(true).setVerticalAlignment('top');
  const pain = row[20] === 'Yes';
  const hurt = /pain that|doctor/i.test(row[18]);
  range.setBackground(pain ? '#fca5a5' : hurt ? '#fed7aa' : '#ffffff');
  sh.getRange(target, 1).setNumberFormat('M/d/yyyy h:mm am/pm');
  if (NOTIFY_EMAIL && (pain || EMAIL_EVERY_PROFILE)) {
    const v = k => row[PROFILE_COLS.findIndex(c => c[1] === k)];
    const subject = (pain ? 'PAIN on pitcher profile: ' : (isNew ? 'New pitcher profile: ' : 'Updated pitcher profile: ')) + name;
    const body = name + ' (' + v('grade') + ', throws ' + v('throws') + ') ' + (isNew ? 'sent' : 'updated') + ' a pitcher profile.\n' +
      (pain ? '\nTHEY SAID SOMETHING HURTS RIGHT NOW WHEN THEY THROW.\nArm, last 12 months: ' + v('arm') + (v('armWhere') ? ' (' + v('armWhere') + ')' : '') + '\n' : '') +
      '\nTop goals: ' + v('goals') + (v('newPitch') ? ' (new pitch: ' + v('newPitch') + ')' : '') +
      (v('goalText') ? '\n#1 goal: ' + v('goalText') : '') +
      '\nPitches: ' + v('pitches') + (v('velo') ? ' · Fastball: ' + v('velo') : '') +
      '\n\nOpen your sheet: ' + ss.getUrl();
    MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
  }
  return { ok: true };
}

/** Opening the web app link in a browser shows this, so you can confirm it's live. */
function doGet() {
  return ContentService.createTextOutput('Check-in tracking is connected. Paste this page\'s link into team.js as trackingUrl.');
}

/** Extra check-in fields (from newer app versions) as a short JSON string. */
function extra_(d) {
  const o = {};
  Object.keys(d || {}).forEach(k => {
    if (KNOWN_FIELDS.indexOf(k) >= 0 || !/^[A-Za-z][A-Za-z0-9_]{0,30}$/.test(k)) return;
    const v = d[k];
    if (typeof v === 'number' || typeof v === 'boolean') o[k] = v;
    else if (typeof v === 'string') o[k] = clean_(v, 200);
    else if (Array.isArray(v)) o[k] = v.slice(0, 10).map(x => clean_(x, 60));
  });
  const s = JSON.stringify(o);
  return s === '{}' ? '' : s.slice(0, 1500);
}

// ---------- COACH DASHBOARD ----------
// coach.html on the team's site sends {type:'dashboard', key} and gets the data back.
function dashboardResponse_(key) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('dash_fails') || 0);
  if (fails >= 20) return { ok: false, error: 'locked', message: 'Too many wrong codes. Try again in 10 minutes.' };
  const good = coachKey_();
  if (!key || String(key).trim() !== good) {
    cache.put('dash_fails', String(fails + 1), 600);
    return { ok: false, error: 'unauthorized', message: 'That code doesn\'t match. Check the Coach Access tab in your check-in sheet.' };
  }
  return { ok: true, data: dashboardData_() };
}

/** Gathers check-ins, arm reports and profiles into one record per athlete. */
function dashboardData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const iso = d => (d instanceof Date && !isNaN(d)) ? d.toISOString() : '';
  const read = name => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return [];
    return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  };
  const people = {};
  const person = name => {
    const display = String(name || '').trim().replace(/\s+/g, ' ');
    const key = display.toLowerCase();
    if (!key) return null;
    return people[key] || (people[key] = { name: display, checks: {}, arm: [], profile: null });
  };

  read(LOG).forEach(r => {
    const p = person(r[1]); const w = Number(r[2]);
    if (!p || !(w >= 1 && w <= WEEKS)) return;
    const c = { lifts: r[4] === 'Yes', throwing: r[5] === 'Yes', armcare: r[6] === 'Yes', at: iso(r[0]),
      arm: String(r[10] || ''), where: String(r[11] || ''), note: String(r[8] || ''), extra: parseExtra_(r[12]) };
    c.done = (c.lifts ? 1 : 0) + (c.throwing ? 1 : 0) + (c.armcare ? 1 : 0);
    const prev = p.checks[w];
    if (!prev || c.done >= prev.done) p.checks[w] = c;
    // Check-ins from the first app version carried soreness only as a note
    if (!c.arm && c.note) p.arm.push({ at: c.at, week: w, level: 'Sore', where: '', note: c.note });
  });
  read(ARMLOG).forEach(r => {
    const p = person(r[1]); if (!p) return;
    p.arm.push({ at: iso(r[0]), week: Number(r[2]) || 0, level: r[3] === 'PAIN' ? 'PAIN' : 'Sore', where: String(r[4] || ''), note: String(r[5] || '') });
  });
  read(PROFILES).forEach(r => {
    const p = person(r[1]); if (!p) return;
    const o = {};
    PROFILE_COLS.forEach((c, i) => { if (c[1] !== 'id') o[c[1]] = c[1] === 'at' ? iso(r[i]) : String(r[i] == null ? '' : r[i]); });
    p.profile = o;
  });
  Object.keys(people).forEach(k => people[k].arm.sort((a, b) => (b.at || '').localeCompare(a.at || '')));

  return {
    weeks: WEEKS,
    generated: iso(now), generatedLabel: Utilities.formatDate(now, tz, 'EEE MMM d, h:mm a'),
    sheetUrl: ss.getUrl(),
    athletes: Object.keys(people).sort().map(k => people[k])
  };
}

function parseExtra_(v) {
  if (!v) return null;
  try { return JSON.parse(String(v)); } catch (err) { return null; }
}

/** Rebuilds the Summary tab from the Check-ins log. */
function rebuildSummary_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = ss.getSheetByName(LOG);
  let sum = ss.getSheetByName(SUMMARY);
  if (!sum) sum = ss.insertSheet(SUMMARY, 0);
  const width = log ? Math.min(Math.max(log.getLastColumn(), ID_COL), HEADERS.length) : ID_COL;
  const rows = log && log.getLastRow() > 1 ? log.getRange(2, 1, log.getLastRow() - 1, width).getValues() : [];
  const armSheet = ss.getSheetByName(ARMLOG);
  const armRows = armSheet && armSheet.getLastRow() > 1 ? armSheet.getRange(2, 1, armSheet.getLastRow() - 1, ARM_HEADERS.length).getValues() : [];

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
    if (!prev || done >= prev.done) p.weeks[w] = { done: done, level: 0, reports: [] };
  });
  // Worst arm report each week: 1 = sore, 2 = pain. Old check-ins with only a note count as sore.
  const flag = (key, display, w, lvl, text) => {
    const p = people[key] || (people[key] = { name: display, weeks: {} });
    const x = p.weeks[w] || (p.weeks[w] = { done: -1, level: 0, reports: [] });
    x.level = Math.max(x.level, lvl);
    if (text && x.reports.indexOf(text) < 0) x.reports.push(text);
  };
  rows.forEach(r => {
    const display = String(r[1]).trim(), key = display.toLowerCase();
    if (!key) return;
    const lvl = r[10] === 'PAIN' ? 2 : r[10] === 'Sore' ? 1 : (r[10] ? 0 : (r[8] ? 1 : 0));
    if (lvl) flag(key, display, Number(r[2]), lvl, r[10] ? '' : String(r[8] || '')); // new reports are described from the Arm reports tab
  });
  armRows.forEach(r => {
    const display = String(r[1]).trim(), key = display.toLowerCase();
    if (!key) return;
    const lvl = r[3] === 'PAIN' ? 2 : 1;
    const day = r[0] instanceof Date ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'EEE M/d') : '';
    flag(key, display, Number(r[2]), lvl, (day ? day + ': ' : '') + r[3] + (r[4] ? ' · ' + r[4] : '') + (r[5] ? ' (' + r[5] + ')' : ''));
  });

  const header = ['Athlete'];
  for (let w = 1; w <= WEEKS; w++) header.push('Wk ' + w);
  header.push('Weeks done', 'Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Arm flags');

  const names = Object.keys(people).sort();
  const values = [header], colors = [header.map(() => '#e5e7eb')], notes = [header.map(() => '')];
  names.forEach(k => {
    const p = people[k];
    const v = [p.name], c = ['#ffffff'], n = [''];
    let full = 0, flags = 0; const phaseFull = [0, 0, 0, 0];
    for (let w = 1; w <= WEEKS; w++) {
      const x = p.weeks[w];
      let cell = '', color = '#ffffff', note = '';
      if (x) {
        if (x.done === 3) { cell = '✓'; color = '#bbf7d0'; full++; phaseFull[Math.ceil(w / 4) - 1]++; }
        else if (x.done >= 0) { cell = x.done + '/3'; color = '#fef08a'; }
        if (x.level === 2) { cell = (cell ? cell + ' ' : '') + '⚠'; color = '#fca5a5'; }
        else if (x.level === 1) { cell = (cell ? cell + ' ' : '') + '•'; color = '#fed7aa'; }
        if (x.level) { flags++; note = x.reports.join('\n'); }
      }
      v.push(cell); c.push(color); n.push(note);
    }
    v.push(full + ' / ' + WEEKS); c.push('#ffffff'); n.push('');
    phaseFull.forEach(f => { v.push(f === 4 ? 'Complete' : f + ' / 4'); c.push(f === 4 ? '#bbf7d0' : '#ffffff'); n.push(''); });
    v.push(flags ? flags + ' wk' + (flags === 1 ? '' : 's') : ''); c.push(flags ? '#fed7aa' : '#ffffff'); n.push('');
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
  sum.getRange(keyRow, 1, 1, 1).setValue('Key: ✓ = lifts, throwing and arm care all done · 2/3 = some done · • orange = soreness · ⚠ red = PAIN (hover a cell to read where and what they wrote) · blank = no check-in. Every report is listed on the Arm reports tab.').setFontColor('#4b5563');
}

function clean_(s, max) {
  s = String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim();
  if (/^[=+\-@]/.test(s)) s = "'" + s; // keep the sheet from treating text as a formula
  return s.slice(0, max);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
