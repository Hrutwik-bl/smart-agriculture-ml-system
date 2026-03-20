const { loadCsv } = require("./datasetService");
const { SOIL_HEALTH_CSV_PATH } = require("../config");
const { canUseSoilHealthApi, fetchSoilHealthRecords } = require("./soilHealthGovService");

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const classifySoil = ({ n, p, k, ph }) => {
  const score = [n, p, k].reduce((acc, value) => acc + (value !== null ? value : 0), 0);
  let status = "Medium";
  if (score >= 180) status = "Fertile";
  if (score < 90) status = "Poor";
  if (ph !== null && (ph < 5.5 || ph > 8.5)) status = "Poor";

  const recommendations = [];
  if (n !== null && n < 40) recommendations.push("Apply urea or compost for nitrogen boost.");
  if (p !== null && p < 20) recommendations.push("Use DAP or SSP to improve phosphorus.");
  if (k !== null && k < 20) recommendations.push("Apply MOP to increase potassium.");
  if (ph !== null && ph < 6) recommendations.push("Add lime to correct soil acidity.");
  if (ph !== null && ph > 8) recommendations.push("Use gypsum to reduce alkalinity.");

  return {
    status,
    recommendations
  };
};

const getSoilHealth = async ({ location, soil = {} }) => {
  let n = toNumber(soil.n);
  let p = toNumber(soil.p);
  let k = toNumber(soil.k);
  let ph = toNumber(soil.ph);
  let source = "input";

  if ((n === null || p === null || k === null || ph === null) && location) {
    const dataset = await loadCsv(SOIL_HEALTH_CSV_PATH);
    if (dataset && dataset.length) {
      const match = dataset.find((row) =>
        String(row.District || row.district || "")
          .toLowerCase()
          .includes(String(location).toLowerCase())
      );
      if (match) {
        n = n ?? toNumber(match.N || match.nitrogen);
        p = p ?? toNumber(match.P || match.phosphorus);
        k = k ?? toNumber(match.K || match.potassium);
        ph = ph ?? toNumber(match.pH || match.ph);
        source = "soil-health-csv";
      }
    }
  }

  if ((n === null || p === null || k === null || ph === null) && location && canUseSoilHealthApi()) {
    const records = await fetchSoilHealthRecords({ location });
    if (records.length) {
      const match = records[0];
      n = n ?? toNumber(match.N || match.nitrogen || match.n);
      p = p ?? toNumber(match.P || match.phosphorus || match.p);
      k = k ?? toNumber(match.K || match.potassium || match.k);
      ph = ph ?? toNumber(match.pH || match.ph);
      source = "soil-health-api";
    }
  }

  return {
    source,
    input: { n, p, k, ph },
    ...classifySoil({ n, p, k, ph })
  };
};

module.exports = {
  getSoilHealth
};
