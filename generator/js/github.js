// github.js
export async function commitToGitHub({
  token,
  username,
  repo,
  title,
  markdown,
  youtubeLink,
  date,
  profile,
  featuredImageBlob,
  extraImages
}) {
  const ghProgress = document.getElementById('ghProgress');
  const commitLinkContainer = document.getElementById('commitLink');

  // --- Helper: Base64 encode files for GitHub ---
  async function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]); // only base64 part
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Helper: create GitHub blob and return SHA
  async function createGitHubBlob(owner, repo, token, base64Content) {
    const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: base64Content, encoding: 'base64' })
    });
    const data = await resp.json();
    if (!data.sha) throw new Error('Failed to create blob on GitHub');
    return data.sha;
  }

  if (!token || !username || !repo) {
    ghProgress.innerText = 'Please fill GitHub token, username, and repo.';
    return;
  }

  ghProgress.innerText = 'Starting commit...';

  const slug = title.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase();
  const folderPath = `posts/${slug}/`;
  const message = `New blog post: ${title}`;

  try {
    // 1. Get latest commit SHA and tree SHA
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

    // 2. Prepare files for commit
    const filesToCommit = [];

    // Markdown content
    filesToCommit.push({
      path: folderPath + 'content.md',
      mode: '100644',
      type: 'blob',
      content: markdown
    });

    // postinfo.json
    const postJSON = JSON.stringify({
      title,
      youtubeLink,
      featuredImage: featuredImageBlob ? `./${featuredImageBlob.name}` : '',
      date,
      content: 'content.md',
      profile
    }, null, 4);
    filesToCommit.push({
      path: folderPath + 'postinfo.json',
      mode: '100644',
      type: 'blob',
      content: postJSON
    });

    // Optional index.html
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
    } catch {}

    // Featured image
    if (featuredImageBlob) {
      const base64 = await toBase64(featuredImageBlob);
      const sha = await createGitHubBlob(username, repo, token, base64);
      filesToCommit.push({
        path: folderPath + featuredImageBlob.name,
        mode: '100644',
        type: 'blob',
        sha
      });
    }

    // Extra inline images
    for (const img of extraImages) {
      const base64 = await toBase64(img.blob);
      const sha = await createGitHubBlob(username, repo, token, base64);
      filesToCommit.push({
        path: folderPath + img.name,
        mode: '100644',
        type: 'blob',
        sha
      });
    }

    // 3. Create tree
    const treeResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/trees`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: baseTreeSHA, tree: filesToCommit })
    });
    const treeData = await treeResp.json();
    if (!treeData.sha) throw new Error('Tree creation failed');

    // 4. Create commit
    const newCommitResp = await fetch(`https://api.github.com/repos/${username}/${repo}/git/commits`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, tree: treeData.sha, parents: [latestSHA] })
    });
    const newCommitData = await newCommitResp.json();
    if (!newCommitData.sha) throw new Error('Commit creation failed');

    // 5. Update branch
    await fetch(`https://api.github.com/repos/${username}/${repo}/git/refs/heads/main`, {
      method: 'PATCH',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: newCommitData.sha })
    });

    ghProgress.innerText = 'Commit successful!';
    const commitUrl = `https://github.com/${username}/${repo}/tree/main/${folderPath}`;
    commitLinkContainer.innerHTML = `<a href="${commitUrl}" target="_blank">View your post on GitHub</a>`;

  } catch (err) {
    console.error('GitHub commit failed:', err);
    ghProgress.innerText = 'Commit failed! Check console.';
  } finally {
    localStorage.removeItem('markdownEditorCache');
  }
}
