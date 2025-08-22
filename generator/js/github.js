// --- References ---
const ghTokenInput = document.getElementById('ghToken');      // your token input
const ghUserInput = document.getElementById('ghUsername');    // GitHub username
const ghRepoInput = document.getElementById('ghRepo');        // Repo name
const commitBtn = document.getElementById('commitBtn');       // Commit button
const commitMessageInput = document.getElementById('commitMessage');
const ghProgress = document.getElementById('ghProgress');     // optional progress div
const commitLinkContainer = document.getElementById('commitLink');

// --- Helper: Base64 encode files ---
async function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); // only keep base64 part
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper: UTF-8 to Base64
function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

// Helper: create GitHub blob and return sha
async function createGitHubBlob(owner, repo, token, base64Content) {
  console.log(`Creating blob in repo ${owner}/${repo}...`);
  const blobResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: base64Content, encoding: 'base64' })
  });
  const blobData = await blobResp.json();
  console.log('Blob create response:', blobData);
  if (!blobData.sha) throw new Error('Failed to create blob on GitHub');
  return blobData.sha;
}

// --- Commit to GitHub ---
commitBtn.addEventListener('click', async () => {
  console.log('Commit button clicked');

  const token = ghTokenInput.value.trim();
  const username = ghUserInput.value.trim();
  const repo = ghRepoInput.value.trim();
  const message = commitMessageInput.value.trim() || `New blog post: ${titleInput.value}`;

  // Check required GitHub fields on click
  if (!token || !username || !repo) {
    ghProgress.innerText = 'Please fill out GitHub token, username, and repository.';
    console.error('Missing required GitHub fields', { token, username, repo });
    return;
  }

  // Clear any previous message
  ghProgress.innerText = '';

  commitBtn.disabled = true;
  ghProgress.innerText = 'Starting commit...';

  const slug = titleInput.value
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\-]/g, '')
    .toLowerCase();

  const folderPath = `posts/${slug}/`;

  try {
    console.log('Fetching latest branch SHA...');
    const refResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/refs/heads/main`, {
      headers: { Authorization: `token ${token}` }
    });
    const refData = await refResp.json();
    console.log('Branch ref data:', refData);
    const latestSHA = refData.object.sha;

    console.log('Fetching latest commit data...');
    const commitResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/commits/${latestSHA}`, {
      headers: { Authorization: `token ${token}` }
    });
    const commitData = await commitResp.json();
    console.log('Commit data:', commitData);
    const baseTreeSHA = commitData.tree.sha;

    // Prepare files to commit
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

    // index.html if exists
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
      console.warn('Skipping index.html fetch:', err);
    }

    // Featured image
    if (featuredImageBlob) {
      console.log('Processing featured image...');
      const fContent = await toBase64(featuredImageBlob);
      const sha = await createGitHubBlob(username, repo, token, fContent);
      filesToCommit.push({
        path: folderPath + featuredImageBlob.name,
        mode: '100644',
        type: 'blob',
        sha
      });
    }

    // Extra images
    for (const img of extraImages) {
      console.log(`Processing extra image: ${img.name}`);
      const iContent = await toBase64(img.blob);
      const sha = await createGitHubBlob(username, repo, token, iContent);
      filesToCommit.push({
        path: folderPath + img.name,
        mode: '100644',
        type: 'blob',
        sha
      });
    }

    console.log('Files prepared for commit:', filesToCommit);

    console.log('Creating tree...');
    const treeResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/trees`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: baseTreeSHA, tree: filesToCommit })
    });
    const treeData = await treeResp.json();
    console.log('Tree creation response:', treeData);
    if (!treeData.sha) throw new Error('GitHub tree creation failed');

    console.log('Creating commit...');
    const newCommitResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/commits`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, tree: treeData.sha, parents: [latestSHA] })
    });
    const newCommitData = await newCommitResp.json();
    console.log('Commit creation response:', newCommitData);
    if (!newCommitData.sha) throw new Error('GitHub commit creation failed');

    console.log('Updating branch ref...');
    await fetch(`https://api.github.com/repos/${username}/${repo}/git/refs/heads/main`, {
      method: 'PATCH',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: newCommitData.sha })
    });

    ghProgress.innerText = 'Commit successful!';
    const commitUrl = `https://github.com/${username}/${repo}/tree/main/${folderPath}`;
    commitLinkContainer.innerHTML = `<a href="${commitUrl}" target="_blank">View your post on GitHub</a>`;
    console.log('Commit complete!');

    // Re-enable button for next commit
    commitBtn.disabled = false;

    localStorage.removeItem('markdownEditorCache');

  } catch (err) {
    console.error('GitHub commit failed:', err);
    ghProgress.innerText = 'Commit failed! Check console for details.';
  }
});
