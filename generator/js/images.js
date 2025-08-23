import { sanitizeFilename, escapeRegExp } from './utils.js';

// ---------------------- State (internal) ----------------------
let _featuredImageDataUrl = null;
let _featuredImageBlob = null;

export function getFeaturedImageDataUrl() {
  return _featuredImageDataUrl;
}
export function setFeaturedImageDataUrl(dataUrl) {
  _featuredImageDataUrl = dataUrl;
}

export function getFeaturedImageBlob() {
  return _featuredImageBlob;
}
export function setFeaturedImageBlob(blob) {
  _featuredImageBlob = blob;
}

// ---------------------- Inline Images ----------------------
// images.js
export let featuredImageDataUrl = null;
export let featuredImageBlob = null;
export let extraImages = [];

export const extraImageURLs = new Map();

// ---------------------- Size Limits ----------------------
const MAX_FEATURED_CACHE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_INLINE_CACHE_SIZE = 3 * 1024 * 1024; // 3MB

// ---------------------- Featured Image ----------------------
export function setupFeaturedImage(fileInput, urlInput, warningEl, updatePreviewCb) {
  fileInput.addEventListener('change', () => handleFeaturedFile(fileInput.files[0], warningEl, updatePreviewCb));
  urlInput.addEventListener('input', () => handleFeaturedURL(urlInput.value.trim(), warningEl, updatePreviewCb));
}

async function handleFeaturedFile(file, warningEl, updatePreviewCb) {
  if (!file) return;
  const sanitizedName = sanitizeFilename(file.name);
  featuredImageBlob = new File([file], sanitizedName, { type: file.type });

  const reader = new FileReader();
  reader.onload = e => {
    setFeaturedImageDataUrl(e.target.result);
    setFeaturedImageBlob(new File([file], sanitizedName, { type: file.type }));

    if (file.size <= MAX_FEATURED_CACHE_SIZE) {
      localStorage.setItem('featuredImageData', e.target.result);
      localStorage.setItem('featuredImageName', sanitizedName);
      warningEl.innerText = '';
    } else {
      localStorage.removeItem('featuredImageData');
      localStorage.removeItem('featuredImageName');
      warningEl.innerText = '⚠️ This image is too large to cache and will not persist on refresh.';
      warningEl.style.color = 'red';
    }

    updatePreviewCb();
  };
  reader.readAsDataURL(file);
}

async function handleFeaturedURL(url, warningEl, updatePreviewCb) {
  if (!url) return;

  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const originalName = url.split('/').pop().split('?')[0] || 'featuredimage.jpg';
    const sanitizedName = sanitizeFilename(originalName);

    setFeaturedImageBlob(new File([blob], sanitizedName, { type: blob.type }));
    setFeaturedImageDataUrl(URL.createObjectURL(getFeaturedImageBlob()));

    if (blob.size <= MAX_FEATURED_CACHE_SIZE) {
      const reader = new FileReader();
      reader.onload = e => {
        localStorage.setItem('featuredImageData', e.target.result);
        localStorage.setItem('featuredImageName', sanitizedName);
        warningEl.innerText = '';
      };
      reader.readAsDataURL(blob);
    } else {
      localStorage.removeItem('featuredImageData');
      localStorage.removeItem('featuredImageName');
      warningEl.innerText = '⚠️ This image is too large to cache and will not persist on refresh.';
      warningEl.style.color = 'red';
    }

    updatePreviewCb();
  } catch {
    warningEl.innerText = '⚠️ Failed to load image from URL.';
    warningEl.style.color = 'red';
  }
}

export function clearFeaturedImage(fileInput, urlInput, warningEl, updatePreviewCb) {
  setFeaturedImageDataUrl(null);
  setFeaturedImageBlob(null);
  fileInput.value = '';
  urlInput.value = '';
  localStorage.removeItem('featuredImageData');
  localStorage.removeItem('featuredImageName');
  warningEl.innerText = '';
  updatePreviewCb();
}

