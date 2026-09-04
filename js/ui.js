import { saveRecord, deleteRecord } from './storage.js';
import { toast, escapeHtml, statusClass } from './utils.js';

export const STATUSES = ["Pending", "In Review", "Approved", "Rejected", "Fulfilled"];
export const STATUS_COLORS = {
  "Pending": "#a97423", "In Review": "#2c4a6e", "Approved": "#3d6b4f", "Rejected": "#a3382c", "Fulfilled": "#5c4a72"
};
export let records = [];
let currentModalId = null;

export function setRecords(newRecords) {
  records = newRecords;
}

export function renderDashboard() {
  const total = records.length;
  const totalHeadcount = records.reduce((s, r) => s + r.headcount, 0);
  const approved = records.filter(r => r.status === 'Approved').length;
  const pending = records.filter(r => r.status === 'Pending' || r.status === 'In Review').length;

  document.getElementById('statRow').innerHTML = `
    <div class="stat-card navy"><div class="num">${total}</div><div class="label">Total MRFs Logged</div></div>
    <div class="stat-card amber"><div class="num">${totalHeadcount}</div><div class="label">Total Headcount Requested</div></div>
    <div class="stat-card green"><div class="num">${approved}</div><div class="label">Approved</div></div>
    <div class="stat-card red"><div class="num">${pending}</div><div class="label">Awaiting Action</div></div>
  `;

  const counts = {};
  STATUSES.forEach(s => counts[s] = records.filter(r => r.status === s).length);
  const stack = document.getElementById('stackBar');
  const legend = document.getElementById('legend');
  stack.innerHTML = '';
  legend.innerHTML = '';
  
  if (total === 0) {
    stack.innerHTML = `<div style="width:100%;background:var(--paper-dark);"></div>`;
  } else {
    STATUSES.forEach(s => {
      if (counts[s] > 0) {
        const pct = (counts[s] / total * 100).toFixed(1);
        const seg = document.createElement('div');
        seg.style.width = pct + '%';
        seg.style.background = STATUS_COLORS[s];
        stack.appendChild(seg);
      }
    });
  }
  STATUSES.forEach(s => {
    legend.innerHTML += `<div class="item"><span class="swatch" style="background:${STATUS_COLORS[s]}"></span>${s} (${counts[s]})</div>`;
  });

  const activityList = document.getElementById('activityList');
  const recent = [...records].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  activityList.innerHTML = recent.length ? recent.map(r => `
    <li>
      <span>${escapeHtml(r.position)} <span class="who">— ${escapeHtml(r.department)}</span></span>
      <span class="stamp ${statusClass(r.status)}" style="transform:none;padding:2px 7px;font-size:10px;">${r.status}</span>
    </li>
  `).join('') : `<li><span class="who">No activity yet</span></li>`;

  const deptMap = {};
  records.forEach(r => { deptMap[r.department] = (deptMap[r.department] || 0) + r.headcount; });
  const deptEntries = Object.entries(deptMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxVal = Math.max(1, ...deptEntries.map(e => e[1]));
  const deptBars = document.getElementById('deptBars');
  deptBars.innerHTML = deptEntries.length ? deptEntries.map(([name, val]) => `
    <div class="dept-row">
      <div class="name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
      <div class="track"><div class="fill" style="width:${(val / maxVal * 100)}%"></div></div>
      <div class="count">${val}</div>
    </div>
  `).join('') : `<div style="color:var(--ink-soft);font-size:13px;">No department data yet.</div>`;
}

function filteredSorted() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const statusF = document.getElementById('statusFilter').value;
  const sort = document.getElementById('sortSelect').value;
  let list = records.filter(r => {
    const matchQ = !q || (r.department + ' ' + r.position + ' ' + (r.mrfNumber || '')).toLowerCase().includes(q);
    const matchS = !statusF || r.status === statusF;
    return matchQ && matchS;
  });
  if (sort === 'new') list.sort((a, b) => b.createdAt - a.createdAt);
  if (sort === 'old') list.sort((a, b) => a.createdAt - b.createdAt);
  if (sort === 'needed') list.sort((a, b) => (a.dateNeeded || '9999').localeCompare(b.dateNeeded || '9999'));
  if (sort === 'headcount') list.sort((a, b) => b.headcount - a.headcount);
  return list;
}

