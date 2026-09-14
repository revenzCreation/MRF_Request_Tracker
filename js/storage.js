import { API_URL } from './config.js';

function requireApiUrl() {
  if (!API_URL || !/^https?:\/\//i.test(API_URL)) {
    throw new Error('Set a valid Google Apps Script URL in js/config.js');
  }
  return API_URL;
}

async function request(options = {}) {
  const response = await fetch(requireApiUrl(), {
    ...options,
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
      ...(options.headers || {})
    }
  });

  const rawText = await response.text();
  let result;

  try {
    result = rawText ? JSON.parse(rawText) : {};
  } catch (error) {
    throw new Error(`Invalid API response from Google Apps Script (${response.status}).`);
  }

  if (!response.ok || !result || result.ok === false) {
    throw new Error(result && result.error ? result.error : 'Google Sheets request failed');
  }

  return result;
}

export async function loadAllRecords() {
  const result = await request({ method: 'GET' });
  return result.records || [];
}

export async function saveRecord(rec) {
  const result = await request({
    method: 'POST',
    body: JSON.stringify({ action: 'save', record: rec })
  });
  return result.record;
}

export async function deleteRecord(id) {
  await request({
    method: 'POST',
    body: JSON.stringify({ action: 'delete', id })
  });
}