(() => {
  const liveButton = document.getElementById("use-live-location");
  const mapButton = document.getElementById("pick-on-map");
  const closeMapButton = document.getElementById("close-map");
  const mapPanel = document.getElementById("map-panel");
  const useMapPointButton = document.getElementById("use-map-point");
  const mapContainer = document.getElementById("location-map");
  const locationInput = document.getElementById("location");
  const locationStatus = document.getElementById("location-status");
  const cropFilterInput = document.getElementById("crop-filter");
  const allCropsTable = document.getElementById("all-crops-table");

  if (!liveButton || !locationInput || !locationStatus) {
    return;
  }

  let mapRef = null;
  let markerRef = null;
  let selectedPoint = null;

  const setStatus = (message, type = "") => {
    locationStatus.textContent = message;
    locationStatus.classList.remove("text-slate-500", "text-emerald-700", "text-rose-700");
    if (type === "ok") {
      locationStatus.classList.add("text-emerald-700");
      return;
    }
    if (type === "error") {
      locationStatus.classList.add("text-rose-700");
      return;
    }
    locationStatus.classList.add("text-slate-500");
  };

  const resolveLocation = async (lat, lon) => {
    const resolveUrl = window.resolveLocationUrl;
    if (!resolveUrl) {
      throw new Error("Location resolver is not configured.");
    }

    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
    });

    const response = await fetch(`${resolveUrl}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Could not resolve your location.");
    }

    return response.json();
  };

  const openMap = () => {
    if (!mapPanel || !mapContainer || typeof L === "undefined") {
      setStatus("Map component could not be loaded.", "error");
      return;
    }

    mapPanel.hidden = false;

    if (!mapRef) {
      mapRef = L.map("location-map").setView([18.52, 73.85], 6);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(mapRef);

      mapRef.on("click", (event) => {
        const { lat, lng } = event.latlng;
        selectedPoint = { lat, lon: lng };

        if (markerRef) {
          markerRef.setLatLng(event.latlng);
        } else {
          markerRef = L.marker(event.latlng).addTo(mapRef);
        }

        setStatus(`Selected map point: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      });
    }

    setTimeout(() => mapRef.invalidateSize(), 180);
  };

  const closeMap = () => {
    if (mapPanel) {
      mapPanel.hidden = true;
    }
  };

  liveButton.addEventListener("click", async () => {
    if (!navigator.geolocation) {
      setStatus("Geolocation is not supported in this browser.", "error");
      return;
    }

    setStatus("Detecting your location...");
    liveButton.disabled = true;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const payload = await resolveLocation(latitude, longitude);
          locationInput.value = payload.location || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setStatus(`Live location detected: ${locationInput.value}`, "ok");
        } catch (error) {
          setStatus(error.message || "Unable to resolve live location.", "error");
        } finally {
          liveButton.disabled = false;
        }
      },
      () => {
        setStatus("Location permission denied. Enter location manually.", "error");
        liveButton.disabled = false;
      },
      {
        timeout: 10000,
        enableHighAccuracy: true,
      }
    );
  });

  mapButton?.addEventListener("click", () => {
    openMap();
  });

  closeMapButton?.addEventListener("click", () => {
    closeMap();
  });

  useMapPointButton?.addEventListener("click", async () => {
    if (!selectedPoint) {
      setStatus("Tap on the map to select a point first.", "error");
      return;
    }

    try {
      setStatus("Resolving selected map point...");
      useMapPointButton.disabled = true;
      const payload = await resolveLocation(selectedPoint.lat, selectedPoint.lon);
      locationInput.value = payload.location || `${selectedPoint.lat.toFixed(4)}, ${selectedPoint.lon.toFixed(4)}`;
      setStatus(`Map location selected: ${locationInput.value}`, "ok");
      closeMap();
    } catch (error) {
      setStatus(error.message || "Could not resolve selected map point.", "error");
    } finally {
      useMapPointButton.disabled = false;
    }
  });

  if (cropFilterInput && allCropsTable) {
    cropFilterInput.addEventListener("input", () => {
      const query = cropFilterInput.value.trim().toLowerCase();
      const rows = Array.from(allCropsTable.querySelectorAll("tbody tr"));
      rows.forEach((row) => {
        const cropName = (row.children[0]?.textContent || "").toLowerCase();
        row.style.display = cropName.includes(query) ? "" : "none";
      });
    });
  }
})();
