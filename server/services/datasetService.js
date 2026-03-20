const fs = require("fs");

const parseCsv = (text) => {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((value) => value.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ? cells[index].trim() : "";
    });
    return row;
  });
};

const loadCsv = async (filePath) => {
  const exists = fs.existsSync(filePath);
  if (!exists) return null;
  const raw = await fs.promises.readFile(filePath, "utf-8");
  return parseCsv(raw);
};

module.exports = {
  loadCsv,
  parseCsv
};
