const CONFIG = {
  sheetName: 'MRF Requests',
  driveFolderId: '',
  driveFolderName: 'MRF Monitor Uploads'
};

const HEADERS = [
  'id', 'mrfNumber', 'department', 'position', 'headcount', 'dateRequested',
  'dateNeeded', 'requestedBy', 'status', 'remarks', 'fileName', 'fileUrl',
  'createdAt', 'updatedAt'
];

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
  if (sheet.getLastRow() === 0) sheet.appendRow([
    'Timestamp', 'Referrer Name', 'Referrer Email', 'Department', 'Candidate Name',
    'Candidate Email', 'Phone', 'Portfolio', 'Target Role', 'Relationship',
    'HR Notes', 'Resume Link'
  ]);
  return sheet;
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(CONFIG.sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.sheetName);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function readRecords() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row[0]).map(row => {
    const record = {};
    headers.forEach((header, index) => record[header] = row[index] === '' ? '' : row[index]);
    record.headcount = Number(record.headcount) || 1;
    record.createdAt = Number(record.createdAt) || 0;
    record.updatedAt = Number(record.updatedAt) || record.createdAt;
    return record;
  }).sort((a, b) => b.createdAt - a.createdAt);
}

function saveRecord(input) {
  if (!input || !input.id) throw new Error('Record ID is required');
  const sheet = getSheet();
  const record = Object.assign({}, input);
  delete record.fileData;
  delete record.fileMimeType;

  if (input.fileData) {
    const folder = getUploadFolder();
    const bytes = Utilities.base64Decode(input.fileData.split(',').pop());
    const blob = Utilities.newBlob(bytes, input.fileMimeType || 'application/octet-stream', input.fileName || input.id);
    const file = folder.createFile(blob);
    record.fileName = file.getName();
    record.fileUrl = file.getUrl();
  }

  const values = HEADERS.map(header => record[header] == null ? '' : record[header]);
  const existingRow = findRow(sheet, record.id);
  if (existingRow) sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([values]);
  else sheet.appendRow(values);
  return record;
}

function deleteRecord(id) {
  const sheet = getSheet();
  const row = findRow(sheet, id);
  if (row) sheet.deleteRow(row);
}

function findRow(sheet, id) {
  if (sheet.getLastRow() < 2) return 0;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const index = ids.findIndex(row => String(row[0]) === String(id));
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
