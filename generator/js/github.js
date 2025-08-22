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
    reader.onload = () => {
      // reader.result is something like "data:image/png;base64,...."
      resolve(reader.result.split(',')[1]); // only keep base64 part
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper: UTF-8 to Base64
function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
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

  const folderPath = `posts/${slug}/`; // updated path

  try {
    // 1. Get latest SHA of main branch
    const refResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/refs/heads/main`, {
      headers: { Authorization: `token ${token}` }
    });
    const refData = await refResp.json();
    const latestSHA = refData.object.sha;

    // 2. Get tree SHA of latest commit
    const commitResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/commits/${latestSHA}`, {
      headers: { Authorization: `token ${token}` }
    });
    const commitData = await commitResp.json();
    const baseTreeSHA = commitData.tree.sha;

// Prepare files for commit as plain UTF-8 text
const filesToCommit = [];

// content.md
filesToCommit.push({
  path: folderPath + 'content.md',
  mode: '100644',
  type: 'blob',
  content: markdownContent.value  // raw text
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
  content: postJSON  // raw text
});

// index.html
try {
  const indexResp = await fetch('blog/index.html');
  if (indexResp.ok) {
    const indexText = await indexResp.text();
    filesToCommit.push({
      path: folderPath + 'index.html',
      mode: '100644',
      type: 'blob',
      content: indexText  // raw text
    });
  }
} catch (err) {
  console.error('Failed to fetch index.html for commit:', err);
}

// For featured image
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

// For extra images
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



    console.log('Files to commit:', filesToCommit);
    ghProgress.innerText = 'Creating tree...';

    // 4. Create tree
    const treeResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/trees`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: baseTreeSHA, tree: filesToCommit })
    });
    const treeData = await treeResp.json();
    if (!treeData.sha) {
      console.error('Tree creation failed:', treeData);
      throw new Error('GitHub tree creation failed');
    }

    ghProgress.innerText = 'Creating commit...';

    // 5. Create commit
    const newCommitResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/commits`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, tree: treeData.sha, parents: [latestSHA] })
    });
    const newCommitData = await newCommitResp.json();
    if (!newCommitData.sha) {
      console.error('Commit creation failed:', newCommitData);
      throw new Error('GitHub commit creation failed');
    }

    // 6. Update main branch
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


