/**
 * INF JCI Togo — Signal des codes de formation utilisés plusieurs fois.
 * À installer dans le classeur « Programmation des formations » (Extensions > Apps Script).
 *
 * À chaque rapport reçu par formulaire, le script vérifie le code de formation :
 *  - « Rapport de formation des OL » : le code ne doit figurer que dans un seul rapport ;
 *  - « Rapport des formateurs » : un même formateur ne déclare pas deux fois un code,
 *    et un code a au plus un formateur principal et un formateur assistant.
 * En cas de doublon : lignes concernées surlignées, note sur la cellule du code, e-mail à la DINF.
 */

// Adresse(s) qui reçoivent l'alerte (séparer plusieurs adresses par des virgules).
var DINF_EMAIL = 'difjcitogo@gmail.com';

var FEUILLE_OL = 'Rapport de formation des OL';
var FEUILLE_FORMATEURS = 'Rapport des formateurs';
var COULEUR_SIGNAL = '#FDE68A';
var MARQUE = '⚠ CODE EN DOUBLE';

// ── Installation : à exécuter une seule fois depuis l'éditeur
function installer() {
  var ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'signalerCodeEnDouble') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('signalerCodeEnDouble').forSpreadsheet(ss).onFormSubmit().create();
  verifierTousLesCodes();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('INF')
    .addItem('Vérifier tous les codes de formation', 'verifierTousLesCodes')
    .addToUi();
}

// ── Déclenché à chaque réponse de formulaire
function signalerCodeEnDouble(e) {
  var sheet = e.range.getSheet();
  var kind = typeFeuille_(sheet.getName());
  if (!kind) return;
  var data = lireFeuille_(sheet);
  var newIdx = e.range.getRow() - 2;
  var conflits = analyser_(kind, data.headers, data.rows).filter(function (c) {
    return c.rows.indexOf(newIdx) >= 0;
  });
  if (!conflits.length) return;
  conflits.forEach(function (c) { marquer_(sheet, data, c); });
  envoyerAlerte_(sheet.getName(), data, conflits);
}

// ── Vérification complète (menu INF ou installation)
function verifierTousLesCodes() {
  var ss = SpreadsheetApp.getActive();
  var bilan = [];
  [FEUILLE_OL, FEUILLE_FORMATEURS].forEach(function (nom) {
    var sheet = ss.getSheetByName(nom);
    if (!sheet) { bilan.push(nom + ' : feuille introuvable'); return; }
    var data = lireFeuille_(sheet);
    effacerMarques_(sheet, data);
    var conflits = analyser_(typeFeuille_(nom), data.headers, data.rows);
    conflits.forEach(function (c) { marquer_(sheet, data, c); });
    bilan.push(nom + ' : ' + conflits.length + ' code(s) en double' +
      (conflits.length ? ' (' + conflits.map(function (c) { return c.code; }).join(', ') + ')' : ''));
  });
  try { SpreadsheetApp.getUi().alert('Vérification des codes de formation\n\n' + bilan.join('\n')); }
  catch (err) { Logger.log(bilan.join('\n')); }
}

