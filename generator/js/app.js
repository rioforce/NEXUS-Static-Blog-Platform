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

const addImageBtn = document.getElementById('addImageBtn');
const imageInsertForm = document.getElementById('imageInsertForm');
const mdImageFileInput = document.getElementById('mdImageFile');
const mdImageURLInput = document.getElementById('mdImageURL');
const insertImageBtn = document.getElementById('insertImageMarkdown');
const inlineImageList = document.getElementById('inlineImageList');

const clearAllBtn = document.getElementById('clearAllBtn');

// ---------------------- State ----------------------
let featuredImageDataUrl = null;
let featuredImageBlob = null;
let featuredImageURLObject = null;

let extraImages = [];
const extraImageURLs = new Map();

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
  if (saved) {
    const data = JSON.parse(saved);
    titleInput.value = data.title || '';
    youtubeLinkInput.value = data.youtubeLink || '';
    featuredImageURLInput.value = data.featuredImageURL || '';
    dateInput.value = data.date || dateInput.value;
    profileInput.value = data.profile || '';
    markdownContent.value = data.markdownContent || '';
  }
}

// ---------------------- Featured Image ----------------------
featuredImageFileInput.addEventListener('change', () => {
  const file = featuredImageFileInput.files[0];
  if (!file) return;
  const sanitizedName = sanitizeFilename(file.name);
  const reader = new FileReader();
  reader.onload = e => {
    featuredImageDataUrl = e.target.result;
    featuredImageBlob = new File([file], sanitizedName, { type: file.type });

    localStorage.setItem('featuredImageData', e.target.result);
    localStorage.setItem('featuredImageName', sanitizedName);

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
    const originalName = url.split('/').pop().split('?')[0] || 'featuredimage.jpg';
    const sanitizedName = sanitizeFilename(originalName);
    featuredImageBlob = new File([blob], sanitizedName, { type: blob.type });
    if (featuredImageURLObject) URL.revokeObjectURL(featuredImageURLObject);
    featuredImageDataUrl = featuredImageURLObject = URL.createObjectURL(featuredImageBlob);
    updatePreview();
    saveFormCache();
  } catch (err) {
    console.error('Failed to load image from URL', err);
  }
});

clearImageBtn.addEventListener('click', () => {
  featuredImageDataUrl = null;
  featuredImageBlob = null;
  featuredImageFileInput.value = '';
  featuredImageURLInput.value = '';
  localStorage.removeItem('featuredImageData');
  localStorage.removeItem('featuredImageName');
  if (featuredImageURLObject) {
    URL.revokeObjectURL(featuredImageURLObject);
    featuredImageURLObject = null;
  }
  updatePreview();
  saveFormCache();
});

// ---------------------- Inline Markdown Images ----------------------
addImageBtn.addEventListener('click', () => {
  imageInsertForm.style.display = imageInsertForm.style.display === 'none' ? 'block' : 'none';
});

insertImageBtn.addEventListener('click', async () => {
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

  if (mdImageFileInput.files.length > 0) {
    const file = mdImageFileInput.files[0];
    const sanitizedName = sanitizeFilename(file.name);
    extraImages.push({ name: sanitizedName, blob: file });

    const reader = new FileReader();
    reader.onload = e => {
      localStorage.setItem(`mdImage_${sanitizedName}`, e.target.result);
      insertAtCursor(`![${altFrom(file.name)}](${sanitizedName})`);
      renderInlineImageList();
    };
    reader.readAsDataURL(file);

  } else if (mdImageURLInput.value.trim()) {
    const url = mdImageURLInput.value.trim();
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const originalName = url.split('/').pop().split('?')[0] || 'image.jpg';
      const sanitizedName = sanitizeFilename(originalName);
      extraImages.push({ name: sanitizedName, blob });

      const reader = new FileReader();
      reader.onload = e => {
        localStorage.setItem(`mdImage_${sanitizedName}`, e.target.result);
        insertAtCursor(`![${altFrom(originalName)}](${sanitizedName})`);
        renderInlineImageList();
      };
      reader.readAsDataURL(blob);
    } catch {
      alert('Failed to fetch image from URL.');
    }
  }

  mdImageFileInput.value = '';
  mdImageURLInput.value = '';
  imageInsertForm.style.display = 'none';
});

// ---------------------- Render Inline Image List ----------------------
function renderInlineImageList() {
  inlineImageList.innerHTML = '';
  extraImages.forEach(img => {
    const item = document.createElement('div');
    item.className = 'inline-image-item';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.marginBottom = '4px';

    const thumb = document.createElement('span');
    thumb.innerText = img.name;
    thumb.style.marginRight = '8px';

    const removeBtn = document.createElement('button');
    removeBtn.innerText = 'Remove';
    removeBtn.style.fontSize = '0.8em';
    removeBtn.addEventListener('click', () => {
      removeInlineImage(img.name);
      renderInlineImageList();
    });

    item.appendChild(thumb);
    item.appendChild(removeBtn);
    inlineImageList.appendChild(item);
  });
}

