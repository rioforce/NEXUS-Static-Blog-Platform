export function setYearInFooter() {
  // Set the current year in the footer
  const curDate = new Date();
  const qCurrentYear = document.querySelector("#current-year");
  qCurrentYear.textContent = curDate.getFullYear();
}
