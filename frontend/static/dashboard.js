(function () {
  const sectionButtons = Array.from(document.querySelectorAll("[data-section-target]"));
  const sections = Array.from(document.querySelectorAll("[data-section-panel]"));

  const activateSection = (target) => {
    sections.forEach((section) => {
      const isActive = section.dataset.sectionPanel === target;
      section.classList.toggle("is-active", isActive);
      section.hidden = !isActive;
    });
    sectionButtons.forEach((button) => {
      const isActive = button.dataset.sectionTarget === target;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  };

  sectionButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      activateSection(button.dataset.sectionTarget);
    });
  });

  if (sectionButtons.length) {
    activateSection(sectionButtons[0].dataset.sectionTarget);
  }

  const locationInput = document.getElementById("location");
  const locationStatus = document.getElementById("location-status");
  const liveLocationButton = document.getElementById("use-live-location");

  const statusText = locationStatus
    ? {
        idle: locationStatus.dataset.statusIdle,
        detecting: locationStatus.dataset.statusDetecting,
        denied: locationStatus.dataset.statusDenied,
        error: locationStatus.dataset.statusError,
        unsupported: locationStatus.dataset.statusUnsupported,
        resolved: locationStatus.dataset.statusResolved,
      }
    : {};

  const setLocationStatus = (key, tone) => {
    if (!locationStatus) return;
    locationStatus.textContent = statusText[key] || key;
    locationStatus.classList.remove("text-emerald-600", "text-rose-600", "text-slate-500");
    if (tone === "success") {
      locationStatus.classList.add("text-emerald-600");
    } else if (tone === "error") {
      locationStatus.classList.add("text-rose-600");
    } else {
      locationStatus.classList.add("text-slate-500");
    }
  };

  const resolveLocationName = async (latitude, longitude) => {
    if (!window.resolveLocationUrl) return null;
    const response = await fetch(`${window.resolveLocationUrl}?lat=${latitude}&lon=${longitude}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.location || null;
  };

  if (liveLocationButton) {
    liveLocationButton.addEventListener("click", () => {
      if (!navigator.geolocation) {
        setLocationStatus("unsupported", "error");
        return;
      }
      setLocationStatus("detecting", "info");
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const resolved = await resolveLocationName(latitude, longitude);
          if (resolved && locationInput) {
            locationInput.value = resolved;
            setLocationStatus("resolved", "success");
          } else {
            setLocationStatus("error", "error");
          }
        },
        () => {
          setLocationStatus("denied", "error");
        },
        { timeout: 10000 }
      );
    });
  }

  const priceGrid = document.getElementById("price-grid");
  if (priceGrid) {
    const priceDetail = {
      name: document.getElementById("price-detail-name"),
      subtitle: document.getElementById("price-detail-subtitle"),
      rows: document.getElementById("price-detail-rows"),
    };
    const defaultDetailSubtitle = priceDetail.subtitle ? priceDetail.subtitle.textContent : "";
    const searchInput = document.getElementById("price-search");
    const regionSelect = document.getElementById("price-region");
    const categoryButtons = Array.from(document.querySelectorAll("[data-category]"));

    const regionList = [
      "Andhra Pradesh",
      "Arunachal Pradesh",
      "Assam",
      "Bihar",
      "Chhattisgarh",
      "Goa",
      "Gujarat",
      "Haryana",
      "Himachal Pradesh",
      "Jharkhand",
      "Karnataka",
      "Kerala",
      "Madhya Pradesh",
      "Maharashtra",
      "Manipur",
      "Meghalaya",
      "Mizoram",
      "Nagaland",
      "Odisha",
      "Punjab",
      "Rajasthan",
      "Sikkim",
      "Tamil Nadu",
      "Telangana",
      "Tripura",
      "Uttar Pradesh",
      "Uttarakhand",
      "West Bengal",
      "Andaman and Nicobar Islands",
      "Chandigarh",
      "Dadra and Nagar Haveli and Daman and Diu",
      "Delhi",
      "Jammu and Kashmir",
      "Ladakh",
      "Lakshadweep",
      "Puducherry",
    ];

    if (regionSelect) {
      regionList.forEach((region) => {
        const option = document.createElement("option");
        option.value = region;
        option.textContent = region;
        regionSelect.appendChild(option);
      });
    }

    const cropCatalog = [
      { name: "Tomato", category: "Vegetables", unit: "kg" },
      { name: "Onion", category: "Vegetables", unit: "kg" },
      { name: "Potato", category: "Vegetables", unit: "kg" },
      { name: "Okra", category: "Vegetables", unit: "kg" },
      { name: "Apple", category: "Fruits", unit: "kg" },
      { name: "Banana", category: "Fruits", unit: "kg" },
      { name: "Mango", category: "Fruits", unit: "kg" },
      { name: "Grapes", category: "Fruits", unit: "kg" },
      { name: "Spinach", category: "Leafy", unit: "kg" },
      { name: "Coriander", category: "Leafy", unit: "kg" },
      { name: "Rice", category: "Other", unit: "kg" },
      { name: "Wheat", category: "Other", unit: "kg" },
      { name: "Maize", category: "Other", unit: "kg" },
    ];

    const priceRows = cropCatalog.flatMap((crop, cropIndex) =>
      regionList.map((region, regionIndex) => {
        const base = 20 + cropIndex * 4 + ((regionIndex * 7) % 15);
        const variance = (region.length % 5) - 2;
        const price = Math.max(16, base + variance);
        const previous = Math.max(12, price - (2 + (regionIndex % 4)));
        return {
          crop: crop.name,
          category: crop.category,
          region,
          price,
          previous,
          unit: crop.unit,
        };
      })
    );

    let activeCategory = "all";
    let activeCrop = cropCatalog[0]?.name || null;

    const formatPrice = (value, unit) => `Rs ${value}/${unit}`;

    const getRowsForCrop = (cropName) => priceRows.filter((item) => item.crop === cropName);

    const getAveragePrices = (rows) => {
      if (!rows.length) return { price: 0, previous: 0 };
      const totals = rows.reduce(
        (acc, row) => {
          acc.price += row.price;
          acc.previous += row.previous;
          return acc;
        },
        { price: 0, previous: 0 }
      );
      return {
        price: Math.round(totals.price / rows.length),
        previous: Math.round(totals.previous / rows.length),
      };
    };

    const updateDetail = (cropName) => {
      if (!cropName) return;
      const rows = getRowsForCrop(cropName);
      if (!rows.length) return;

      const regionValue = regionSelect ? regionSelect.value : "all";
      const regionAllLabel = regionSelect ? regionSelect.options[0].textContent : "All Regions";
      const selectedRegion = regionValue === "all" ? null : regionValue;

      if (priceDetail.name) priceDetail.name.textContent = cropName;
      if (priceDetail.subtitle) {
        priceDetail.subtitle.textContent = `${rows[0].category} - ${regionAllLabel}`;
      }

      if (priceDetail.rows) {
        priceDetail.rows.innerHTML = "";
        rows.forEach((row) => {
          const rowEl = document.createElement("div");
          rowEl.className = `price-detail-table-row${selectedRegion === row.region ? " is-highlight" : ""}`;
          rowEl.innerHTML = `
            <span>${row.region}</span>
            <strong>${formatPrice(row.price, row.unit)}</strong>
            <span>${formatPrice(row.previous, row.unit)}</span>
          `;
          priceDetail.rows.appendChild(rowEl);
        });
      }
    };

    const clearDetail = () => {
      if (priceDetail.name) priceDetail.name.textContent = "-";
      if (priceDetail.subtitle) priceDetail.subtitle.textContent = defaultDetailSubtitle;
      if (priceDetail.rows) priceDetail.rows.innerHTML = "";
    };

    const renderPrices = () => {
      const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
      const region = regionSelect ? regionSelect.value : "all";
      const filtered = cropCatalog.filter((item) => {
        const matchesCategory = activeCategory === "all" || item.category === activeCategory;
        const matchesQuery = !query || item.name.toLowerCase().includes(query);
        return matchesCategory && matchesQuery;
      });
      const lastYearLabel = priceGrid.dataset.lastYearLabel || "last year";
      const regionLabel = regionSelect
        ? regionSelect.options[regionSelect.selectedIndex].textContent
        : "All Regions";

      priceGrid.innerHTML = "";
      if (!filtered.length) {
        clearDetail();
        return;
      }

      if (!activeCrop || !filtered.some((item) => item.name === activeCrop)) {
        activeCrop = filtered[0].name;
      }

      filtered.forEach((item) => {
        const rows = getRowsForCrop(item.name);
        const average = getAveragePrices(rows);
        const displayRow =
          region === "all"
            ? {
                price: average.price,
                previous: average.previous,
                region: regionLabel,
                unit: item.unit,
              }
            : rows.find((row) => row.region === region);

        if (!displayRow) return;

        const card = document.createElement("button");
        card.type = "button";
        card.className = `price-card${item.name === activeCrop ? " is-active" : ""}`;
        card.innerHTML = `
          <div class="price-card-header">
            <h4 class="price-card-title">${item.name}</h4>
            <span class="price-card-tag">${item.category}</span>
          </div>
          <p class="price-card-price">${formatPrice(displayRow.price, item.unit)}</p>
          <p class="price-card-meta">${displayRow.region} - ${formatPrice(displayRow.previous, item.unit)} ${lastYearLabel}</p>
        `;
        card.addEventListener("click", () => {
          activeCrop = item.name;
          updateDetail(activeCrop);
          renderPrices();
        });
        priceGrid.appendChild(card);
      });

      updateDetail(activeCrop);
    };

    categoryButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeCategory = button.dataset.category;
        categoryButtons.forEach((btn) => btn.classList.toggle("is-active", btn === button));
        renderPrices();
      });
    });

    if (searchInput) {
      searchInput.addEventListener("input", renderPrices);
    }

    if (regionSelect) {
      regionSelect.addEventListener("change", () => {
        renderPrices();
        updateDetail(activeCrop);
      });
    }

    renderPrices();
  }

  const feedbackForm = document.getElementById("feedback-form");
  const feedbackSuccess = document.getElementById("feedback-success");
  if (feedbackForm && feedbackSuccess) {
    feedbackForm.addEventListener("submit", (event) => {
      event.preventDefault();
      feedbackForm.reset();
      feedbackSuccess.hidden = false;
      window.setTimeout(() => {
        feedbackSuccess.hidden = true;
      }, 2500);
    });
  }
})();
