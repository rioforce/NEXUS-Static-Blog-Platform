import { setYearInFooter } from "./footer.js";
import { fetchTextFile } from "./fetch-files.js";

window.addEventListener("DOMContentLoaded", async () => {
  // Load the site nav and footer
  document.querySelector("#site-nav").innerHTML = await fetchTextFile(
    "../templates/nav.html"
  );
  document.querySelector("#site-footer").innerHTML = await fetchTextFile(
    "../templates/footer.html"
  );

  // Set the current year in the footer
  setYearInFooter();
});
