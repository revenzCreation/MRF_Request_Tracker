const CONFIG = {
  sheetName: 'MRF Requests',
  employeeFilesSheetName: '201 Files',
  driveFolderId: '1m43NthL-cWmxjuC3iaYe9Gkxf1VHJrlq',
  driveFolderName: 'MRF Monitor Uploads',
  employeeFilesDriveFolderId: '1wroebNAIgVf6oMVa1EMm6gZ_-f6dCotL'
};

const HEADERS = [
  'id', 'mrfNumber', 'department', 'position', 'headcount', 'dateRequested',
  'dateNeeded', 'requestedBy', 'status', 'remarks', 'fileName', 'fileUrl',
  'createdAt', 'updatedAt'
];
const DISPLAY_HEADERS = HEADERS.map(header => header.replace(/[A-Z]/g, letter => ' ' + letter).toUpperCase());
const EMPLOYEE_FILE_HEADERS = [
  'id', 'surname', 'firstName', 'middleInitial', 'suffix', 'dateHired', 'directLink', 'driveFileId'
];
const REFERRAL_HEADERS = [
  'Timestamp', 'Referrer Name', 'Referrer Email', 'Department', 'Candidate Name',
  'Candidate Email', 'Phone', 'Portfolio', 'Target Role', 'Relationship',
  'HR Notes', 'Resume Link'
];
const DISPLAY_REFERRAL_HEADERS = REFERRAL_HEADERS.map(header => header.toUpperCase());
const SHEET_FONT_FAMILY = 'Arial';
const SHEET_FONT_SIZE = 10;

function doGet(e) {
  try {
    applyWorkbookDefaults();
    const action = (e && e.parameter && e.parameter.action) || 'list';
    if (action === '201-list') {
      if (shouldSyncEmployeeFiles()) {
        syncEmployeeFiles();
      }
      return json({ ok: true, records: readEmployeeFiles() });
    }
    if (action !== 'list') return json({ ok: false, error: 'Unknown action' });
    return json({ ok: true, records: readRecords() });
  } catch (error) {
    return json({ ok: false, error: error.message });
  }
}

function doPost(e) {
  try {
    applyWorkbookDefaults();
    const body = parseJsonBody(e);
    if (!body || typeof body !== 'object') {
      return json({ ok: false, error: 'Invalid request payload' });
    }
    if (!body.action) return saveReferral(body);
    if (body.action === 'save') return json({ ok: true, record: saveRecord(body.record) });
    if (body.action === 'delete') {
      deleteRecord(body.id);
      return json({ ok: true });
    }
    return json({ ok: false, error: 'Unknown action' });
  } catch (error) {
    return json({ ok: false, error: error.message || 'Unexpected server error' });
  }
}

function parseJsonBody(e) {
  const raw = (e && e.postData && e.postData.contents) || '';
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    throw new Error('Invalid JSON payload');
  }
}

function saveReferral(data) {
  const sheet = getOrCreateReferralSheet();
  let fileLink = 'No Resume Uploaded';
  if (data && data.hasFile && data.fileData) {
    const folder = getReferralFolder();
    const bytes = Utilities.base64Decode(String(data.fileData).split(',').pop());
    const blob = Utilities.newBlob(bytes, data.mimeType || 'application/octet-stream', data.fileName || 'referral-upload');
    fileLink = folder.createFile(blob).getUrl();
  }
  const row = [
    new Date(), data.referrerName, data.referrerEmail, data.referrerDepartment,
    data.candidateName, data.candidateEmail, data.candidatePhone,
    data.candidatePortfolio, data.targetRole, data.relationship, data.notes, fileLink
  ];
  sheet.appendRow(row);
  if (fileLink !== 'No Resume Uploaded') {
    setNamedLink(sheet, sheet.getLastRow(), REFERRAL_HEADERS.indexOf('Resume Link') + 1, fileLink, 'REFERRAL_LINK_' + (sheet.getLastRow() - 1));
  }
  applySheetDefaults(sheet, REFERRAL_HEADERS.length);
  return json({ status: 'success' });
}

function getReferralFolder() {
  const folderId = '1kL5CK1-ZEY51BZo6_BQjY8MSSfoEzcBl';
  try {
    return DriveApp.getFolderById(folderId);
  } catch (error) {
    const rootFolder = DriveApp.getRootFolder();
    const existing = DriveApp.getFoldersByName('Referral Uploads');
    if (existing.hasNext()) return existing.next();
    return rootFolder.createFolder('Referral Uploads');
  }
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
  applySheetDefaults(sheet, REFERRAL_HEADERS.length);
  normalizeNamedLinks(sheet, REFERRAL_HEADERS.indexOf('Resume Link') + 1, 'REFERRAL_LINK_');
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
  applySheetDefaults(sheet, HEADERS.length);
  normalizeNamedLinks(sheet, HEADERS.indexOf('fileUrl') + 1, 'MRF_LINK_');
  return sheet;
}

function readRecords() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const richValues = sheet.getDataRange().getRichTextValues();
  if (values.length < 2) return [];
  return values.slice(1).map((row, rowIndex) => ({ row, rowIndex }))
    .filter(item => item.row[0])
    .map(item => {
    const row = item.row;
    const rowIndex = item.rowIndex;
    const record = {};
    HEADERS.forEach((header, index) => record[header] = row[index] === '' ? '' : row[index]);
    record.fileUrl = getRichTextUrl(richValues[rowIndex + 1][HEADERS.indexOf('fileUrl')]) || record.fileUrl;
    record.headcount = Number(record.headcount) || 1;
    record.createdAt = Number(record.createdAt) || 0;
    record.updatedAt = Number(record.updatedAt) || record.createdAt;
    return record;
  }).sort((a, b) => b.createdAt - a.createdAt);
}