// ── Logique (sans dépendance à Google, testable)
function normaliser_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}
function normaliserCode_(s) {
  return String(s == null ? '' : s).toUpperCase().replace(/\s+/g, '').replace(/^([A-Z]+?)O(\d)/, '$10$2');
}
function typeFeuille_(nom) {
  if (nom === FEUILLE_OL) return 'ol';
  if (nom === FEUILLE_FORMATEURS) return 'fmt';
  return null;
}
function colonne_(headers, mots) {
  var h = headers.map(normaliser_);
  for (var i = 0; i < h.length; i++) {
    if (mots.every(function (m) { return h[i].indexOf(m) >= 0; })) return i;
  }
  return -1;
}
function colonnes_(headers) {
  return {
    code: colonne_(headers, ['code']),
    nif: colonne_(headers, ['nif']),
    nom: colonne_(headers, ['nom']),
    niveau: colonne_(headers, ['niveau']),
    ol: colonne_(headers, ['organisation']),
    date: colonne_(headers, ['date', 'formation'])
  };
}
// Renvoie [{code, raison, rows:[index de ligne de données, base 0]}]
function analyser_(kind, headers, rows) {
  var c = colonnes_(headers);
  if (c.code < 0) return [];
  var groupes = {}, ordre = [];
  rows.forEach(function (r, i) {
    var code = normaliserCode_(r[c.code]);
    if (!code) return;
    if (!groupes[code]) { groupes[code] = []; ordre.push(code); }
    groupes[code].push(i);
  });
  var res = [];
  ordre.forEach(function (code) {
    var idx = groupes[code];
    if (kind === 'ol') {
      if (idx.length > 1) res.push({ code: code, raison: 'Code déclaré dans ' + idx.length + " rapports d'OL", rows: idx });
      return;
    }
    var parNif = {}, principaux = {}, assistants = {};
    idx.forEach(function (i) {
      var r = rows[i];
      var cle = normaliser_(c.nif >= 0 && r[c.nif] !== '' ? r[c.nif] : (c.nom >= 0 ? r[c.nom] : i));
      parNif[cle] = (parNif[cle] || 0) + 1;
      var niv = normaliser_(c.niveau >= 0 ? r[c.niveau] : '');
      if (niv.indexOf('principal') >= 0) principaux[cle] = 1;
      else if (niv.indexOf('assistant') >= 0) assistants[cle] = 1;
    });
    var raisons = [];
    if (Object.keys(parNif).some(function (k) { return parNif[k] > 1; })) raisons.push('même formateur déclaré deux fois');
    var np = Object.keys(principaux).length, na = Object.keys(assistants).length;
    if (np > 1) raisons.push(np + ' formateurs principaux');
    if (na > 1) raisons.push(na + ' formateurs assistants');
    if (raisons.length) res.push({ code: code, raison: 'Rapports formateurs : ' + raisons.join(', '), rows: idx });
  });
  return res;
}
function decrireLigne_(kind, headers, r) {
  var c = colonnes_(headers);
  var d = c.date >= 0 ? r[c.date] : '';
  if (Object.prototype.toString.call(d) === '[object Date]') d = Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  var qui = kind === 'ol' ? (c.ol >= 0 ? r[c.ol] : '') :
    (c.nom >= 0 ? r[c.nom] : '') + (c.nif >= 0 ? ' (NIF ' + r[c.nif] + ')' : '') + (c.niveau >= 0 && r[c.niveau] ? ' — ' + r[c.niveau] : '');
  return [d, qui].filter(function (x) { return String(x).trim(); }).join(' · ');
}

// ── Accès à la feuille
function lireFeuille_(sheet) {
  var lastRow = sheet.getLastRow(), lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];
  return { headers: headers, rows: rows, lastCol: lastCol, codeCol: colonnes_(headers).code };
}
function marquer_(sheet, data, conflit) {
  conflit.rows.forEach(function (i) {
    sheet.getRange(i + 2, 1, 1, data.lastCol).setBackground(COULEUR_SIGNAL);
    sheet.getRange(i + 2, data.codeCol + 1).setNote(MARQUE + '\n' + conflit.raison);
  });
}
function effacerMarques_(sheet, data) {
  if (data.codeCol < 0 || !data.rows.length) return;
  var notes = sheet.getRange(2, data.codeCol + 1, data.rows.length, 1).getNotes();
  notes.forEach(function (n, i) {
    if (String(n[0]).indexOf(MARQUE) === 0) {
      sheet.getRange(i + 2, 1, 1, data.lastCol).setBackground(null);
      sheet.getRange(i + 2, data.codeCol + 1).setNote('');
    }
  });
}
function envoyerAlerte_(nomFeuille, data, conflits) {
  if (!DINF_EMAIL) return;
  var kind = typeFeuille_(nomFeuille);
  var corps = 'Un rapport vient d\'être envoyé avec un code de formation déjà utilisé.\n\n' +
    'Feuille : ' + nomFeuille + '\n\n' +
    conflits.map(function (c) {
      return 'Code ' + c.code + ' — ' + c.raison + '\n' + c.rows.map(function (i) {
        return '  • Ligne ' + (i + 2) + ' : ' + decrireLigne_(kind, data.headers, data.rows[i]);
      }).join('\n');
    }).join('\n\n') +
    '\n\nLes lignes concernées sont surlignées en jaune dans le classeur :\n' +
    SpreadsheetApp.getActive().getUrl();
  MailApp.sendEmail(DINF_EMAIL, '⚠ INF — Code de formation en double : ' +
    conflits.map(function (c) { return c.code; }).join(', '), corps);
}