function removeInlineImage(name) {
  // Revoke object URL
  const url = extraImageURLs.get(name);
  if (url) URL.revokeObjectURL(url);
  extraImageURLs.delete(name);

  // Remove from extraImages array
  extraImages = extraImages.filter(img => img.name !== name);

  // Remove from localStorage
  localStorage.removeItem(`mdImage_${name}`);

  // Remove ![]() from markdownContent
  const regex = new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(name)}\\)`, 'g');
  markdownContent.value = markdownContent.value.replace(regex, '');

  // Update preview
  updatePreview();
  saveFormCache();
}


// ---------------------- Preview ----------------------
function rewriteMarkdownForPreview(mdText) {
  extraImageURLs.forEach(url => URL.revokeObjectURL(url));
  extraImageURLs.clear();

  let rewritten = mdText;
  extraImages.forEach(({ name, blob }) => {
    const url = URL.createObjectURL(blob);
    extraImageURLs.set(name, url);
    rewritten = rewritten.replace(new RegExp(`\\]\\(${escapeRegExp(name)}\\)`, 'g'), `](${url})`);
  });
  return rewritten;
}

function updatePreview() {
  const rawMd = markdownContent.value;
  const mdForPreview = rewriteMarkdownForPreview(rawMd);

  if (featuredImageURLObject) URL.revokeObjectURL(featuredImageURLObject);

  const featuredHTML = featuredImageDataUrl
    ? `<div class="preview-featured"><img src="${
        featuredImageDataUrl.startsWith('blob:') ? featuredImageDataUrl : (featuredImageURLObject = URL.createObjectURL(featuredImageBlob))
      }" alt="Featured Image"></div>`
    : '';

  preview.innerHTML = featuredHTML + marked.parse(mdForPreview, { gfm: true, breaks: true });
}

let debounceTimer;
function debouncePreview() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(updatePreview, 250);
}

markdownContent.addEventListener('input', debouncePreview);

// ---------------------- Cache Restore ----------------------
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
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    featuredImageBlob = new File([u8arr], fName, { type: mime });
  }

  // Restore inline images
  extraImages = [];
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('mdImage_')) {
      const dataUrl = localStorage.getItem(key);
      const name = key.replace('mdImage_', '');
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      extraImages.push({ name, blob: new File([u8arr], name, { type: mime }) });
    }
  });

  renderInlineImageList();
  updatePreview();
});

// ---------------------- Form Submit (ZIP) ----------------------
postForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  localStorage.removeItem('markdownEditorCache');

  const slug = titleInput.value.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase();
  const zip = new JSZip();

  zip.file('postinfo.json', JSON.stringify({
    title: titleInput.value,
    youtubeLink: youtubeLinkInput.value,
    featuredImage: featuredImageBlob ? `./${featuredImageBlob.name}` : '',
    date: dateInput.value,
    content: 'content.md',
    profile: profileInput.value
  }, null, 4));

  zip.file('content.md', markdownContent.value);

  if (featuredImageBlob) zip.file(featuredImageBlob.name, featuredImageBlob);
  extraImages.forEach(img => zip.file(img.name, img.blob));

  try {
    const blogIndexResp = await fetch('blog/index.html');
    if (blogIndexResp.ok) zip.file('index.html', await blogIndexResp.text());
  } catch (err) {
    console.warn('Skipping blog/index.html fetch', err);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${slug}.zip`;
  link.click();
});

// ---------------------- Clear All Button ----------------------
clearAllBtn.addEventListener('click', () => {
  const confirmed = confirm("Are you sure? This will clear the whole form and cache.");
  if (!confirmed) return;

  // Clear all form fields
  titleInput.value = '';
  youtubeLinkInput.value = '';
  featuredImageFileInput.value = '';
  featuredImageURLInput.value = '';
  dateInput.value = '';
  profileInput.value = '';
  markdownContent.value = '';
  commitMessageInput.value = 'Add new blog post';
  ghTokenInput.value = '';
  ghUserInput.value = '';
  ghRepoInput.value = '';

  // Clear featured image
  featuredImageDataUrl = null;
  featuredImageBlob = null;
  if (featuredImageURLObject) {
    URL.revokeObjectURL(featuredImageURLObject);
    featuredImageURLObject = null;
  }

  // Clear inline images
  extraImages.forEach(img => {
    const url = extraImageURLs.get(img.name);
    if (url) URL.revokeObjectURL(url);
    localStorage.removeItem(`mdImage_${img.name}`);
  });
  extraImages = [];
  extraImageURLs.clear();

  // Clear localStorage cache
  localStorage.removeItem('markdownEditorCache');
  localStorage.removeItem('featuredImageData');
  localStorage.removeItem('featuredImageName');

  // Reset preview and inline image list
  renderInlineImageList();
  updatePreview();

  // Clear GitHub status
  ghProgress.innerText = '';
  commitLinkContainer.innerHTML = '';
});
