// --- References ---
const ghTokenInput = document.getElementById('ghToken');
const ghUserInput = document.getElementById('ghUsername');
const ghRepoInput = document.getElementById('ghRepo');
const commitBtn = document.getElementById('commitBtn');
const commitMessageInput = document.getElementById('commitMessage');
const ghProgress = document.getElementById('ghProgress');
const commitLinkContainer = document.getElementById('commitLink');

// --- Enable/Disable Commit Button Only if All GitHub Fields Are Filled ---
function updateCommitBtnState() {
  const token = ghTokenInput.value.trim();
  const username = ghUserInput.value.trim();
  const repo = ghRepoInput.value.trim();

  const allFilled = token && username && repo;
  commitBtn.disabled = !allFilled;

  if (!allFilled) {
    ghProgress.innerText = 'Please fill out GitHub token, username, and repository.';
  } else {
    ghProgress.innerText = ''; // clear message if all fields are filled
  }
}

// Update the button state whenever the user types in any GitHub input
[ghTokenInput, ghUserInput, ghRepoInput].forEach(input =>
  input.addEventListener('input', updateCommitBtnState)
);

// Set initial state on page load
updateCommitBtnState();



// --- Helper: Base64 encode files ---
async function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper: create blob on GitHub and return sha
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

  // Check required GitHub fields
  if (!token || !username || !repo) {
    ghProgress.innerText = 'Please fill out GitHub token, username, and repository.';
    console.error('Missing required GitHub fields', { token, username, repo });
    return; // stop execution
  }

  // If all fields are filled, clear any previous message
  ghProgress.innerText = '';

  commitBtn.disabled = true;
  ghProgress.innerText = 'Starting commit...';
  console.log('Starting commit process...');

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

    const filesToCommit = [];

    console.log('Preparing text files...');
    filesToCommit.push({
      path: folderPath + 'content.md',
      mode: '100644',
      type: 'blob',
      content: markdownContent.value
    });

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

    localStorage.removeItem('markdownEditorCache');

  } catch (err) {
    console.error('GitHub commit failed:', err);
    ghProgress.innerText = 'Commit failed! Check console for details.';
  }
});