// ---------------------- Inline Images ----------------------
export async function insertInlineImage(fileInput, urlInput, warningEl, markdownEl, renderCb, debouncePreview) {
  let file, blob, sanitizedName;

  // Determine source
  if (fileInput.files.length > 0) {
    file = fileInput.files[0];
    blob = file;
    sanitizedName = sanitizeFilename(file.name);
  } else if (urlInput.value.trim()) {
    try {
      const resp = await fetch(urlInput.value.trim());
      blob = await resp.blob();
      const originalName = urlInput.value.split('/').pop().split('?')[0] || 'image.jpg';
      sanitizedName = sanitizeFilename(originalName);
    } catch {
      alert('Failed to fetch image from URL.');
      return;
    }
  } else return;

  // Check size
  const isTooLarge = blob.size > MAX_INLINE_CACHE_SIZE;

  // Add to extraImages
  extraImages.push({ name: sanitizedName, blob });

  // Insert markdown at cursor
  insertAtCursor(markdownEl, `![${altFrom(sanitizedName)}](${sanitizedName})`);

  // Cache if small enough
  if (!isTooLarge) {
    const reader = new FileReader();
    reader.onload = e => {
      localStorage.setItem(`mdImage_${sanitizedName}`, e.target.result);
      warningEl.innerText = '';
    };
    reader.readAsDataURL(blob);
  } else {
    warningEl.innerText = '⚠️ This image is too large to cache and will not persist on refresh.';
    warningEl.style.color = 'red';
  }

  // Update preview
  debouncePreview();

  // Render thumbnails
  renderCb(MAX_INLINE_CACHE_SIZE);

  fileInput.value = '';
  urlInput.value = '';
}

export function renderInlineImages(inlineListEl, warningEl, maxSize = MAX_INLINE_CACHE_SIZE) {
  inlineListEl.innerHTML = '';
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
    inlineListEl.appendChild(placeholder);
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
    removeBtn.addEventListener('click', () => removeInlineImage(img.name, inlineListEl, warningEl, maxSize));
    wrapper.appendChild(removeBtn);

    if (img.blob.size > maxSize) {
      hasLargeImages = true;
      const warningIcon = document.createElement('div');
      warningIcon.textContent = '⚠️';
      warningIcon.title = 'This image is too large';
      warningIcon.style.position = 'absolute';
      warningIcon.style.bottom = '2px';
      warningIcon.style.right = '2px';
      warningIcon.style.fontSize = '18px';
      wrapper.appendChild(warningIcon);
    }

    inlineListEl.appendChild(wrapper);
  });

  if (hasLargeImages) {
    warningEl.style.display = 'block';
    warningEl.textContent = '⚠️ One or more images are too large to cache and will not persist on refresh';
    warningEl.style.color = 'red';
    warningEl.style.marginTop = '6px';
  } else {
    warningEl.style.display = 'none';
  }
}

export function removeInlineImage(name, inlineListEl, warningEl, maxSize = MAX_INLINE_CACHE_SIZE) {
  const url = extraImageURLs.get(name);
  if (url) URL.revokeObjectURL(url);
  extraImageURLs.delete(name);

  extraImages = extraImages.filter(img => img.name !== name);
  localStorage.removeItem(`mdImage_${name}`);

  renderInlineImages(inlineListEl, warningEl, maxSize);
}

// ---------------------- Helpers ----------------------
function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.focus();
}

function altFrom(nameOrUrl) {
  const base = nameOrUrl.split('/').pop().split('#')[0].split('?')[0];
  return (base || 'image').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
}

// ---------------------- Markdown rewrite for preview ----------------------
export function rewriteMarkdownForPreview(mdText) {
  if (!extraImages.length) return mdText;
  let rewritten = mdText;
  for (const { name, blob } of extraImages) {
    if (!extraImageURLs.has(name)) extraImageURLs.set(name, URL.createObjectURL(blob));
    const url = extraImageURLs.get(name);
    rewritten = rewritten.replace(new RegExp(`\\]\\(${escapeRegExp(name)}\\)`, 'g'), `](${url})`);
  }
  return rewritten;
}
