import { restoreFormCache, saveFormCache } from './utils.js';
import {
  getFeaturedImageDataUrl,
  setFeaturedImageDataUrl,
  setFeaturedImageBlob,
  getFeaturedImageBlob,
  extraImageURLs,
  setupFeaturedImage,
  clearFeaturedImage,
  insertInlineImage,
  renderInlineImages,
  rewriteMarkdownForPreview
} from './images.js';
import { featuredImageDataUrl, featuredImageBlob, extraImages } from './images.js';
import { commitToGitHub } from './github.js';

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
const featuredWarning = document.getElementById('featuredWarning');
const inlineImageWarning = document.getElementById('inlineImageWarning');

let debounceTimer = null;

function updatePreview() {
  const mdForPreview = rewriteMarkdownForPreview(markdownContent.value);
  const featuredHTML = getFeaturedImageDataUrl()
    ? `<div class="preview-featured"><img src="${getFeaturedImageDataUrl()}" alt="Featured Image"></div>`
    : '';
  preview.innerHTML = featuredHTML + marked.parse(mdForPreview, { gfm: true, breaks: true });
}

function debouncePreview() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(updatePreview, 100);
}

function renderInline() {
  renderInlineImages(inlineImageList, inlineImageWarning);
}

// ---------------------- Event Listeners ----------------------
markdownContent.addEventListener('input', debouncePreview);

setupFeaturedImage(featuredImageFileInput, featuredImageURLInput, featuredWarning, updatePreview);
clearImageBtn.addEventListener('click', () =>
  clearFeaturedImage(featuredImageFileInput, featuredImageURLInput, featuredWarning, updatePreview)
);

insertImageMarkdownBtn.addEventListener('click', async () => {
  await insertInlineImage(mdImageFileInput, mdImageURLInput, inlineImageWarning, markdownContent, renderInline, debouncePreview);
});

clearAllBtn.addEventListener('click', () => {
  if (!confirm('Are you sure? This will clear the whole form and cache.')) return;
  postForm.reset();

  // Featured image
  setFeaturedImageDataUrl(null);
  setFeaturedImageBlob(null);
  localStorage.removeItem('featuredImageData');
  localStorage.removeItem('featuredImageName');

  // Inline images
  extraImages.forEach(img => localStorage.removeItem(`mdImage_${img.name}`));
  extraImages.length = 0;
  extraImageURLs.forEach(url => URL.revokeObjectURL(url));
  extraImageURLs.clear();
  inlineImageList.innerHTML = '';
  inlineImageWarning.style.display = 'none';

  markdownContent.value = '';
  updatePreview();

  localStorage.removeItem('markdownEditorCache');

    // Reload the page
  location.reload();
});

// ---------------------- Commit Button ----------------------
document.getElementById('commitBtn').addEventListener('click', () => {
  commitToGitHub({
    token: document.getElementById('ghToken').value.trim(),
    username: document.getElementById('ghUsername').value.trim(),
    repo: document.getElementById('ghRepo').value.trim(),
    title: titleInput.value,
    markdown: markdownContent.value,
    youtubeLink: youtubeLinkInput.value,
    date: dateInput.value,
    profile: profileInput.value,
    featuredImageBlob: getFeaturedImageBlob(),
    extraImages
  });
});

// ---------------------- DOMContentLoaded ----------------------
window.addEventListener('DOMContentLoaded', () => {
  restoreFormCache({
    title: titleInput,
    youtubeLink: youtubeLinkInput,
    featuredImageURL: featuredImageURLInput,
    date: dateInput,
    profile: profileInput,
    markdownContent
  });

  // Restore featured image from localStorage
  const fData = localStorage.getItem('featuredImageData');
  const fName = localStorage.getItem('featuredImageName');
  if (fData && fName) {
    setFeaturedImageDataUrl(fData);
    const arr = fData.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    setFeaturedImageBlob(new File([u8arr], fName, { type: mime }));
  }

  // Restore inline images
  extraImages.length = 0;
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

  renderInline();
  updatePreview();
});

function prependHeader(textarea, level) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end) || '';

  const prefix = '#'.repeat(level) + ' ';

  // Insert prefix at start of each line
  const lines = selected.split('\n');
  const newText = lines.map(line => prefix + line).join('\n');

  // Replace selection with new text
  textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);

  // Update selection to cover only original text, not the prefix
  textarea.selectionStart = start + prefix.length;
  textarea.selectionEnd = start + newText.length;

  textarea.focus();
  debouncePreview(); // refresh preview
}

function wrapSelection(textarea, before, after = before) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end);
  textarea.value = textarea.value.substring(0, start) + before + selected + after + textarea.value.substring(end);
  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = end + before.length;
  textarea.focus();
  debouncePreview(); // refresh preview
}

// Bind buttons
document.getElementById('btnH1').addEventListener('click', () => prependHeader(markdownContent, 1));
document.getElementById('btnH2').addEventListener('click', () => prependHeader(markdownContent, 2));
document.getElementById('btnH3').addEventListener('click', () => prependHeader(markdownContent, 3));
document.getElementById('btnBold').addEventListener('click', () => wrapSelection(markdownContent, '**'));
document.getElementById('btnItalic').addEventListener('click', () => wrapSelection(markdownContent, '*'));
document.getElementById('btnUnderline').addEventListener('click', () => wrapSelection(markdownContent, '<u>', '</u>'));

// ---------------------- Form Submit (ZIP) ----------------------
postForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  localStorage.removeItem('markdownEditorCache');

  const slug = titleInput.value
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\-]/g, '')
    .toLowerCase();

  const zip = new JSZip();

  // Create postinfo.json
  zip.file(
    'postinfo.json',
    JSON.stringify({
      title: titleInput.value,
      youtubeLink: youtubeLinkInput.value,
      featuredImage: featuredImageBlob ? `./${featuredImageBlob.name}` : '',
      date: dateInput.value,
      content: 'content.md',
      profile: profileInput.value
    }, null, 4)
  );

  // Markdown content
  zip.file('content.md', markdownContent.value);

  // Featured image
  if (featuredImageBlob) {
    console.log('Adding featured image:', featuredImageBlob.name, featuredImageBlob);
    zip.file(featuredImageBlob.name, featuredImageBlob);
  }

  // Extra inline images
  extraImages.forEach(img => {
    console.log('Adding inline image:', img.name, img.blob);
    zip.file(img.name, img.blob);
  });

  // Optional index.html
  try {
    const blogIndexResp = await fetch('blog/index.html');
    if (blogIndexResp.ok) {
      const indexText = await blogIndexResp.text();
      zip.file('index.html', indexText);
    }
  } catch (err) {
    console.warn('Skipping blog/index.html fetch', err);
  }

  // Generate ZIP and trigger download
  const blob = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${slug}.zip`;
  link.click();
});

