function requireApiUrl() {
  const configuredUrl = window.HR_PORTAL_SHEETS?.getApiUrl?.() || window.HR_PORTAL_API_URL || '';

  if (!configuredUrl || !/^https?:\/\//i.test(configuredUrl)) {
    throw new Error('Set a valid Google Apps Script URL in the shared Sheets config.');
  }

  return configuredUrl;
}

async function request(options = {}) {
  return window.HR_PORTAL_SHEETS.request({
    ...options,
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
      ...(options.headers || {})
    }
  });
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