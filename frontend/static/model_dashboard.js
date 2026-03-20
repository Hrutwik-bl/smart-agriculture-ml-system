(() => {
  const metrics = window.modelMetrics || {};
  const recommendation = metrics.recommendation || {};
  const regression = metrics.regression || {};

  const createBarChart = (canvasId, labels, datasets, yTitle) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") {
      return;
    }

    new Chart(canvas, {
      type: "bar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: yTitle,
            },
          },
        },
      },
    });
  };

  createBarChart(
    "recommendation-chart",
    ["Accuracy", "F1"],
    [
      {
        label: "Random Forest",
        data: [recommendation.rf_accuracy || 0, recommendation.rf_f1 || 0],
        backgroundColor: "rgba(29, 122, 67, 0.75)",
      },
      {
        label: "XGB / Fallback",
        data: [recommendation.xgb_accuracy || 0, recommendation.xgb_f1 || 0],
        backgroundColor: "rgba(57, 200, 111, 0.75)",
      },
    ],
    "Score"
  );

  const targets = ["yield", "irrigation", "price"];
  const maeRf = targets.map((target) => regression[target]?.rf_mae || 0);
  const maeXgb = targets.map((target) => regression[target]?.xgb_mae || 0);
  const maeEns = targets.map((target) => regression[target]?.ensemble_mae || 0);

  createBarChart(
    "regression-mae-chart",
    ["Yield", "Irrigation", "Price"],
    [
      {
        label: "RF MAE",
        data: maeRf,
        backgroundColor: "rgba(20, 120, 65, 0.70)",
      },
      {
        label: "XGB MAE",
        data: maeXgb,
        backgroundColor: "rgba(36, 156, 89, 0.70)",
      },
      {
        label: "Ensemble MAE",
        data: maeEns,
        backgroundColor: "rgba(112, 205, 142, 0.70)",
      },
    ],
    "MAE"
  );

  const r2Rf = targets.map((target) => regression[target]?.rf_r2 || 0);
  const r2Xgb = targets.map((target) => regression[target]?.xgb_r2 || 0);
  const r2Ens = targets.map((target) => regression[target]?.ensemble_r2 || 0);

  createBarChart(
    "regression-r2-chart",
    ["Yield", "Irrigation", "Price"],
    [
      {
        label: "RF R²",
        data: r2Rf,
        backgroundColor: "rgba(29, 122, 67, 0.70)",
      },
      {
        label: "XGB R²",
        data: r2Xgb,
        backgroundColor: "rgba(57, 200, 111, 0.70)",
      },
      {
        label: "Ensemble R²",
        data: r2Ens,
        backgroundColor: "rgba(24, 94, 60, 0.70)",
      },
    ],
    "R²"
  );
})();