export function renderTable() {
  const body = document.getElementById('tableBody');
  const list = filteredSorted();
  body.innerHTML = '';
  document.getElementById('emptyState').style.display = list.length ? 'none' : 'block';

  list.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Copy">${r.fileUrl ? `<a href="${escapeHtml(r.fileUrl)}" target="_blank" rel="noopener" title="Open uploaded file"><div class="thumb empty">open file</div></a>` : `<div class="thumb empty">no file</div>`}</td>
      <td data-label="MRF #" class="mono">${r.mrfNumber || '—'}</td>
      <td data-label="Department">${escapeHtml(r.department)}</td>
      <td data-label="Position">${escapeHtml(r.position)}</td>
      <td data-label="Headcount"><strong>${r.headcount}</strong></td>
      <td data-label="Date Needed">${r.dateNeeded || '—'}</td>
      <td data-label="Status"><span class="stamp ${statusClass(r.status)}">${r.status}</span></td>
      <td data-label=""><button class="btn ghost small" data-open="${r.id}">Open</button></td>
    `;
    body.appendChild(tr);
  });

  body.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.open)));
  body.querySelectorAll('img.thumb').forEach(img => img.addEventListener('click', () => openModal(img.dataset.id)));
}

export function openModal(id) {
  const r = records.find(x => x.id === id);
  if (!r) return;
  currentModalId = id;
  document.getElementById('modalTitle').textContent = r.mrfNumber || 'Request Detail';
  const img = document.getElementById('modalImg');
  if (r.fileUrl && (r.fileName || '').match(/\.(jpg|jpeg|png|gif|webp)$/i)) { img.src = r.fileUrl; img.style.display = 'block'; } else { img.style.display = 'none'; }
  document.getElementById('modalDetails').innerHTML = `
    <div><div class="k">Department</div><div class="v">${escapeHtml(r.department)}</div></div>
    <div><div class="k">Position</div><div class="v">${escapeHtml(r.position)}</div></div>
    <div><div class="k">Headcount</div><div class="v">${r.headcount}</div></div>
    <div><div class="k">Requested By</div><div class="v">${escapeHtml(r.requestedBy) || '—'}</div></div>
    <div><div class="k">Date Requested</div><div class="v">${r.dateRequested || '—'}</div></div>
    <div><div class="k">Date Needed</div><div class="v">${r.dateNeeded || '—'}</div></div>
    <div><div class="k">Uploaded File</div><div class="v">${r.fileUrl ? `<a href="${escapeHtml(r.fileUrl)}" target="_blank" rel="noopener">${escapeHtml(r.fileName || 'Open in Drive')}</a>` : '—'}</div></div>
  `;
  const sel = document.getElementById('modalStatus');
  sel.innerHTML = STATUSES.map(s => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('');
  document.getElementById('modalRemarks').value = r.remarks || '';
  document.getElementById('modalBg').classList.add('active');
}

export function closeModal() {
  document.getElementById('modalBg').classList.remove('active');
}

export async function saveModalChanges() {
  const r = records.find(x => x.id === currentModalId);
  if (!r) return;
  const button = document.getElementById('saveModalBtn');
  button.disabled = true;
  try {
    r.status = document.getElementById('modalStatus').value;
    r.remarks = document.getElementById('modalRemarks').value.trim();
    r.updatedAt = Date.now();
    const savedRecord = await saveRecord(r);
    setRecords(records.map(record => record.id === savedRecord.id ? savedRecord : record));
    closeModal();
    renderTable();
    renderDashboard();
    toast('Updated');
  } catch (err) {
    toast(err.message || 'Update failed — try again');
  } finally {
    button.disabled = false;
  }
}

export async function deleteCurrentModalRecord() {
  if (!currentModalId) return;
  if (!confirm('Delete this request? This cannot be undone.')) return;
  try {
    await deleteRecord(currentModalId);
    setRecords(records.filter(x => x.id !== currentModalId));
    closeModal();
    renderTable();
    renderDashboard();
    toast('Deleted');
  } catch (err) {
    toast(err.message || 'Delete failed — try again');
  }
}