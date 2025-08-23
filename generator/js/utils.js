// ---------------------- Utilities ----------------------
export function sanitizeFilename(name) {
  return name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-.]/g, '').toLowerCase();
}

export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------- LocalStorage Cache ----------------------
export function saveFormCache(formData) {
  localStorage.setItem('markdownEditorCache', JSON.stringify(formData));
}

export function restoreFormCache(inputs) {
  const saved = localStorage.getItem('markdownEditorCache');
  const today = new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
    }); // e.g., "August 22, 2025"
  if (!saved) {
    inputs.date.value = today;
    return;
  }
  const data = JSON.parse(saved);
  inputs.title.value = data.title || '';
  inputs.youtubeLink.value = data.youtubeLink || '';
  inputs.featuredImageURL.value = data.featuredImageURL || '';
  inputs.date.value = data.date || today;
  inputs.profile.value = data.profile || '';
  inputs.markdownContent.value = data.markdownContent || '';
}