function readEmployeeFiles() {
  const sheet = getEmployeeFilesSheet();
  const values = sheet.getDataRange().getValues();
  const richValues = sheet.getDataRange().getRichTextValues();
  if (values.length < 2) return [];
  return values.slice(1).map((row, rowIndex) => ({ row, rowIndex }))
    .filter(item => item.row[0] || item.row[1] || item.row[2])
    .map(item => {
    const row = item.row;
    const rowIndex = item.rowIndex;
    const record = {};
    EMPLOYEE_FILE_HEADERS.forEach((header, index) => record[header] = row[index] == null ? '' : row[index]);
    record.dateHired = formatEmployeeDate(record.dateHired);
    record.directLink = getRichTextUrl(richValues[rowIndex + 1][EMPLOYEE_FILE_HEADERS.indexOf('directLink')]) || record.directLink || makeDriveLink(record.driveFileId);
    delete record.driveFileId;
    return record;
  });
}

function shouldSyncEmployeeFiles() {
  const sheet = getEmployeeFilesSheet();
  if (sheet.getLastRow() <= 1) return true;

  const lastSync = Number(PropertiesService.getScriptProperties().getProperty('201_FILES_LAST_SYNC') || '0');
  const now = Date.now();
  return now - lastSync > 60 * 60 * 1000;
}

function syncEmployeeFiles() {
  const sheet = getEmployeeFilesSheet();
  const existingIds = new Set();
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 8, sheet.getLastRow() - 1, 1).getValues()
      .forEach(row => {
        const fileId = String(row[0] || '').trim();
        if (fileId) existingIds.add(fileId);
      });
  }

  const folder = getEmployeeFilesFolder();
  const files = folder.getFiles();
  const newRows = [];
  while (files.hasNext()) {
    const file = files.next();
    if (existingIds.has(file.getId())) continue;
    newRows.push([file.getId(), file.getName(), '', '', '', '', file.getUrl(), file.getId()]);
  }

  if (newRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, EMPLOYEE_FILE_HEADERS.length)
      .setValues(newRows);
    newRows.forEach((row, index) => {
      const sheetRow = sheet.getLastRow() - newRows.length + index + 1;
      setNamedLink(sheet, sheetRow, EMPLOYEE_FILE_HEADERS.indexOf('directLink') + 1, row[6], '201_LINK_' + (sheetRow - 1));
    });
  }

  PropertiesService.getScriptProperties().setProperty('201_FILES_LAST_SYNC', String(Date.now()));
  applySheetDefaults(sheet, EMPLOYEE_FILE_HEADERS.length);
}

function getEmployeeFilesSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(CONFIG.employeeFilesSheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.employeeFilesSheetName);
  if (sheet.getLastRow() === 0) sheet.appendRow(EMPLOYEE_FILE_HEADERS);
  sheet.getRange(1, 1, 1, EMPLOYEE_FILE_HEADERS.length)
    .setFontWeight('bold')
    .setFontColor('#1f2933')
    .setBackground('#d9ead3')
    .setHorizontalAlignment('center');
  applySheetDefaults(sheet, EMPLOYEE_FILE_HEADERS.length);
  normalizeNamedLinks(sheet, EMPLOYEE_FILE_HEADERS.indexOf('directLink') + 1, '201_LINK_');
  return sheet;
}

function formatEmployeeDate(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).trim().slice(0, 10);
}

function makeDriveLink(fileId) {
  if (!fileId) return '';
  try {
    const file = DriveApp.getFileById(String(fileId).trim());
    const folder = getEmployeeFilesFolder();
    const parents = file.getParents();
    while (parents.hasNext()) {
      if (parents.next().getId() === folder.getId()) return file.getUrl();
    }
    return '';
  } catch (error) {
    return '';
  }
}

function getEmployeeFilesFolder() {
  if (CONFIG.employeeFilesDriveFolderId) {
    return DriveApp.getFolderById(CONFIG.employeeFilesDriveFolderId);
  }
  throw new Error('The 201 Files Drive folder is not configured');
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
    const savedRow = existingRow || sheet.getLastRow();
    if (record.fileUrl) {
      setNamedLink(sheet, savedRow, HEADERS.indexOf('fileUrl') + 1, record.fileUrl, 'MRF_LINK_' + (savedRow - 1));
    }
    applySheetDefaults(sheet, HEADERS.length);
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

function applySheetDefaults(sheet, columnCount) {
  sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 1), columnCount)
    .setFontFamily(SHEET_FONT_FAMILY)
    .setFontSize(SHEET_FONT_SIZE);
}

function applyWorkbookDefaults() {
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(sheet => {
    const range = sheet.getDataRange();
    range.setFontFamily(SHEET_FONT_FAMILY).setFontSize(SHEET_FONT_SIZE);
  });
}

function normalizeNamedLinks(sheet, column, prefix) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const range = sheet.getRange(2, column, lastRow - 1, 1);
  const values = range.getValues();
  const richValues = range.getRichTextValues();
  values.forEach((row, index) => {
    const url = getRichTextUrl(richValues[index][0]) || String(row[0] || '').trim();
    if (/^https?:\/\//i.test(url)) {
      setNamedLink(sheet, index + 2, column, url, prefix + (index + 1));
    }
  });
}

function setNamedLink(sheet, row, column, url, label) {
  const richText = SpreadsheetApp.newRichTextValue()
    .setText(label)
    .setLinkUrl(url)
    .build();
  sheet.getRange(row, column).setRichTextValue(richText);
}

function getRichTextUrl(richText) {
  return richText && richText.getLinkUrl ? richText.getLinkUrl() : '';
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}