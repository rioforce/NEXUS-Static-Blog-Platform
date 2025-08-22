// ---------------------- References ----------------------
const postForm = document.getElementById('postForm');
const titleInput = document.getElementById('title');
const youtubeLinkInput = document.getElementById('youtubeLink');
const featuredImageFileInput = document.getElementById('featuredImageFile');
const featuredImageURLInput = document.getElementById('featuredImageURL');
const dateInput = document.getElementById('date');
const profileInput = document.getElementById('profile');
const markdownContent = document.getElementById('markdownContent');
const preview = document.getElementById('preview');
const clearImageBtn = document.getElementById('clearImage');
const mdImageFileInput = document.getElementById('mdImageFile');
const mdImageURLInput = document.getElementById('mdImageURL');
const insertImageMarkdownBtn = document.getElementById('insertImageMarkdown');
const clearAllBtn = document.getElementById('clearAll');
const inlineImageList = document.getElementById('inlineImageList');

// ---------------------- State ----------------------
let featuredImageDataUrl = null;
let featuredImageBlob = null;
let extraImages = [];
let extraImageURLs = new Map();
let debounceTimer = null;

// ---------------------- Utilities ----------------------
function sanitizeFilename(name) {
  return name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-.]/g, '').toLowerCase();
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------- LocalStorage Cache ----------------------
function saveFormCache() {
  const formCache = {
    title: titleInput.value,
    youtubeLink: youtubeLinkInput.value,
    featuredImageURL: featuredImageURLInput.value,
    date: dateInput.value,
    profile: profileInput.value,
    markdownContent: markdownContent.value
  };
  localStorage.setItem('markdownEditorCache', JSON.stringify(formCache));
}

function restoreFormCache() {
  const saved = localStorage.getItem('markdownEditorCache');
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  if (!saved) {
    dateInput.value = today;
    return;
  }
  const data = JSON.parse(saved);
  titleInput.value = data.title || '';
  youtubeLinkInput.value = data.youtubeLink || '';
  featuredImageURLInput.value = data.featuredImageURL || '';
  dateInput.value = data.date || today;
  profileInput.value = data.profile || '';
  markdownContent.value = data.markdownContent || '';
}

// ---------------------- Featured Image ----------------------
const featuredWarning = document.getElementById('featuredWarning');
featuredImageFileInput.addEventListener('change', () => {
  const file = featuredImageFileInput.files[0];
  if (!file) return;

 const MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5 MB

  const sanitizedName = sanitizeFilename(file.name);
  const reader = new FileReader();

  reader.onload = e => {
    featuredImageDataUrl = e.target.result;
    featuredImageBlob = new File([file], sanitizedName, { type: file.type });

    if (file.size <= MAX_CACHE_SIZE) {
      localStorage.setItem('featuredImageData', e.target.result);
      localStorage.setItem('featuredImageName', sanitizedName);
      featuredWarning.innerText = ''; // clear warning
    } else {
      // Skip caching and show warning
      localStorage.removeItem('featuredImageData');
      localStorage.removeItem('featuredImageName');
      featuredWarning.innerText = '⚠️ This image is too large to cache and will not persist on refresh.';
      featuredWarning.style.color = 'red';
    }

    updatePreview();
    saveFormCache();
  };

  reader.readAsDataURL(file);
});


featuredImageURLInput.addEventListener('input', async () => {
  const url = featuredImageURLInput.value.trim();
  if (!url) return;

  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5 MB

    const originalName = url.split('/').pop().split('?')[0] || 'featuredimage.jpg';
    const sanitizedName = sanitizeFilename(originalName);
    featuredImageBlob = new File([blob], sanitizedName, { type: blob.type });
    featuredImageDataUrl = URL.createObjectURL(featuredImageBlob);

    if (blob.size <= MAX_CACHE_SIZE) {
      // Safe to cache
      const reader = new FileReader();
      reader.onload = e => {
        localStorage.setItem('featuredImageData', e.target.result);
        localStorage.setItem('featuredImageName', sanitizedName);
        featuredWarning.innerText = ''; // clear any previous warning
      };
      reader.readAsDataURL(blob);
    } else {
      // Too big to cache
      localStorage.removeItem('featuredImageData');
      localStorage.removeItem('featuredImageName');
      featuredWarning.innerText = '⚠️ This image is too large to cache and will not persist on refresh.';
      featuredWarning.style.color = 'red';
    }

    updatePreview();
    saveFormCache();
  } catch (err) {
    console.error('Failed to load image from URL', err);
    featuredWarning.innerText = '⚠️ Failed to load image from URL.';
    featuredWarning.style.color = 'red';
  }
});

