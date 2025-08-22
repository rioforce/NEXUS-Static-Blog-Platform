// --- References ---
const ghTokenInput = document.getElementById('ghToken');      // GitHub token input
const ghUserInput = document.getElementById('ghUsername');    // GitHub username
const ghRepoInput = document.getElementById('ghRepo');        // Repo name
const commitBtn = document.getElementById('commitBtn');       // Commit button
const commitMessageInput = document.getElementById('commitMessage');
const ghProgress = document.getElementById('ghProgress');     // Progress div
const commitLinkContainer = document.getElementById('commitLink');

// --- Helper: Base64 encode binary files ---
async function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- Commit to GitHub ---
commitBtn.addEventListener('click', async () => {
  const token = ghTokenInput.value.trim();
  const username = ghUserInput.value.trim();
  const repo = ghRepoInput.value.trim();
  const message = commitMessageInput.value.trim() || `New blog post: ${titleInput.value}`;

  if (!token || !username || !repo) {
    alert('Please fill in GitHub token, username, and repository.');
    return;
  }

  commitBtn.disabled = true;
  ghProgress.innerText = 'Starting commit...';

  const slug = titleInput.value
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\-]/g, '')
    .toLowerCase();

  const folderPath = `posts/${slug}/`; // commit under /posts/<slug>/

  try {
    // --- Get latest commit SHA ---
    const refResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/refs/heads/main`, {
      headers: { Authorization: `token ${token}` }
    });
    const refData = await refResp.json();
    const latestSHA = refData.object.sha;

    const commitResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/commits/${latestSHA}`, {
      headers: { Authorization: `token ${token}` }
    });
    const commitData = await commitResp.json();
    const baseTreeSHA = commitData.tree.sha;

    // --- Prepare files ---
    const filesToCommit = [];

    // 1. content.md (plain UTF-8)
    filesToCommit.push({
      path: folderPath + 'content.md',
      mode: '100644',
      type: 'blob',
      content: markdownContent.value
    });

    // 2. postinfo.json (plain UTF-8)
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

    // 3. index.html (plain UTF-8)
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
      }
    } catch (err) {
      console.error('Failed to fetch index.html:', err);
    }

    // 4. Featured image (base64)
    if (featuredImageBlob) {
      const fContent = await toBase64(featuredImageBlob);
      filesToCommit.push({
        path: folderPath + featuredImageBlob.name,
        mode: '100644',
        type: 'blob',
        content: fContent,
        encoding: 'base64'
      });
    }

    // 5. Extra markdown images (base64)
    for (const img of extraImages) {
      const iContent = await toBase64(img.blob);
      filesToCommit.push({
        path: folderPath + img.name,
        mode: '100644',
        type: 'blob',
        content: iContent,
        encoding: 'base64'
      });
    }

    ghProgress.innerText = 'Creating tree...';

    // --- Create Git tree ---
    const treeResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/trees`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: baseTreeSHA, tree: filesToCommit })
    });
    const treeData = await treeResp.json();
    if (!treeData.sha) throw new Error('GitHub tree creation failed');

    ghProgress.innerText = 'Creating commit...';

    // --- Create commit ---
    const newCommitResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/commits`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, tree: treeData.sha, parents: [latestSHA] })
    });
    const newCommitData = await newCommitResp.json();
    if (!newCommitData.sha) throw new Error('GitHub commit creation failed');

    // --- Update branch ---
    await fetch(`https://api.github.com/repos/${username}/${repo}/git/refs/heads/main`, {
      method: 'PATCH',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: newCommitData.sha })
    });

    ghProgress.innerText = 'Commit successful!';
    const commitUrl = `https://github.com/${username}/${repo}/tree/main/${folderPath}`;
    commitLinkContainer.innerHTML = `<a href="${commitUrl}" target="_blank">View your post on GitHub</a>`;

    // Clear cache
    localStorage.removeItem('markdownEditorCache');

  } catch (err) {
    console.error('GitHub commit failed:', err);
    ghProgress.innerText = 'Commit failed! Check console for details.';
  } finally {
    commitBtn.disabled = false;
  }
});
