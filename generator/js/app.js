import { restoreFormCache, saveFormCache } from './utils.js';
import {
  featuredImageDataUrl,
  featuredImageBlob,
  extraImages,
  extraImageURLs,
  setupFeaturedImage,
  clearFeaturedImage,
  insertInlineImage,
  renderInlineImages,
  rewriteMarkdownForPreview
} from './images.js';

import { commitToGitHub } from './github.js';

document.getElementById('commitBtn').addEventListener('click', () => {
  commitToGitHub({
    token: document.getElementById('ghToken').value.trim(),
    username: document.getElementById('ghUsername').value.trim(),
    repo: document.getElementById('ghRepo').value.trim(),
    title: document.getElementById('title').value,
    markdown: document.getElementById('markdownContent').value,
    youtubeLink: document.getElementById('youtubeLink').value,
    date: document.getElementById('date').value,
    profile: document.getElementById('profile').value,
    featuredImageBlob, // comes from images.js
    extraImages        // comes from images.js
  });
});

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
  const featuredHTML = featuredImageDataUrl
    ? `<div class="preview-featured"><img src="${featuredImageDataUrl}" alt="Featured Image"></div>`
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
  featuredImageDataUrl = null;
  featuredImageBlob = null;
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