clearImageBtn.addEventListener('click', () => {
  featuredImageDataUrl = null;
  featuredImageBlob = null;
  featuredImageFileInput.value = '';
  featuredImageURLInput.value = '';
  localStorage.removeItem('featuredImageData');
  localStorage.removeItem('featuredImageName');
  updatePreview();
  saveFormCache();
});

// ---------------------- Markdown Preview ----------------------
function rewriteMarkdownForPreview(mdText) {
  if (!extraImages.length) return mdText;
  let rewritten = mdText;
  for (const { name, blob } of extraImages) {
    if (!extraImageURLs.has(name)) extraImageURLs.set(name, URL.createObjectURL(blob));
    const url = extraImageURLs.get(name);
    rewritten = rewritten.replace(new RegExp(`\\]\\(${escapeRegExp(name)}\\)`, 'g'), `](${url})`);
  }
  return rewritten;
}

function updatePreview() {
  const mdForPreview = rewriteMarkdownForPreview(markdownContent.value);
  const featuredHTML = featuredImageDataUrl
    ? `<div class="preview-featured"><img src="${featuredImageDataUrl}" alt="Featured Image"></div>`
    : '';
  preview.innerHTML = featuredHTML + marked.parse(mdForPreview, { gfm: true, breaks: true });
}

function debouncePreview() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(updatePreview, 250);
}

markdownContent.addEventListener('input', debouncePreview);

// ---------------------- Inline Images ----------------------
insertImageMarkdownBtn.addEventListener('click', async () => {
  const MAX_INLINE_CACHE_SIZE = 3 * 1024 * 1024; // 3 MB

  function insertAtCursor(text) {
    const start = markdownContent.selectionStart;
    const end = markdownContent.selectionEnd;
    const before = markdownContent.value.substring(0, start);
    const after = markdownContent.value.substring(end);
    markdownContent.value = before + text + after;
    markdownContent.selectionStart = markdownContent.selectionEnd = start + text.length;
    markdownContent.focus();
    debouncePreview();
    saveFormCache();
  }

  function altFrom(nameOrUrl) {
    const base = nameOrUrl.split('/').pop().split('#')[0].split('?')[0];
    return (base || 'image').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
  }

  let file, sanitizedName, blob;

  if (mdImageFileInput.files.length > 0) {
    file = mdImageFileInput.files[0];
    sanitizedName = sanitizeFilename(file.name);
    blob = file;
  } else if (mdImageURLInput.value.trim()) {
    try {
      const resp = await fetch(mdImageURLInput.value.trim());
      blob = await resp.blob();
      const originalName = mdImageURLInput.value.split('/').pop().split('?')[0] || 'image.jpg';
      sanitizedName = sanitizeFilename(originalName);
    } catch {
      alert('Failed to fetch image from URL.');
      return;
    }
  } else {
    return;
  }

  extraImages.push({ name: sanitizedName, blob });

  if (blob.size <= MAX_INLINE_CACHE_SIZE) {
    const reader = new FileReader();
    reader.onload = e => {
      localStorage.setItem(`mdImage_${sanitizedName}`, e.target.result);
      insertAtCursor(`![${altFrom(sanitizedName)}](${sanitizedName})`);
      renderInlineImages();
    };
    reader.readAsDataURL(blob);
    inlineImageWarning.innerText = '';
  } else {
    // Too big to cache
    insertAtCursor(`![${altFrom(sanitizedName)}](${sanitizedName})`);
    inlineImageWarning.innerText = '⚠️ This image is too large to cache and will not persist on refresh.';
    inlineImageWarning.style.color = 'red';
    renderInlineImages();
  }

  mdImageFileInput.value = '';
  mdImageURLInput.value = '';
});


