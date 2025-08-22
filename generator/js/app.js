// --- References ---
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

let featuredImageDataUrl = null;
let featuredImageBlob = null;

// Store additional markdown images
let extraImages = [];
const extraImageURLs = new Map();

// --- Auto-fill date ---
dateInput.value = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// --- Sanitize filenames ---
function sanitizeFilename(name) {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\-.]/g, '')
    .toLowerCase();
}

// --- LocalStorage Cache ---
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
    updatePreview();
  }
}

// Attach input listeners for caching
[titleInput, youtubeLinkInput, featuredImageURLInput, dateInput, profileInput, markdownContent]
  .forEach(input => input.addEventListener('input', saveFormCache));

// Restore cache on page load
window.addEventListener('DOMContentLoaded', restoreFormCache);

// --- Featured Image Handlers ---
featuredImageFileInput.addEventListener('change', () => {
  const file = featuredImageFileInput.files[0];
  if (!file) return;
  const sanitizedName = sanitizeFilename(file.name);
  const reader = new FileReader();
  reader.onload = e => {
    featuredImageDataUrl = e.target.result;
    featuredImageBlob = new File([file], sanitizedName, { type: file.type });
    updatePreview();
    saveFormCache();
  };
  reader.readAsDataURL(file);
});

featuredImageURLInput.addEventListener('input', async () => {
  const url = featuredImageURLInput.value.trim();
  if (!url) return;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const originalName = url.split('/').pop().split('?')[0] || 'featuredimage.jpg';
    const sanitizedName = sanitizeFilename(originalName);
    featuredImageBlob = new File([blob], sanitizedName, { type: blob.type });
    featuredImageDataUrl = URL.createObjectURL(featuredImageBlob);
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
  updatePreview();
  saveFormCache();
});

// Escape regex helper
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Rewrite markdown to show object URLs for local images
function rewriteMarkdownForPreview(mdText) {
  if (!extraImages.length) return mdText;
  let rewritten = mdText;
  for (const { name, blob } of extraImages) {
    if (!extraImageURLs.has(name)) {
      extraImageURLs.set(name, URL.createObjectURL(blob));
    }
    const url = extraImageURLs.get(name);
    const pattern = new RegExp(`\\]\\(${escapeRegExp(name)}\\)`, 'g');
    rewritten = rewritten.replace(pattern, `](${url})`);
  }
  return rewritten;
}

// Update markdown preview
function updatePreview() {
  const rawMd = markdownContent.value;
  const mdForPreview = rewriteMarkdownForPreview(rawMd);
  const featuredHTML = featuredImageDataUrl
    ? `<div class="preview-featured"><img src="${featuredImageDataUrl}" alt="Featured Image"></div>`
    : '';
  preview.innerHTML = featuredHTML + marked.parse(mdForPreview, { gfm: true, breaks: true });
}

// Debounce preview updates
let debounceTimer;
function debouncePreview() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(updatePreview, 250);
}
markdownContent.addEventListener('input', debouncePreview);

// --- Add Image Tool ---
document.getElementById('addImageBtn').addEventListener('click', () => {
  const form = document.getElementById('imageInsertForm');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('insertImageMarkdown').addEventListener('click', async () => {
  const fileInput = document.getElementById('mdImageFile');
  const urlInput = document.getElementById('mdImageURL');
  const textarea = markdownContent;

  function insertAtCursor(text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    textarea.value = before + text + after;
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
    debouncePreview();
    saveFormCache();
  }

  function altFrom(nameOrUrl) {
    const base = nameOrUrl.split('/').pop().split('#')[0].split('?')[0];
    return (base || 'image').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
  }

  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const sanitizedName = sanitizeFilename(file.name);
    extraImages.push({ name: sanitizedName, blob: file });
    insertAtCursor(`![${altFrom(file.name)}](${sanitizedName})`);
  } else if (urlInput.value.trim()) {
    const url = urlInput.value.trim();
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const originalName = url.split('/').pop().split('?')[0] || 'image.jpg';
      const sanitizedName = sanitizeFilename(originalName);
      extraImages.push({ name: sanitizedName, blob });
      insertAtCursor(`![${altFrom(originalName)}](${sanitizedName})`);
    } catch (err) {
      alert('Failed to fetch image from URL.');
    }
  }

  fileInput.value = '';
  urlInput.value = '';
  document.getElementById('imageInsertForm').style.display = 'none';
});

// --- Form Submit (ZIP Export) ---
postForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  localStorage.removeItem('markdownEditorCache');

  const slug = titleInput.value
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\-]/g, '')
    .toLowerCase();
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
