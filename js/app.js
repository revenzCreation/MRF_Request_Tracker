import { loadAllRecords, saveRecord } from './storage.js';
import { toast, compressImage } from './utils.js';
import { records, setRecords, renderDashboard, renderTable, openModal, closeModal, saveModalChanges, deleteCurrentModalRecord } from './ui.js';

let pendingFile = null;

document.querySelectorAll('nav.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'dashboard') renderDashboard();
    if (btn.dataset.tab === 'requests') renderTable();
  });
});

const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const previewImg = document.getElementById('previewImg');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');

uploadBox.addEventListener('click', () => fileInput.click());
uploadBox.addEventListener('dragover', e => { e.preventDefault(); uploadBox.classList.add('drag'); });
uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('drag'));
uploadBox.addEventListener('drop', async e => {
  e.preventDefault(); uploadBox.classList.remove('drag');
  if (e.dataTransfer.files[0]) await handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', async e => {
  if (e.target.files[0]) await handleFile(e.target.files[0]);
});

async function handleFile(file) {
  const maxFileSize = 5 * 1024 * 1024;
  if (file.size > maxFileSize) {
    toast('File must be 5 MB or smaller');
    fileInput.value = '';
    return;
  }

  try {
    if (file.type.startsWith('image/')) {
      const dataUrl = await compressImage(file);
      pendingFile = { dataUrl, name: file.name, mimeType: 'image/jpeg' };
      previewImg.src = dataUrl;
      previewImg.style.display = 'block';
      uploadPlaceholder.style.display = 'none';
    } else {
      pendingFile = { dataUrl: await readFileData(file), name: file.name, mimeType: file.type || 'application/octet-stream' };
      previewImg.style.display = 'none';
      uploadPlaceholder.innerHTML = `<div class="icon">&#128196;</div><div><strong>${file.name}</strong></div><div class="hint">File attached successfully</div>`;
    }
  } catch (e) { toast('Could not read that file'); }
}

function readFileData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

document.getElementById('mrfForm').addEventListener('submit', async e => {
  e.preventDefault();
  const dept = document.getElementById('f_dept').value.trim();
  const position = document.getElementById('f_position').value.trim();
  if (!dept || !position) { toast('Department and position are required'); return; }

  const rec = {
    id: 'r' + Date.now() + Math.random().toString(36).slice(2, 7),
    mrfNumber: document.getElementById('f_mrfnum').value.trim(),
    department: dept,
    position: position,
    headcount: parseInt(document.getElementById('f_count').value) || 1,
    dateRequested: document.getElementById('f_daterequested').value,
    dateNeeded: document.getElementById('f_dateneeded').value,
    requestedBy: document.getElementById('f_requestedby').value.trim(),
    status: document.getElementById('f_status').value,
    remarks: document.getElementById('f_remarks').value.trim(),
    fileName: pendingFile?.name || '',
    fileMimeType: pendingFile?.mimeType || '',
    fileData: pendingFile?.dataUrl || '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const savedRecord = await saveRecord(rec);
    const updated = [...records];
    updated.unshift(savedRecord);
    setRecords(updated);
    toast('Request logged');
    resetForm();
    document.querySelector('nav.tabs button[data-tab="requests"]').click();
  } catch (err) {
    toast('Save failed — try again');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Request';
  }
});

function resetForm() {
  document.getElementById('mrfForm').reset();
  document.getElementById('f_count').value = 1;
  pendingFile = null;
  previewImg.style.display = 'none';
  previewImg.src = '';
  uploadPlaceholder.style.display = 'block';
  uploadPlaceholder.innerHTML = '<div class="icon">&#128196;</div><div><strong>Click to upload</strong> or drag the request file here</div><div class="hint">Any file type, maximum file size 5 MB. Images are compressed automatically before saving.</div>';
}
document.getElementById('resetFormBtn').addEventListener('click', resetForm);

['searchInput', 'statusFilter', 'sortSelect'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderTable);
  document.getElementById(id).addEventListener('change', renderTable);
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
  try {
    const loaded = await loadAllRecords();
    setRecords(loaded);
    renderTable();
    renderDashboard();
    toast('Refreshed');
  } catch (err) {
    toast(err.message || 'Could not refresh records');
  }
});

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalBg').addEventListener('click', e => { if (e.target.id === 'modalBg') closeModal(); });
document.getElementById('saveModalBtn').addEventListener('click', saveModalChanges);
document.getElementById('deleteBtn').addEventListener('click', deleteCurrentModalRecord);

(async function init() {
  try {
    const loaded = await loadAllRecords();
    setRecords(loaded);
  } catch (err) {
    toast(err.message || 'Could not load records');
  }
  renderDashboard();
  renderTable();
})();