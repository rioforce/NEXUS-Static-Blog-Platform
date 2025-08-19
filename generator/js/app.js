const form = document.getElementById('postForm');
const markdownContent = document.getElementById('markdownContent');
const preview = document.getElementById('preview');
const cheatButton = document.getElementById('toggleCheatSheet');
const cheatSheet = document.getElementById('cheatSheet');
const featuredImageFile = document.getElementById('featuredImageFile');
const featuredImageURL = document.getElementById('featuredImageURL');
const clearImageBtn = document.getElementById('clearImage');

let featuredImageDataUrl = "";
let featuredImageName = "";

// Autofill date
const dateInput = document.getElementById('date');
const today = new Date();
const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
dateInput.value = `${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

// Update preview
function updatePreview() {
  const mdText = markdownContent.value;
  const featuredHTML = featuredImageDataUrl ? `<div class="preview-featured"><img src="${featuredImageDataUrl}" alt="Featured Image"></div>` : '';
  preview.innerHTML = featuredHTML + marked.parse(mdText, { gfm: true, breaks: true });
}

// Debounce 250ms
let debounceTimeout;
function debouncePreview() {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(updatePreview, 250);
}
markdownContent.addEventListener('input', debouncePreview);

// Handle local file
featuredImageFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  featuredImageName = file.name;
  const reader = new FileReader();
  reader.onload = function(evt) {
    featuredImageDataUrl = evt.target.result;
    featuredImageURL.value = "";
    debouncePreview();
  };
  reader.readAsDataURL(file);
});

// Handle URL input
featuredImageURL.addEventListener('input', () => {
  const url = featuredImageURL.value.trim();
  if (!url) {
    if (!featuredImageFile.files[0]) {
      featuredImageDataUrl = "";
      featuredImageName = "";
      debouncePreview();
    }
    return;
  }
  featuredImageName = url.split('/').pop().split('?')[0] || "online_image.jpg";
  featuredImageDataUrl = url;
  if (featuredImageFile.files[0]) featuredImageFile.value = "";
  debouncePreview();
});

// Clear image
clearImageBtn.addEventListener('click', () => {
  featuredImageFile.value = "";
  featuredImageURL.value = "";
  featuredImageDataUrl = "";
  featuredImageName = "";
  debouncePreview();
});

// Initialize preview
updatePreview();

// Toggle cheat sheet
cheatButton.addEventListener('click', () => {
  if (cheatSheet.style.display === "block") {
    cheatSheet.style.display = "none";
    cheatButton.textContent = "Show Markdown Cheat Sheet";
  } else {
    cheatSheet.style.display = "block";
    cheatButton.textContent = "Hide Markdown Cheat Sheet";
  }
});

// Generate ZIP
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('title').value;
  const youtubeLink = document.getElementById('youtubeLink').value;
  const date = document.getElementById('date').value;
  const profile = document.getElementById('profile').value;
  const mdContent = markdownContent.value;

  const postInfo = {
    title,
    youtubeLink,
    featuredImage: featuredImageName ? `./${featuredImageName}` : "",
    date,
    content: "content.md",
    profile
  };

  const zip = new JSZip();
  zip.file("postinfo.json", JSON.stringify(postInfo, null, 2));
  zip.file("content.md", mdContent);

  // Add local file
  if (featuredImageFile.files[0]) {
    zip.file(featuredImageFile.files[0].name, featuredImageFile.files[0]);
  }
  // Add URL image
  else if (featuredImageURL.value.trim()) {
    try {
      const response = await fetch(featuredImageURL.value.trim());
      const blob = await response.blob();
      zip.file(featuredImageName, blob);
    } catch(err) {
      alert("Failed to fetch image from URL. Check the link.");
    }
  }

  // ✅ Always include blog scaffold index.html
  try {
    const response = await fetch("./blog/index.html");
    const indexHtml = await response.text();
    zip.file("index.html", indexHtml);
  } catch(err) {
    console.error("Could not fetch blog/index.html", err);
  }

  const content = await zip.generateAsync({ type: "blob" });

  // Generate slug from title
  let slug = title.toLowerCase().trim()
                  .replace(/[^a-z0-9\\s-]/g, '')
                  .replace(/\\s+/g, '-')
                  .replace(/-+/g, '-')
                  .substring(0, 32);

  const link = document.createElement("a");
  link.href = URL.createObjectURL(content);
  link.download = slug + ".zip";
  link.click();
});
