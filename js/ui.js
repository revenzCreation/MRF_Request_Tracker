import { saveRecord, deleteRecord } from './storage.js';
import { toast, escapeHtml, statusClass } from './utils.js';

export const STATUSES = ['Pending', 'In Review', 'Approved', 'Rejected', 'Fulfilled'];
export const STATUS_COLORS = {
  Pending: '#a97423',
  'In Review': '#2c4a6e',
  Approved: '#3d6b4f',
  Rejected: '#a3382c',
  Fulfilled: '#5c4a72'
};
export let records = [];
let currentModalId = null;

export function setRecords(newRecords) {
  records = Array.isArray(newRecords) ? newRecords : [];
}

function ensureDomTargets() {
  return {
    statRow: document.getElementById('statRow'),
    stackBar: document.getElementById('stackBar'),
    legend: document.getElementById('legend'),
    activityList: document.getElementById('activityList'),
    deptBars: document.getElementById('deptBars'),
    searchInput: document.getElementById('searchInput'),
    statusFilter: document.getElementById('statusFilter'),
    sortSelect: document.getElementById('sortSelect'),
    tableBody: document.getElementById('tableBody'),
    emptyState: document.getElementById('emptyState'),
    modalTitle: document.getElementById('modalTitle'),
    modalImg: document.getElementById('modalImg'),
    modalDetails: document.getElementById('modalDetails'),
    modalStatus: document.getElementById('modalStatus'),
    modalRemarks: document.getElementById('modalRemarks'),
    modalBg: document.getElementById('modalBg'),
    saveModalBtn: document.getElementById('saveModalBtn')
  };
}

