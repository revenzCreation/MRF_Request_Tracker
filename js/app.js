import { loadAllRecords, saveRecord } from './storage.js';
import { toast, compressImage } from './utils.js';
import { records, setRecords, renderDashboard, renderTable, openModal, closeModal, saveModalChanges, deleteCurrentModalRecord } from './ui.js';

let pendingFile = null;

const form = document.getElementById('mrfForm');
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const previewImg = document.getElementById('previewImg');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');

if (form) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const deptInput = document.getElementById('f_dept');
    const positionInput = document.getElementById('f_position');
    const dept = deptInput ? deptInput.value.trim() : '';
    const position = positionInput ? positionInput.value.trim() : '';
    if (!dept || !position) {
      toast('Department and position are required');
      return;
    }

    const rec = {
      id: 'r' + Date.now() + Math.random().toString(36).slice(2, 7),
      mrfNumber: document.getElementById('f_mrfnum')?.value.trim() || '',
      department: dept,
      position,
      headcount: parseInt(document.getElementById('f_count')?.value, 10) || 1,
      dateRequested: document.getElementById('f_daterequested')?.value || '',
      dateNeeded: document.getElementById('f_dateneeded')?.value || '',
      requestedBy: document.getElementById('f_requestedby')?.value.trim() || '',
      status: document.getElementById('f_status')?.value || 'Pending',
      remarks: document.getElementById('f_remarks')?.value.trim() || '',
      fileName: pendingFile?.name || '',
      fileMimeType: pendingFile?.mimeType || '',
      fileData: pendingFile?.dataUrl || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      const savedRecord = await saveRecord(rec);
      const updated = [...records];
      updated.unshift(savedRecord);
      setRecords(updated);
      toast('Request logged');
      resetForm();
      const requestsTab = document.querySelector('nav.tabs button[data-tab="requests"]');
      if (requestsTab) requestsTab.click();
    } catch (err) {
      toast(err.message || 'Save failed — try again');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Request';
      }
    }
  });
}

document.querySelectorAll('nav.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    const targetView = document.getElementById('view-' + btn.dataset.tab);
    if (targetView) targetView.classList.add('active');
    if (btn.dataset.tab === 'dashboard') renderDashboard();
    if (btn.dataset.tab === 'requests') renderTable();
  });
});

if (uploadBox) {
  uploadBox.addEventListener('click', () => {
    if (fileInput) fileInput.click();
  });
  uploadBox.addEventListener('dragover', e => {
    e.preventDefault();
    uploadBox.classList.add('drag');
  });
  uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('drag'));
  uploadBox.addEventListener('drop', async e => {
    e.preventDefault();
    uploadBox.classList.remove('drag');
    const file = e.dataTransfer?.files?.[0];
    if (file) await handleFile(file);
  });
}

if (fileInput) {
  fileInput.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
  });
}

async function handleFile(file) {
  const maxFileSize = 5 * 1024 * 1024;
  if (!file || file.size > maxFileSize) {
    toast('File must be 5 MB or smaller');
    if (fileInput) fileInput.value = '';
    return;
  }

  try {
    if (file.type.startsWith('image/')) {
      const dataUrl = await compressImage(file);
      pendingFile = { dataUrl, name: file.name, mimeType: 'image/jpeg' };
      if (previewImg) {
        previewImg.src = dataUrl;
        previewImg.style.display = 'block';
      }
      if (uploadPlaceholder) uploadPlaceholder.style.display = 'none';
    } else {
      pendingFile = {
        dataUrl: await readFileData(file),
        name: file.name,
        mimeType: file.type || 'application/octet-stream'
      };
      if (previewImg) previewImg.style.display = 'none';
      if (uploadPlaceholder) {
        uploadPlaceholder.innerHTML = `<div class="icon">&#128196;</div><div><strong>${file.name}</strong></div><div class="hint">File attached successfully</div>`;
        uploadPlaceholder.style.display = 'block';
      }
    }
  } catch (error) {
    toast('Could not read that file');
  }
}

function readFileData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resetForm() {
  if (form) form.reset();
  const countInput = document.getElementById('f_count');
  if (countInput) countInput.value = 1;
  pendingFile = null;
  if (previewImg) {
    previewImg.style.display = 'none';
    previewImg.src = '';
  }
  if (uploadPlaceholder) {
    uploadPlaceholder.style.display = 'block';
    uploadPlaceholder.innerHTML = '<div class="icon">&#128196;</div><div><strong>Click to upload</strong> or drag the request file here</div><div class="hint">Any file type, maximum file size 5 MB. Images are compressed automatically before saving.</div>';
  }
}

const resetFormBtn = document.getElementById('resetFormBtn');
if (resetFormBtn) resetFormBtn.addEventListener('click', resetForm);

['searchInput', 'statusFilter', 'sortSelect'].forEach(id => {
  const element = document.getElementById(id);
  if (!element) return;
  element.addEventListener('input', renderTable);
  element.addEventListener('change', renderTable);
});

const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
  refreshBtn.addEventListener('click', async () => {
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
}

const modalClose = document.getElementById('modalClose');
const modalBg = document.getElementById('modalBg');
const saveModalBtn = document.getElementById('saveModalBtn');
const deleteBtn = document.getElementById('deleteBtn');

if (modalClose) modalClose.addEventListener('click', closeModal);
if (modalBg) {
  modalBg.addEventListener('click', e => {
    if (e.target.id === 'modalBg') closeModal();
  });
}
if (saveModalBtn) saveModalBtn.addEventListener('click', saveModalChanges);
if (deleteBtn) deleteBtn.addEventListener('click', deleteCurrentModalRecord);

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