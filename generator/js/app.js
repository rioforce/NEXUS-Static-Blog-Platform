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
const extraImageURLs = new Map(); // For preview object URLs

// Auto-fill date
dateInput.value = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// --- Sanitize filenames ---
function sanitizeFilename(name) {
  return name
    .trim()
    .replace(/\s+/g, '-')            // convert spaces to dashes
    .replace(/[^a-zA-Z0-9\-.]/g, '') // remove other special chars except dot/dash
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
  .forEach(input => {
    input.addEventListener('input', saveFormCache);
  });

// Restore cache on page load
window.addEventListener('DOMContentLoaded', restoreFormCache);

// --- Featured Image Handlers ---
featuredImageFileInput.addEventListener('change', () => {
  const file = featuredImageFileInput.files[0];
  if (file) {
    const sanitizedName = sanitizeFilename(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      featuredImageDataUrl = e.target.result;
      featuredImageBlob = new File([file], sanitizedName, { type: file.type });
      updatePreview();
    };
    reader.readAsDataURL(file);
  }
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
  } catch (err) {
    console.error('Failed to load image from URL', err);
  }
});

// Clear featured image
clearImageBtn.addEventListener('click', () => {
  featuredImageDataUrl = null;
  featuredImageBlob = null;
  featuredImageFileInput.value = '';
  featuredImageURLInput.value = '';
  updatePreview();
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

// Cheat sheet toggle
document.getElementById('toggleCheatSheet').addEventListener('click', () => {
  const sheet = document.getElementById('cheatSheet');
  sheet.style.display = sheet.style.display === 'none' ? 'block' : 'none';
});

// --- Add Image tool ---
document.getElementById('addImageBtn').addEventListener('click', () => {
  const form = document.getElementById('imageInsertForm');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('insertImageMarkdown').addEventListener('click', async () => {
  const fileInput = document.getElementById('mdImageFile');
  const urlInput = document.getElementById('mdImageURL');
  const textarea = document.getElementById('markdownContent');

  function insertAtCursor(text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    textarea.value = before + text + after;
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
    debouncePreview();
    saveFormCache(); // Also save after inserting image
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

// --- Form submit ---
postForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Clear cache on export
  localStorage.removeItem('markdownEditorCache');

  const postinfo = {
    title: titleInput.value,
    youtubeLink: youtubeLinkInput.value,
    featuredImage: featuredImageBlob ? `./${featuredImageBlob.name || 'featuredimage.jpg'}` : '',
    date: dateInput.value,
    content: 'content.md',
    profile: profileInput.value
  };

  const zip = new JSZip();
  zip.file('postinfo.json', JSON.stringify(postinfo, null, 4));
  zip.file('content.md', markdownContent.value);

  // Add featured image
  if (featuredImageBlob) {
    zip.file(featuredImageBlob.name || 'featuredimage.jpg', featuredImageBlob);
  }

  // Add extra markdown images
  extraImages.forEach(img => {
    const sanitizedName = sanitizeFilename(img.name);
    zip.file(sanitizedName, img.blob);
  });

  // Add blog index.html if available
  try {
    const blogIndexResp = await fetch('blog/index.html');
    if (blogIndexResp.ok) {
      const blogIndexHTML = await blogIndexResp.text();
      zip.file('index.html', blogIndexHTML);
    } else {
      console.warn('Could not fetch blog index.html, skipping');
    }
  } catch (err) {
    console.error('Error fetching blog index.html:', err);
  }

  // Make safe folder name from title
  let slug = titleInput.value.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase();
  if (slug.length > 32) slug = slug.slice(0, 32);

  const blob = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${slug}.zip`;
  link.click();
});

// --- GitHub Commit Integration ---
const githubUsernameInput = document.getElementById('githubUsername');
const githubRepoInput = document.getElementById('githubRepo');
const githubTokenInput = document.getElementById('githubToken');
const githubMessageInput = document.getElementById('githubMessage');
const commitBtn = document.getElementById('commitGithubBtn');

// Restore token from sessionStorage
if (sessionStorage.getItem('githubToken')) {
  githubTokenInput.value = sessionStorage.getItem('githubToken');
}

// Enable/disable commit button
function updateCommitButtonState() {
  commitBtn.disabled = !(
    githubUsernameInput.value.trim() &&
    githubRepoInput.value.trim() &&
    githubTokenInput.value.trim() &&
    githubMessageInput.value.trim()
  );
}
[githubUsernameInput, githubRepoInput, githubTokenInput, githubMessageInput].forEach(input => {
  input.addEventListener('input', () => {
    // store token in session
    if (input === githubTokenInput) sessionStorage.setItem('githubToken', input.value.trim());
    updateCommitButtonState();
  });
});
updateCommitButtonState();

// GitHub API commit function
async function commitFileToGitHub(owner, repo, path, content, message, token, sha = null) {
  const encodedContent = btoa(unescape(encodeURIComponent(content)));
  const body = { message, content: encodedContent };
  if (sha) body.sha = sha;

  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.message || 'GitHub commit failed');
  }
  return resp.json();
}

// Handle Commit to GitHub
commitBtn.addEventListener('click', async () => {
  commitBtn.disabled = true;

  const owner = githubUsernameInput.value.trim();
  const repo = githubRepoInput.value.trim();
  const token = githubTokenInput.value.trim();
  const message = githubMessageInput.value.trim();

  const slug = sanitizeFilename(titleInput.value);
  const postPath = `blog/posts/${slug}.md`;

  try {
    // Commit markdown
    let sha;
    try {
      const checkResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${postPath}`, {
        headers: { Authorization: `token ${token}` }
      });
      if (checkResp.ok) {
        const data = await checkResp.json();
        sha = data.sha;
      }
    } catch {}

    await commitFileToGitHub(owner, repo, postPath, markdownContent.value, message, token, sha);

    // Commit featured image if present
    if (featuredImageBlob) {
      const imgPath = `blog/posts/${featuredImageBlob.name}`;
      let imgSha;
      try {
        const checkImg = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${imgPath}`, {
          headers: { Authorization: `token ${token}` }
        });
        if (checkImg.ok) {
          const data = await checkImg.json();
          imgSha = data.sha;
        }
      } catch {}
      await commitFileToGitHub(owner, repo, imgPath, await featuredImageBlob.text(), message, token, imgSha);
    }

    // Commit extra markdown images
    for (const img of extraImages) {
      const imgPath = `blog/posts/${img.name}`;
      let imgSha;
      try {
        const checkImg = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${imgPath}`, {
          headers: { Authorization: `token ${token}` }
        });
        if (checkImg.ok) {
          const data = await checkImg.json();
          imgSha = data.sha;
        }
      } catch {}
      await commitFileToGitHub(owner, repo, imgPath, await img.blob.text(), message, token, imgSha);
    }

    alert('All files committed successfully!');
  } catch (err) {
    console.error(err);
    alert('GitHub commit failed: ' + err.message);
  } finally {
    updateCommitButtonState();
  }
});
