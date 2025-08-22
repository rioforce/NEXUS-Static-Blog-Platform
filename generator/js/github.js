// ---------------------- References ----------------------
const ghTokenInput = document.getElementById('ghToken');
const ghUserInput = document.getElementById('ghUsername');
const ghRepoInput = document.getElementById('ghRepo');
const commitBtn = document.getElementById('commitBtn');
const commitMessageInput = document.getElementById('commitMessage');
const ghProgress = document.getElementById('ghProgress');
const commitLinkContainer = document.getElementById('commitLink');

// These come from app.js
// featuredImageBlob, extraImages, titleInput, markdownContent, dateInput, profileInput

// ---------------------- Helpers ----------------------
async function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function stripDataUrlPrefix(base64String) {
  return base64String.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
}


// ---------------------- Field Check ----------------------
function validateGitHubFields() {
  return ghTokenInput.value.trim() && ghUserInput.value.trim() && ghRepoInput.value.trim();
}

function updateCommitBtnState() {
  commitBtn.disabled = !validateGitHubFields();
}

[ghTokenInput, ghUserInput, ghRepoInput].forEach(input => input.addEventListener('input', updateCommitBtnState));
updateCommitBtnState();

// ---------------------- Commit Handler ----------------------
commitBtn.addEventListener('click', async () => {
  if (!validateGitHubFields()) {
    ghProgress.innerText = 'Please fill out all GitHub fields!';
    return;
  }

  commitBtn.disabled = true;
  ghProgress.innerText = 'Starting commit...';

  const token = ghTokenInput.value.trim();
  const username = ghUserInput.value.trim();
  const repo = ghRepoInput.value.trim();
  const message = commitMessageInput.value.trim() || `New blog post: ${titleInput.value}`;
  const slug = titleInput.value.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase();
  const folderPath = `posts/${slug}/`;

  try {
    // 1. Get latest SHA
    const refResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/refs/heads/main`, {
      headers: { Authorization: `token ${token}` }
    });
    const refData = await refResp.json();
    const latestSHA = refData.object.sha;

    // 2. Get tree SHA
    const commitResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/commits/${latestSHA}`, {
      headers: { Authorization: `token ${token}` }
    });
    const commitData = await commitResp.json();
    const baseTreeSHA = commitData.tree.sha;

    // 3. Prepare files
    const filesToCommit = [];

    // content.md
    filesToCommit.push({
      path: folderPath + 'content.md',
      mode: '100644',
      type: 'blob',
      content: markdownContent.value
    });

    // postinfo.json
    const postJSON = JSON.stringify({
      title: titleInput.value,
      youtubeLink: youtubeLinkInput.value,
      featuredImage: featuredImageBlob ? `./${featuredImageBlob.name}` : '',
      date: dateInput.value,
      content: 'content.md',
      profile: profileInput.value
    }, null, 4);

    filesToCommit.push({
      path: folderPath + 'postinfo.json',
      mode: '100644',
      type: 'blob',
      content: postJSON
    });

    // index.html — always include
    try {
    const indexResp = await fetch('blog/index.html');
    if (indexResp.ok) {
        const indexText = await indexResp.text();
        filesToCommit.push({
        path: folderPath + 'index.html',
        mode: '100644',
        type: 'blob',
        content: indexText
        });
    } else {
        throw new Error('blog/index.html not found');
    }
    } catch (err) {
    console.error('Failed to fetch index.html for commit:', err);
    ghProgress.innerText = 'Commit failed! blog/index.html missing.';
    commitBtn.disabled = false;
    return; // abort commit
    }

    // featured image
    if (featuredImageBlob) {
    const fContent = await toBase64(featuredImageBlob); // pure base64
    filesToCommit.push({
        path: folderPath + featuredImageBlob.name,
        mode: '100644',
        type: 'blob',
        content: fContent,       // <-- no data:image prefix
        encoding: 'base64'       // <-- tell GitHub this is base64
    });
    }

    // extra inline images
    for (const img of extraImages) {
    const iContent = await toBase64(img.blob);
    filesToCommit.push({
        path: folderPath + img.name,
        mode: '100644',
        type: 'blob',
        content: iContent,       // <-- raw base64 only
        encoding: 'base64'
    });
    }



    ghProgress.innerText = 'Creating tree...';
    const treeResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/trees`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: baseTreeSHA, tree: filesToCommit })
    });
    const treeData = await treeResp.json();
    if (!treeData.sha) throw new Error('GitHub tree creation failed');

    ghProgress.innerText = 'Creating commit...';
    const newCommitResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/commits`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, tree: treeData.sha, parents: [latestSHA] })
    });
    const newCommitData = await newCommitResp.json();
    if (!newCommitData.sha) throw new Error('GitHub commit creation failed');

    await fetch(`https://api.github.com/repos/${username}/${repo}/git/refs/heads/main`, {
      method: 'PATCH',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: newCommitData.sha })
    });

    ghProgress.innerText = 'Commit successful!';
    const commitUrl = `https://github.com/${username}/${repo}/tree/main/${folderPath}`;
    commitLinkContainer.innerHTML = `<a href="${commitUrl}" target="_blank">View your post on GitHub</a>`;

    // Clear cache if desired
    localStorage.removeItem('markdownEditorCache');
  } catch (err) {
    console.error('GitHub commit failed:', err);
    ghProgress.innerText = 'Commit failed! Check console for details.';
  } finally {
    // Re-enable button for next commit
    commitBtn.disabled = false;
  }
});
