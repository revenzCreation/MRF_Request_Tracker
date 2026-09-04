const CONFIG = {
  sheetName: 'MRF Requests',
  driveFolderId: '1m43NthL-cWmxjuC3iaYe9Gkxf1VHJrlq',
  driveFolderName: 'MRF Monitor Uploads'
};

const HEADERS = [
  'id', 'mrfNumber', 'department', 'position', 'headcount', 'dateRequested',
  'dateNeeded', 'requestedBy', 'status', 'remarks', 'fileName', 'fileUrl',
  'createdAt', 'updatedAt'
];
const DISPLAY_HEADERS = HEADERS.map(header => header.replace(/[A-Z]/g, letter => ' ' + letter).toUpperCase());
const REFERRAL_HEADERS = [
  'Timestamp', 'Referrer Name', 'Referrer Email', 'Department', 'Candidate Name',
  'Candidate Email', 'Phone', 'Portfolio', 'Target Role', 'Relationship',
  'HR Notes', 'Resume Link'
];
const DISPLAY_REFERRAL_HEADERS = REFERRAL_HEADERS.map(header => header.toUpperCase());

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'list';
    if (action !== 'list') return json({ ok: false, error: 'Unknown action' });
    return json({ ok: true, records: readRecords() });
  } catch (error) {
    return json({ ok: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!body.action) return saveReferral(body);
    if (body.action === 'save') return json({ ok: true, record: saveRecord(body.record) });
    if (body.action === 'delete') {
      deleteRecord(body.id);
      return json({ ok: true });
    }
    return json({ ok: false, error: 'Unknown action' });
  } catch (error) {
    return json({ ok: false, error: error.message });
  }
}

function saveReferral(data) {
  const sheet = getOrCreateReferralSheet();
  let fileLink = 'No Resume Uploaded';
  if (data.hasFile && data.fileData) {
    const folder = DriveApp.getFolderById('1kL5CK1-ZEY51BZo6_BQjY8MSSfoEzcBl');
    const bytes = Utilities.base64Decode(data.fileData.split(',').pop());
    const blob = Utilities.newBlob(bytes, data.mimeType, data.fileName);
    fileLink = folder.createFile(blob).getUrl();
  }
  sheet.appendRow([
    new Date(), data.referrerName, data.referrerEmail, data.referrerDepartment,
    data.candidateName, data.candidateEmail, data.candidatePhone,
    data.candidatePortfolio, data.targetRole, data.relationship, data.notes, fileLink
  ]);
  return json({ status: 'success' });
}

function getOrCreateReferralSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName('Referrals');
  if (!sheet) sheet = spreadsheet.insertSheet('Referrals');
  if (sheet.getLastRow() === 0) sheet.appendRow(DISPLAY_REFERRAL_HEADERS);
  sheet.getRange(1, 1, 1, REFERRAL_HEADERS.length)
    .setFontWeight('bold')
    .setFontColor('#1f2933')
    .setBackground('#d9ead3')
    .setHorizontalAlignment('center');
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), REFERRAL_HEADERS.length)
    .setFontWeight('normal')
    .setFontColor('#000000')
    .setBackground('#FFFFFF');
  return sheet;
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(CONFIG.sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.sheetName);
  if (sheet.getLastRow() === 0) sheet.appendRow(DISPLAY_HEADERS);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setFontColor('#1f2933')
    .setBackground('#d9ead3')
    .setHorizontalAlignment('center');
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), HEADERS.length)
    .setFontWeight('normal')
    .setFontColor('#000000')
    .setBackground('#FFFFFF');
  sheet.getRange('A:A').setNumberFormat('@');
  return sheet;
}

function readRecords() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).filter(row => row[0]).map(row => {
    const record = {};
    HEADERS.forEach((header, index) => record[header] = row[index] === '' ? '' : row[index]);
    record.headcount = Number(record.headcount) || 1;
    record.createdAt = Number(record.createdAt) || 0;
    record.updatedAt = Number(record.updatedAt) || record.createdAt;
    return record;
  }).sort((a, b) => b.createdAt - a.createdAt);
}

function saveRecord(input) {
  if (!input) throw new Error('Record data is required');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getSheet();
    const record = Object.assign({}, input);
    delete record.fileData;
    delete record.fileMimeType;
    const existingRow = record.id ? findRow(sheet, record.id) : 0;
    if (!existingRow) record.id = nextRequestId(sheet);

    if (input.fileData) {
      const folder = getUploadFolder();
      const bytes = Utilities.base64Decode(input.fileData.split(',').pop());
      const fileName = makeUploadName(record.id, input.fileName);
      const blob = Utilities.newBlob(bytes, input.fileMimeType || 'application/octet-stream', fileName);
      const file = folder.createFile(blob);
      record.fileName = file.getName();
      record.fileUrl = file.getUrl();
    }

    const values = HEADERS.map(header => record[header] == null ? '' : record[header]);
    if (existingRow) sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([values]);
    else sheet.appendRow(values);
    return record;
  } finally {
    lock.releaseLock();
  }
}

function nextRequestId(sheet) {
  const ids = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const highest = ids.reduce((max, row) => {
    const value = String(row[0]).trim();
    const number = /^\d{1,4}$/.test(value) ? Number(value) : 0;
    return Math.max(max, number);
  }, 0);
  if (highest >= 9999) throw new Error('No four-digit request IDs remain');
  return String(highest + 1).padStart(4, '0');
}

function makeUploadName(id, originalName) {
  const extensionMatch = String(originalName || '').match(/(\.[a-z0-9]{1,8})$/i);
  return 'T-FILE_' + String(id).padStart(4, '0') + (extensionMatch ? extensionMatch[1].toLowerCase() : '');
}

function deleteRecord(id) {
  const sheet = getSheet();
  const row = findRow(sheet, id);
  if (row) sheet.deleteRow(row);
}

function findRow(sheet, id) {
  if (sheet.getLastRow() < 2) return 0;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const target = String(id).replace(/^0+(?=\d)/, '');
  const index = ids.findIndex(row => String(row[0]).replace(/^0+(?=\d)/, '') === target);
  return index < 0 ? 0 : index + 2;
}

function getUploadFolder() {
  if (CONFIG.driveFolderId) return DriveApp.getFolderById(CONFIG.driveFolderId);
  const folders = DriveApp.getFoldersByName(CONFIG.driveFolderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(CONFIG.driveFolderName);
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