function removeInlineImage(name) {
  const url = extraImageURLs.get(name);
  if (url) URL.revokeObjectURL(url);
  extraImageURLs.delete(name);

  extraImages = extraImages.filter(img => img.name !== name);
  localStorage.removeItem(`mdImage_${name}`);

  const regex = new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(name)}\\)`, 'g');
  markdownContent.value = markdownContent.value.replace(regex, '');

  renderInlineImages();
  updatePreview();
  saveFormCache();
}

const MAX_IMAGE_SIZE = 1024 * 1024 * 2; // 2MB example
const inlineImageWarning = document.getElementById('inlineImageWarning'); // make a div for this in your HTML

function renderInlineImages() {
  inlineImageList.innerHTML = '';
  let hasLargeImages = false;

  if (extraImages.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.style.width = '100px';
    placeholder.style.height = '100px';
    placeholder.style.border = '2px dashed #ccc';
    placeholder.style.borderRadius = '6px';
    placeholder.style.display = 'inline-block';
    placeholder.style.margin = '4px';
    placeholder.style.background = '#f9f9f9';
    inlineImageList.appendChild(placeholder);
  }

  extraImages.forEach(img => {
    const url = extraImageURLs.get(img.name) || URL.createObjectURL(img.blob);
    extraImageURLs.set(img.name, url);

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.margin = '4px';

    const imageEl = document.createElement('img');
    imageEl.src = url;
    imageEl.alt = img.name;
    imageEl.style.width = '100px';
    imageEl.style.height = '100px';
    imageEl.style.objectFit = 'cover';
    imageEl.style.border = '1px solid #ccc';
    imageEl.style.borderRadius = '6px';
    wrapper.appendChild(imageEl);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.style.position = 'absolute';
    removeBtn.style.top = '2px';
    removeBtn.style.right = '2px';
    removeBtn.style.background = 'rgba(255,0,0,0.8)';
    removeBtn.style.color = 'white';
    removeBtn.style.border = 'none';
    removeBtn.style.borderRadius = '4px';
    removeBtn.style.padding = '2px 6px';
    removeBtn.style.cursor = 'pointer';
    removeBtn.style.fontSize = '10px';
    removeBtn.addEventListener('click', () => removeInlineImage(img.name));
    wrapper.appendChild(removeBtn);

    // ⚠️ warning for large images
    if (img.blob.size > MAX_IMAGE_SIZE) {
      hasLargeImages = true;
      const warning = document.createElement('div');
      warning.textContent = '⚠️';
      warning.title = 'This image is too large';
      warning.style.position = 'absolute';
      warning.style.bottom = '2px';
      warning.style.right = '2px';
      warning.style.fontSize = '18px';
      wrapper.appendChild(warning);
    }

    inlineImageList.appendChild(wrapper);
  });

  // Persistent page-level warning
  if (hasLargeImages) {
    inlineImageWarning.style.display = 'block';
    inlineImageWarning.textContent = '⚠️ Image is too large to cache and will not persist on refresh';
    inlineImageWarning.style.color = 'red';
    inlineImageWarning.style.marginTop = '6px';
  } else {
    inlineImageWarning.style.display = 'none';
  }
}

// ---------------------- Clear All ----------------------
clearAllBtn.addEventListener('click', () => {
  if (!confirm('Are you sure? This will clear the whole form and cache.')) return;

  postForm.reset();

  featuredImageDataUrl = null;
  featuredImageBlob = null;
  localStorage.removeItem('featuredImageData');
  localStorage.removeItem('featuredImageName');

  extraImages.forEach(img => localStorage.removeItem(`mdImage_${img.name}`));
  extraImages = [];
  extraImageURLs.forEach(url => URL.revokeObjectURL(url));
  extraImageURLs.clear();

  markdownContent.value = '';
  inlineImageList.innerHTML = '';
  updatePreview();

  localStorage.removeItem('markdownEditorCache');
});

// ---------------------- Markdown Formatting Tools ----------------------

function insertAtCursor(text) {
  const start = markdownContent.selectionStart;
  const end = markdownContent.selectionEnd;
  const before = markdownContent.value.substring(0, start);
  const after = markdownContent.value.substring(end);
  markdownContent.value = before + text + after;
  markdownContent.selectionStart = markdownContent.selectionEnd = start + text.length;
  markdownContent.focus();
  debouncePreview();
  saveFormCache();
}

// Heading buttons
document.getElementById('btnH1').addEventListener('click', () => insertAtCursor('# '));
document.getElementById('btnH2').addEventListener('click', () => insertAtCursor('## '));
document.getElementById('btnH3').addEventListener('click', () => insertAtCursor('### '));

// Bold, Italic, Underline buttons
document.getElementById('btnBold').addEventListener('click', () => insertAtCursor('**bold text**'));
document.getElementById('btnItalic').addEventListener('click', () => insertAtCursor('*italic text*'));
document.getElementById('btnUnderline').addEventListener('click', () => insertAtCursor('<u>underlined text</u>'));


// ---------------------- DOMContentLoaded ----------------------
window.addEventListener('DOMContentLoaded', () => {
  restoreFormCache();

  // Restore featured image
  const fData = localStorage.getItem('featuredImageData');
  const fName = localStorage.getItem('featuredImageName');
  if (fData && fName) {
    featuredImageDataUrl = fData;
    const arr = fData.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    featuredImageBlob = new File([u8arr], fName, { type: mime });
  }

  // Restore inline images
  extraImages = [];
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('mdImage_')) {
      const name = key.replace('mdImage_', '');
      const dataUrl = localStorage.getItem(key);
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      const u8arr = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
      extraImages.push({ name, blob: new File([u8arr], name, { type: mime }) });
    }
  });

  renderInlineImages();
  updatePreview();
});