export function renderDashboard() {
  const total = records.length;
  const totalHeadcount = records.reduce((sum, record) => sum + Number(record.headcount || 0), 0);
  const approved = records.filter(record => record.status === 'Approved').length;
  const pending = records.filter(record => record.status === 'Pending' || record.status === 'In Review').length;
  const elements = ensureDomTargets();

  if (elements.statRow) {
    elements.statRow.innerHTML = `
      <div class="stat-card navy"><div class="num">${total}</div><div class="label">Total MRFs Logged</div></div>
      <div class="stat-card amber"><div class="num">${totalHeadcount}</div><div class="label">Total Headcount Requested</div></div>
      <div class="stat-card green"><div class="num">${approved}</div><div class="label">Approved</div></div>
      <div class="stat-card red"><div class="num">${pending}</div><div class="label">Awaiting Action</div></div>
    `;
  }

  const counts = {};
  STATUSES.forEach(status => {
    counts[status] = records.filter(record => record.status === status).length;
  });

  if (elements.stackBar) {
    elements.stackBar.innerHTML = '';
  }
  if (elements.legend) {
    elements.legend.innerHTML = '';
  }

  if (total === 0) {
    if (elements.stackBar) {
      elements.stackBar.innerHTML = '<div style="width:100%;background:var(--paper-dark);"></div>';
    }
  } else {
    STATUSES.forEach(status => {
      if (counts[status] > 0 && elements.stackBar) {
        const pct = ((counts[status] / total) * 100).toFixed(1);
        const segment = document.createElement('div');
        segment.style.width = pct + '%';
        segment.style.background = STATUS_COLORS[status] || '#5f6f86';
        elements.stackBar.appendChild(segment);
      }
    });
  }

  STATUSES.forEach(status => {
    if (elements.legend) {
      elements.legend.innerHTML += `<div class="item"><span class="swatch" style="background:${STATUS_COLORS[status] || '#5f6f86'}"></span>${status} (${counts[status]})</div>`;
    }
  });

  const recent = [...records].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(0, 6);
  if (elements.activityList) {
    elements.activityList.innerHTML = recent.length ? recent.map(record => `
      <li>
        <span>${escapeHtml(record.position || 'Untitled')} <span class="who">— ${escapeHtml(record.department || 'Unassigned')}</span></span>
        <span class="stamp ${statusClass(record.status)}" style="transform:none;padding:2px 7px;font-size:10px;">${escapeHtml(record.status || 'Pending')}</span>
      </li>
    `).join('') : '<li><span class="who">No activity yet</span></li>';
  }

  const deptMap = {};
  records.forEach(record => {
    const department = record.department || 'Unassigned';
    deptMap[department] = (deptMap[department] || 0) + Number(record.headcount || 0);
  });
  const deptEntries = Object.entries(deptMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxVal = Math.max(1, ...deptEntries.map(([, value]) => value));

  if (elements.deptBars) {
    elements.deptBars.innerHTML = deptEntries.length ? deptEntries.map(([name, value]) => `
      <div class="dept-row">
        <div class="name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
        <div class="track"><div class="fill" style="width:${(value / maxVal) * 100}%"></div></div>
        <div class="count">${value}</div>
      </div>
    `).join('') : '<div style="color:var(--ink-soft);font-size:13px;">No department data yet.</div>';
  }
}

function filteredSorted() {
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const sortSelect = document.getElementById('sortSelect');

  const q = (searchInput?.value || '').toLowerCase();
  const statusF = statusFilter?.value || '';
  const sort = sortSelect?.value || 'new';

  let list = records.filter(record => {
    const searchable = [record.department, record.position, record.mrfNumber].filter(Boolean).join(' ').toLowerCase();
    const matchQ = !q || searchable.includes(q);
    const matchS = !statusF || record.status === statusF;
    return matchQ && matchS;
  });

  if (sort === 'new') list.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  if (sort === 'old') list.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  if (sort === 'needed') list.sort((a, b) => (a.dateNeeded || '9999').localeCompare(b.dateNeeded || '9999'));
  if (sort === 'headcount') list.sort((a, b) => Number(b.headcount || 0) - Number(a.headcount || 0));

  return list;
}

export function renderTable() {
  const elements = ensureDomTargets();
  const list = filteredSorted();

  if (elements.tableBody) {
    elements.tableBody.innerHTML = '';
  }
  if (elements.emptyState) {
    elements.emptyState.style.display = list.length ? 'none' : 'block';
  }

  list.forEach(record => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Copy">${record.fileUrl ? `<a href="${escapeHtml(record.fileUrl)}" target="_blank" rel="noopener" title="Open uploaded file"><div class="thumb empty">open file</div></a>` : '<div class="thumb empty">no file</div>'}</td>
      <td data-label="MRF #" class="mono">${escapeHtml(record.mrfNumber || '—')}</td>
      <td data-label="Department">${escapeHtml(record.department || '—')}</td>
      <td data-label="Position">${escapeHtml(record.position || '—')}</td>
      <td data-label="Headcount"><strong>${Number(record.headcount || 0)}</strong></td>
      <td data-label="Date Needed">${escapeHtml(record.dateNeeded || '—')}</td>
      <td data-label="Status"><span class="stamp ${statusClass(record.status)}">${escapeHtml(record.status || 'Pending')}</span></td>
      <td data-label=""><button class="btn ghost small" data-open="${escapeHtml(record.id || '')}">Open</button></td>
    `;
    elements.tableBody?.appendChild(tr);
  });

  elements.tableBody?.querySelectorAll('[data-open]').forEach(button => {
    button.addEventListener('click', () => openModal(button.dataset.open));
  });
}

export function openModal(id) {
  const record = records.find(item => item.id === id);
  if (!record) return;
  currentModalId = id;
  const elements = ensureDomTargets();

  if (elements.modalTitle) {
    elements.modalTitle.textContent = record.mrfNumber || 'Request Detail';
  }

  if (elements.modalImg) {
    if (record.fileUrl && (record.fileName || '').match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      elements.modalImg.src = record.fileUrl;
      elements.modalImg.style.display = 'block';
    } else {
      elements.modalImg.style.display = 'none';
      elements.modalImg.src = '';
    }
  }

  if (elements.modalDetails) {
    elements.modalDetails.innerHTML = `
      <div><div class="k">Department</div><div class="v">${escapeHtml(record.department || '—')}</div></div>
      <div><div class="k">Position</div><div class="v">${escapeHtml(record.position || '—')}</div></div>
      <div><div class="k">Headcount</div><div class="v">${Number(record.headcount || 0)}</div></div>
      <div><div class="k">Requested By</div><div class="v">${escapeHtml(record.requestedBy || '—')}</div></div>
      <div><div class="k">Date Requested</div><div class="v">${escapeHtml(record.dateRequested || '—')}</div></div>
      <div><div class="k">Date Needed</div><div class="v">${escapeHtml(record.dateNeeded || '—')}</div></div>
      <div><div class="k">Uploaded File</div><div class="v">${record.fileUrl ? `<a href="${escapeHtml(record.fileUrl)}" target="_blank" rel="noopener">${escapeHtml(record.fileName || 'Open in Drive')}</a>` : '—'}</div></div>
    `;
  }

  if (elements.modalStatus) {
    elements.modalStatus.innerHTML = STATUSES.map(status => `<option ${status === record.status ? 'selected' : ''}>${status}</option>`).join('');
  }

  if (elements.modalRemarks) {
    elements.modalRemarks.value = record.remarks || '';
  }

  if (elements.modalBg) {
    elements.modalBg.classList.add('active');
  }
}

export function closeModal() {
  const elements = ensureDomTargets();
  if (elements.modalBg) {
    elements.modalBg.classList.remove('active');
  }
}

export async function saveModalChanges() {
  const record = records.find(item => item.id === currentModalId);
  if (!record) return;
  const elements = ensureDomTargets();
  if (elements.saveModalBtn) elements.saveModalBtn.disabled = true;

  try {
    record.status = document.getElementById('modalStatus')?.value || record.status;
    record.remarks = document.getElementById('modalRemarks')?.value.trim() || '';
    record.updatedAt = Date.now();
    const savedRecord = await saveRecord(record);
    setRecords(records.map(item => item.id === savedRecord.id ? savedRecord : item));
    closeModal();
    renderTable();
    renderDashboard();
    toast('Updated');
  } catch (err) {
    toast(err.message || 'Update failed — try again');
  } finally {
    if (elements.saveModalBtn) elements.saveModalBtn.disabled = false;
  }
}

export async function deleteCurrentModalRecord() {
  if (!currentModalId) return;
  if (!confirm('Delete this request? This cannot be undone.')) return;
  try {
    await deleteRecord(currentModalId);
    setRecords(records.filter(item => item.id !== currentModalId));
    closeModal();
    renderTable();
    renderDashboard();
    toast('Deleted');
  } catch (err) {
    toast(err.message || 'Delete failed — try again');
  }
}