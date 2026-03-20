(function () {
  const sectionButtons = Array.from(document.querySelectorAll("[data-section-target]"));
  const sections = Array.from(document.querySelectorAll("[data-section-panel]"));

  const activateSection = (target) => {
    sections.forEach((section) => {
      section.classList.toggle("is-active", section.dataset.sectionPanel === target);
    });
    sectionButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.sectionTarget === target);
    });
  };

  sectionButtons.forEach((button) => {
    button.addEventListener("click", () => activateSection(button.dataset.sectionTarget));
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
      current: document.getElementById("price-detail-current"),
      previous: document.getElementById("price-detail-previous"),
      region: document.getElementById("price-detail-region"),
      category: document.getElementById("price-detail-category"),
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

    const priceData = [
      { crop: "Tomato", category: "Vegetables", region: "Maharashtra", price: 28, previous: 24, unit: "kg" },
      { crop: "Onion", category: "Vegetables", region: "Gujarat", price: 32, previous: 30, unit: "kg" },
      { crop: "Potato", category: "Vegetables", region: "Uttar Pradesh", price: 26, previous: 25, unit: "kg" },
      { crop: "Okra", category: "Vegetables", region: "Telangana", price: 34, previous: 31, unit: "kg" },
      { crop: "Apple", category: "Fruits", region: "Himachal Pradesh", price: 110, previous: 98, unit: "kg" },
      { crop: "Banana", category: "Fruits", region: "Tamil Nadu", price: 46, previous: 41, unit: "kg" },
      { crop: "Mango", category: "Fruits", region: "Andhra Pradesh", price: 75, previous: 70, unit: "kg" },
      { crop: "Grapes", category: "Fruits", region: "Maharashtra", price: 88, previous: 82, unit: "kg" },
      { crop: "Spinach", category: "Leafy", region: "Punjab", price: 22, previous: 19, unit: "kg" },
      { crop: "Coriander", category: "Leafy", region: "Karnataka", price: 18, previous: 16, unit: "kg" },
      { crop: "Rice", category: "Other", region: "West Bengal", price: 32, previous: 30, unit: "kg" },
      { crop: "Wheat", category: "Other", region: "Rajasthan", price: 29, previous: 27, unit: "kg" },
      { crop: "Maize", category: "Other", region: "Bihar", price: 24, previous: 22, unit: "kg" },
    ];

    let activeCategory = "all";

    const formatPrice = (value, unit) => `Rs ${value}/${unit}`;

    const updateDetail = (item) => {
      if (!item) return;
      if (priceDetail.name) priceDetail.name.textContent = item.crop;
      if (priceDetail.subtitle) {
        priceDetail.subtitle.textContent = `${item.category} - ${item.region}`;
      }
      if (priceDetail.current) priceDetail.current.textContent = formatPrice(item.price, item.unit);
      if (priceDetail.previous) priceDetail.previous.textContent = formatPrice(item.previous, item.unit);
      if (priceDetail.region) priceDetail.region.textContent = item.region;
      if (priceDetail.category) priceDetail.category.textContent = item.category;
    };

    const clearDetail = () => {
      if (priceDetail.name) priceDetail.name.textContent = "-";
      if (priceDetail.subtitle) priceDetail.subtitle.textContent = defaultDetailSubtitle;
      if (priceDetail.current) priceDetail.current.textContent = "-";
      if (priceDetail.previous) priceDetail.previous.textContent = "-";
      if (priceDetail.region) priceDetail.region.textContent = "-";
      if (priceDetail.category) priceDetail.category.textContent = "-";
    };

    const renderPrices = () => {
      const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
      const region = regionSelect ? regionSelect.value : "all";
      const filtered = priceData.filter((item) => {
        const matchesCategory = activeCategory === "all" || item.category === activeCategory;
        const matchesRegion = region === "all" || item.region === region;
        const matchesQuery = !query || item.crop.toLowerCase().includes(query);
        return matchesCategory && matchesRegion && matchesQuery;
      });
      const lastYearLabel = priceGrid.dataset.lastYearLabel || "last year";

      priceGrid.innerHTML = "";
      if (!filtered.length) {
        clearDetail();
        return;
      }

      filtered.forEach((item) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "price-card";
        card.innerHTML = `
          <div class="price-card-header">
            <h4 class="price-card-title">${item.crop}</h4>
            <span class="price-card-tag">${item.category}</span>
          </div>
          <p class="price-card-price">${formatPrice(item.price, item.unit)}</p>
          <p class="price-card-meta">${item.region} - ${formatPrice(item.previous, item.unit)} ${lastYearLabel}</p>
        `;
        card.addEventListener("click", () => updateDetail(item));
        priceGrid.appendChild(card);
      });

      updateDetail(filtered[0]);
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
      regionSelect.addEventListener("change", renderPrices);
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
