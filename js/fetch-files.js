export async function fetchTextFile(file) {
  try {
    const response = await fetch(file);
    return await response.text();
  } catch (error) {
    console.error("Error fetching text data:", error);
    return null;
  }
}

export async function fetchJsonFile(file) {
  try {
    const response = await fetch(file);
    return await response.json();
  } catch (error) {
    console.error("Error fetching JSON data:", error);
    return null;
  }
}
