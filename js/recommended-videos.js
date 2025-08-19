import { fetchTextFile, fetchJsonFile } from "./fetch-files.js";

// Function to randomly select a specified number of items from an array
function getRandomItems(array, count) {
  const shuffled = array.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Function to truncate the title if it exceeds a certain length
function truncateTitle(title, maxLength) {
  if (title.length <= maxLength) {
    return title;
  }

  // Find the last space or non-alphanumeric character within the allowed length
  let truncatedTitle = title.substr(0, maxLength);
  let lastSpaceIndex = truncatedTitle.lastIndexOf(" ");

  // If no space found, find the last non-alphanumeric character
  if (lastSpaceIndex === -1) {
    for (let i = maxLength; i > 0; i--) {
      if (!/\w/.test(title[i])) {
        lastSpaceIndex = i;
        break;
      }
    }
  }

  // If a space or non-alphanumeric character is found, truncate at that position
  if (lastSpaceIndex !== -1) {
    truncatedTitle = truncatedTitle.substr(0, lastSpaceIndex);
  }

  return `${truncatedTitle}...`;
}

// Function to generate the dynamic page list
async function generatePageList() {
  const pageListContainer = document.querySelector("#post-recs");

  // Fetch page data from external file
  const allVideos = await fetchJsonFile("../js/recommended-videos.json");

  // Stop if we, for some reason, can't find any recommended videos
  if (!allVideos.videos) {
    return;
  }

  // Randomly select 6 pages to display
  const displayedPages = getRandomItems(allVideos.videos, 6);

  // Get the HTML template to use
  const template = await fetchTextFile("../templates/recommended-video.html");

  // Loop through the displayed pages and create elements for each
  let renderElements = ["url", "thumbnail", "title", "author", "date"];
  displayedPages.forEach((page) => {
    // Make a copy of the template HTML for rendering
    let thisFilm = template.slice();

    // Truncate title if it exceeds 39 characters
    page.title = truncateTitle(page.title, 39);

    // Add the film info into the HTML
    renderElements.forEach((key) => {
      thisFilm = thisFilm.replace(new RegExp(`:film-${key}:`, "g"), page[key]);
    });

    // Add the recommended films into the page
    pageListContainer.insertAdjacentHTML("beforeend", thisFilm);
  });
}

// Call the function to generate the initial page list
document.addEventListener("DOMContentLoaded", generatePageList);
