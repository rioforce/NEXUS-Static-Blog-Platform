import { fetchTextFile, fetchJsonFile } from "./fetch-files.js";

function loadVideoInfo() {
  // Load data from an external JSON file (e.g., videoinfo.json)
  fetchJsonFile("postinfo.json")
    .then((data) => {
      // Set the video metadata
      document.querySelector("#pageTitle").textContent = data.title;
      document.querySelector("#post-title").textContent = data.title;
      document.querySelector("#post-date").textContent = data.date;

      // Pull in and render the blog post
      fetchTextFile(data.content).then((markdown) => {
        document.querySelector("#article-body").innerHTML =
          marked.parse(markdown);
      });

      // Load video information from external JSON file
      loadMedia(data.youtubeLink, data.featuredImage);

      // Load profile information from external JSON file
      loadProfileInfo(data.profile);
    })
    .catch((error) => console.error("Error loading video info:", error));
}

function loadMedia(youtubeLink, featuredImage) {
  const mediaContainer = document.querySelector("#film-link");

  // Clear container first
  mediaContainer.innerHTML = "";

  // Helper to check if a value is usable
  const hasValue = (val) =>
    typeof val === "string" ? val.trim().length > 0 : !!val;

  // Check YouTube first (priority)
  if (hasValue(youtubeLink)) {
    console.log("Loading YouTube:", youtubeLink);
    const fullEmbedUrl = `https://www.youtube.com/embed/${youtubeLink.trim()}`;
    mediaContainer.innerHTML = `
      <iframe width="851" height="479"
              src="${fullEmbedUrl}"
              frameborder="0"
              allowfullscreen>
      </iframe>`;
    return;
  }

  // If no YouTube, check featured image
  if (hasValue(featuredImage)) {
  console.log("Loading Image:", featuredImage);
  mediaContainer.innerHTML = `
    <div class="featured-img-container">
      <img src="${featuredImage.trim()}" alt="Featured Image">
    </div>`;
  return;
}

  console.log("No media found");
}

function loadProfileInfo(profile) {
  fetchJsonFile(`../profiles/${profile}-profile.json`)
    .then((data) => {
      // Update HTML with JSON data
      document.querySelector("#profile-link").href = data.profileLink;
      document.querySelector("#profile-avatar").src = data.avatarSrc;
      document.querySelector("#profile-username").innerText = data.username;
    })
    .catch((error) => console.error("Error fetching JSON:", error));
}

document.addEventListener("DOMContentLoaded", loadVideoInfo);
