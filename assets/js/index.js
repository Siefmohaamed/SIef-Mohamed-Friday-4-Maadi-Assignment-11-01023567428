(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const text = (selector, value) => {
    const el = $(selector);
    if (el) el.textContent = value ?? "—";
  };
  const safe = (value, fallback = "—") =>
    value === null || value === undefined || value === "" ? fallback : value;
  const escapeHTML = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  const number = (value, digits = 2) =>
    Number.isFinite(Number(value))
      ? Number(value).toLocaleString(undefined, {
          maximumFractionDigits: digits,
        })
      : "—";
  const parseApiDate = (value, fallback = "") => {
    if (!value) value = fallback;
    if (!value) return null;
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? `${value}T00:00:00Z`
      : value;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime())
      ? fallback && value !== fallback
        ? parseApiDate(fallback)
        : null
      : parsed;
  };
  const dateFormat = (
    date,
    options = { dateStyle: "medium", timeZone: "UTC" },
  ) => {
    const parsed = parseApiDate(date);
    return parsed
      ? new Intl.DateTimeFormat(undefined, options).format(parsed)
      : "Date TBD";
  };
  const request = async (url, options = {}) => {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  };

  // Navigation and mobile menu
  const sidebar = $("#sidebar");
  const closeSidebar = () => {
    sidebar?.classList.remove("sidebar-open");
    $(".sidebar-overlay")?.remove();
  };
  const sections = $$(".app-section");
  const navLinks = $$(".nav-link");
  function showSection(sectionId) {
    const destination = sections.find((section) => section.id === sectionId);
    if (!destination) return;
    sections.forEach((section) => {
      const isActive = section === destination;
      section.classList.toggle("hidden", !isActive);
      section.style.display = isActive ? "block" : "none";
      section.setAttribute("aria-hidden", String(!isActive));
    });
    navLinks.forEach((link) => {
      const isActive = link.dataset.section === sectionId;
      link.classList.toggle("bg-blue-500/10", isActive);
      link.classList.toggle("text-blue-400", isActive);
      link.classList.toggle("text-slate-300", !isActive);
      link.setAttribute("aria-current", isActive ? "page" : "false");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  navLinks.forEach((link) =>
    link.addEventListener("click", (event) => {
      showSection(link.dataset.section);
      closeSidebar();
    }),
  );
  window.addEventListener("hashchange", () => {
    const sectionId = window.location.hash.slice(1);
    if (sections.some((section) => section.id === sectionId))
      showSection(sectionId);
  });
  showSection("today-in-space");
  $("#sidebar-toggle")?.addEventListener("click", () => {
    sidebar?.classList.toggle("sidebar-open");
    if (sidebar?.classList.contains("sidebar-open")) {
      const overlay = document.createElement("div");
      overlay.className = "sidebar-overlay";
      overlay.addEventListener("click", closeSidebar);
      document.body.append(overlay);
    } else closeSidebar();
  });

  // NASA Astronomy Picture of the Day
  const apodEndpoint = "https://science.nasa.gov/wp-json/wp/v2/apod-basic/";
  const apodDate = $("#apod-date-input");
  const dateWrapper = $(".date-input-wrapper");
  const maxDate = new Date().toISOString().slice(0, 10);
  if (apodDate) {
    apodDate.max = maxDate;
    apodDate.value = maxDate;
  }
  const updateDateLabel = () => {
    if (dateWrapper && apodDate?.value) {
      dateWrapper.dataset.date = dateFormat(`${apodDate.value}T00:00:00`, {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
      const label = $("span", dateWrapper);
      if (label) label.textContent = dateWrapper.dataset.date;
    }
  };
  const showApodError = (message) => {
    const box = $("#apod-image-container");
    if (box)
      box.innerHTML = `<div class="p-8 text-center text-slate-300"><i class="fas fa-cloud-moon text-4xl text-blue-400 mb-4"></i><p>${message}</p><button id="retry-apod" class="mt-4 px-4 py-2 bg-blue-500 rounded-lg">Try again</button></div>`;
    $("#retry-apod")?.addEventListener("click", () => loadApod(apodDate.value));
  };
  async function loadApod(date = maxDate) {
    const box = $("#apod-image-container");
    if (!box) return;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      date < "1995-06-16" ||
      date > maxDate
    ) {
      showApodError("Choose a date between June 16, 1995 and today.");
      return;
    }
    box.innerHTML =
      '<div class="text-center"><i class="fas fa-spinner fa-spin text-4xl text-blue-400 mb-4"></i><p class="text-slate-400">Loading NASA image…</p></div>';
    try {
      const data = await request(
        `${apodEndpoint}?date=${encodeURIComponent(date)}`,
      );
      const item = Array.isArray(data) ? data[0] : data;
      if (!item) throw new Error("No image was published for this date.");
      text("#apod-title", item.title);
      const publishedDate = parseApiDate(item.date, date) || parseApiDate(date);
      const publishedDateLabel = publishedDate
        ? new Intl.DateTimeFormat(undefined, {
            dateStyle: "long",
            timeZone: "UTC",
          }).format(publishedDate)
        : date;
      const publishedDateValue = publishedDate
        ? publishedDate.toISOString().slice(0, 10)
        : date;
      text(
        "#apod-date",
        `Astronomy Picture of the Day · ${publishedDateLabel}`,
      );
      text("#apod-date-detail", ` ${publishedDateValue}`);
      text(
        "#apod-explanation",
        item.explanation ||
          "NASA has not provided an explanation for this image.",
      );
      text(
        "#apod-copyright",
        item.copyright ? `© ${item.copyright}` : "Image courtesy of NASA",
      );
      text("#apod-date-info", publishedDateValue);
      text("#apod-media-type", item.media_type === "video" ? "Video" : "Image");
      box.innerHTML = "";
      if (item.media_type === "video") {
        const frame = document.createElement("iframe");
        frame.src = item.url;
        frame.title = item.title || "NASA Astronomy Picture of the Day";
        frame.allowFullscreen = true;
        frame.className =
          "w-full h-full min-h-[300px] md:min-h-[400px] lg:min-h-[600px]";
        box.append(frame);
      } else {
        const image = document.createElement("img");
        image.id = "apod-image";
        image.className = "w-full h-full object-cover";
        image.src = item.hdurl || item.url;
        image.alt =
          item.alt || item.title || "NASA Astronomy Picture of the Day";
        box.append(image);
        const fullResolution = document.createElement("a");
        fullResolution.href = item.hdurl || item.url;
        fullResolution.target = "_blank";
        fullResolution.rel = "noopener noreferrer";
        fullResolution.className =
          "absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg bg-black/60 text-white font-semibold backdrop-blur-md";
        fullResolution.innerHTML =
          '<i class="fas fa-expand mr-2"></i>View full resolution';
        box.append(fullResolution);
      }
    } catch (error) {
      showApodError(`NASA data could not be loaded. ${error.message}`);
    }
  }
  $("#load-date-btn")?.addEventListener("click", () => {
    updateDateLabel();
    loadApod(apodDate.value);
  });
  $("#today-apod-btn")?.addEventListener("click", () => {
    if (apodDate) apodDate.value = maxDate;
    updateDateLabel();
    loadApod(maxDate);
  });
  apodDate?.addEventListener("change", updateDateLabel);
  updateDateLabel();
  loadApod();

  // Launch Library 2
  const launchGrid = $("#launches-grid");
  const launchEndpoint =
    "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=10";
  const featureStyles = document.createElement("style");
  featureStyles.textContent =
    "@media (min-width: 1024px) {.launch-feature-art { position: absolute; inset: 0 0 0 50%; display: block; }} @media (max-width: 1023px) {.launch-feature-art { display: none; }}";
  document.head.append(featureStyles);
  const launchStatus = (launch) =>
    launch.status?.abbrev || launch.status?.name || "Status unknown";
  const launchStatusClass = (launch) => {
    const status = launchStatus(launch).toLowerCase();
    if (status === "go" || status.includes("success"))
      return "bg-green-500/90 text-white";
    if (status.includes("tbc") || status.includes("hold"))
      return "bg-amber-500/90 text-white";
    return "bg-slate-700/90 text-white";
  };
  // Launch Library 2 v2.3.0 returns images as objects ({ image_url, thumbnail_url, ... });
  // older versions returned plain URL strings. Support both.
  const imageUrlOf = (value) =>
    typeof value === "string"
      ? value
      : value?.image_url || value?.thumbnail_url || "";
  const launchImage = (launch) =>
    imageUrlOf(launch.image) ||
    imageUrlOf(launch.launch_service_provider?.image) ||
    imageUrlOf(launch.launch_service_provider?.featured_image) ||
    imageUrlOf(launch.rocket?.configuration?.image) ||
    "";
  // If an image URL is dead, swap in the rocket icon instead of a broken-image box.
  const imageFallback = (iconClass) =>
    `this.replaceWith(Object.assign(document.createElement('i'),{className:'${iconClass}'}))`;
  const countryName = (location) => {
    const code = location?.country_code;
    const names = {
      CHN: "China",
      USA: "United States",
      IND: "India",
      NZL: "New Zealand",
      FRA: "France",
      JPN: "Japan",
      RUS: "Russia",
      KAZ: "Kazakhstan",
      IRN: "Iran",
      KOR: "South Korea",
    };
    return location?.country?.name || names[code] || code || "TBA";
  };
  function renderLaunchCard(launch) {
    const name = safe(launch.name, "Unnamed mission");
    const agency = safe(launch.launch_service_provider?.name, "Agency TBA");
    const rocket = safe(
      launch.rocket?.configuration?.full_name ||
        launch.rocket?.configuration?.name,
      "Rocket TBA",
    );
    const pad = safe(launch.pad?.name, "Launch site TBA");
    const location = safe(launch.pad?.location?.name, "Location TBA");
    const imageUrl = launchImage(launch);
    const card = document.createElement("article");
    card.className =
      "bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all group";
    const image = imageUrl
      ? `<img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(name)}" class="w-full h-full object-cover" loading="lazy" onerror="${imageFallback("fas fa-rocket text-5xl text-slate-700")}">`
      : '<i class="fas fa-rocket text-5xl text-slate-700"></i>';
    card.innerHTML = `<div class="relative h-48 bg-slate-900/50 flex items-center justify-center overflow-hidden">${image}<span class="absolute top-3 right-3 px-3 py-1 ${launchStatusClass(launch)} rounded-full text-xs font-semibold">${escapeHTML(launchStatus(launch))}</span></div><div class="p-5"><h4 class="font-bold text-lg mb-2 line-clamp-2 group-hover:text-blue-400">${escapeHTML(name)}</h4><p class="text-sm text-slate-400 mb-4"><i class="fas fa-building text-xs mr-2"></i>${escapeHTML(agency)}</p><div class="space-y-2 mb-4 text-sm"><p><i class="fas fa-calendar text-slate-500 w-5"></i><span class="text-slate-300">${dateFormat(launch.net, { dateStyle: "medium", timeZone: "UTC" })}</span></p><p><i class="fas fa-clock text-slate-500 w-5"></i><span class="text-slate-300">${launch.net ? dateFormat(launch.net, { timeStyle: "short", timeZone: "UTC" }) + " UTC" : "Time TBD"}</span></p><p><i class="fas fa-rocket text-slate-500 w-5"></i><span class="text-slate-300">${escapeHTML(rocket)}</span></p><p><i class="fas fa-map-marker-alt text-slate-500 w-5"></i><span class="text-slate-300">${escapeHTML(pad)} · ${escapeHTML(location)}</span></p></div><div class="flex items-center gap-2 pt-4 border-t border-slate-700"><a href="${escapeHTML(launch.url || "#")}" target="_blank" rel="noopener noreferrer" class="flex-1 px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 text-sm font-semibold text-center">Details</a><button type="button" aria-label="Save launch" aria-pressed="false" class="launch-favorite px-3 py-2 bg-slate-700 rounded-lg hover:bg-slate-600"><i class="far fa-heart"></i></button></div></div>`;
    $(".launch-favorite", card).addEventListener("click", (event) => {
      const button = event.currentTarget;
      const active = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(active));
      button.innerHTML = `<i class="${active ? "fas text-pink-400" : "far"} fa-heart"></i>`;
    });
    return card;
  }
  async function loadLaunches() {
    if (!launchGrid) return;
    launchGrid.innerHTML =
      '<p class="text-slate-400 col-span-full"><i class="fas fa-spinner fa-spin mr-2"></i>Loading upcoming launches…</p>';
    try {
      const data = await request(launchEndpoint);
      const launches = data.results || [];
      launchGrid.replaceChildren(...launches.map(renderLaunchCard));
      text("#launches-count", `${launches.length} Launches`);
      text("#launches-count-mobile", String(launches.length));
      if (!launches.length)
        launchGrid.innerHTML =
          '<p class="text-slate-400 col-span-full">No upcoming launches are listed right now.</p>';
      const featured = launches[0];
      if (featured) {
        const host = $("#featured-launch");
        host.innerHTML = "";
        const panel = document.createElement("div");
        panel.className =
          "relative overflow-hidden bg-slate-800/30 border border-slate-700 rounded-3xl group hover:border-blue-500/50 transition-all";
        const featuredImage = launchImage(featured);
        const countdown = featured.net
          ? Math.max(
              0,
              Math.ceil(
                (new Date(featured.net).getTime() - Date.now()) / 86400000,
              ),
            )
          : null;
        const imageMarkup = featuredImage
          ? `<img src="${escapeHTML(featuredImage)}" alt="${escapeHTML(featured.name || "Featured launch")}" class="absolute inset-0 w-full h-full object-cover opacity-70" loading="lazy" onerror="this.remove()">`
          : '<div class="absolute inset-0 flex items-center justify-center bg-slate-900/60"><i class="fas fa-rocket text-9xl text-slate-700/60"></i></div>';
        panel.innerHTML = `<div class="launch-feature-art">${imageMarkup}<div class="absolute inset-0" style="background:linear-gradient(90deg,rgba(15,23,42,.88),rgba(15,23,42,.12) 38%,rgba(15,23,42,.16))"></div></div><div class="relative grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 md:p-8 lg:p-10"><div><div class="flex flex-wrap items-center gap-3 mb-5"><span class="px-4 py-1.5 bg-blue-500/20 text-blue-300 rounded-full text-sm font-semibold"><i class="fas fa-star mr-2"></i>Featured Launch</span><span class="px-4 py-1.5 ${launchStatusClass(featured)} rounded-full text-sm font-semibold">${escapeHTML(launchStatus(featured))}</span></div><h3 class="text-2xl md:text-3xl font-bold mb-4 leading-tight">${escapeHTML(safe(featured.name, "Upcoming mission"))}</h3><div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-300 mb-6"><span><i class="fas fa-building mr-2 text-slate-400"></i>${escapeHTML(safe(featured.launch_service_provider?.name, "Agency TBA"))}</span><span><i class="fas fa-rocket mr-2 text-slate-400"></i>${escapeHTML(safe(featured.rocket?.configuration?.full_name, "Rocket TBA"))}</span></div><div class="inline-flex items-center gap-3 px-5 py-3 bg-blue-500/20 rounded-xl mb-6"><i class="fas fa-clock text-2xl text-blue-400"></i><div><p class="text-2xl font-bold text-blue-300">${countdown === null ? "—" : countdown}</p><p class="text-xs text-slate-300">Days Until Launch</p></div></div><div class="grid sm:grid-cols-2 gap-3 mb-5"><div class="bg-slate-900/50 rounded-xl p-4"><p class="text-xs text-slate-400 mb-1"><i class="fas fa-calendar mr-2"></i>Launch Date</p><p class="font-semibold">${dateFormat(featured.net, { dateStyle: "full", timeZone: "UTC" })}</p></div><div class="bg-slate-900/50 rounded-xl p-4"><p class="text-xs text-slate-400 mb-1"><i class="fas fa-clock mr-2"></i>Launch Time</p><p class="font-semibold">${featured.net ? `${dateFormat(featured.net, { timeStyle: "short", timeZone: "UTC" })} UTC` : "TBD"}</p></div><div class="bg-slate-900/50 rounded-xl p-4"><p class="text-xs text-slate-400 mb-1"><i class="fas fa-map-marker-alt mr-2"></i>Location</p><p class="font-semibold text-sm">${escapeHTML(safe(featured.pad?.name, "Launch site TBA"))}, ${escapeHTML(safe(featured.pad?.location?.name, "Location TBA"))}</p></div><div class="bg-slate-900/50 rounded-xl p-4"><p class="text-xs text-slate-400 mb-1"><i class="fas fa-globe mr-2"></i>Country</p><p class="font-semibold">${escapeHTML(countryName(featured.pad?.location))}</p></div></div><p class="text-slate-300 leading-relaxed mb-5">${escapeHTML(safe(featured.mission?.description, "Mission details will be announced by the launch provider."))}</p><div class="flex flex-col sm:flex-row gap-3"><a href="${escapeHTML(featured.url || "#")}" target="_blank" rel="noopener noreferrer" class="flex-1 px-6 py-3 bg-blue-500 rounded-xl hover:bg-blue-600 font-semibold text-center"><i class="fas fa-info-circle mr-2"></i>View Full Details</a><button type="button" class="featured-favorite px-4 py-3 bg-slate-700 rounded-xl hover:bg-slate-600" aria-label="Save featured launch" aria-pressed="false"><i class="far fa-heart"></i></button><button type="button" class="featured-reminder px-4 py-3 bg-slate-700 rounded-xl hover:bg-slate-600" aria-label="Launch reminder"><i class="fas fa-bell"></i></button></div></div><div class="hidden lg:block min-h-[420px]"></div></div>`;
        $(".featured-favorite", panel)?.addEventListener("click", (event) => {
          const button = event.currentTarget;
          const active = button.getAttribute("aria-pressed") !== "true";
          button.setAttribute("aria-pressed", String(active));
          button.innerHTML = `<i class="${active ? "fas text-pink-400" : "far"} fa-heart"></i>`;
        });
        $(".featured-reminder", panel)?.addEventListener("click", (event) => {
          const button = event.currentTarget;
          button.innerHTML = '<i class="fas fa-bell text-blue-300"></i>';
          button.title = "Reminder saved for this visit";
        });
        host.append(panel);
      }
    } catch (error) {
      launchGrid.innerHTML = `<p class="text-slate-300 col-span-full">Launch data could not be loaded. ${error.message} <button id="retry-launches" class="text-blue-400 underline">Try again</button></p>`;
      $("#retry-launches")?.addEventListener("click", loadLaunches);
    }
  }
  loadLaunches();

  // Solar System OpenData requires a free bearer token. Keep it in this browser only.
  const planetsGrid = $("#planets-grid");
  const planetNames = [
    "uranus",
    "neptune",
    "jupiter",
    "mars",
    "mercury",
    "saturn",
    "earth",
    "venus",
  ];
  const planetColors = {
    mercury: "#eab308",
    venus: "#f97316",
    earth: "#3b82f6",
    mars: "#ef4444",
    jupiter: "#fb923c",
    saturn: "#facc15",
    uranus: "#06b6d4",
    neptune: "#2563eb",
  };
  const planetTypes = {
    mercury: "Terrestrial",
    venus: "Terrestrial",
    earth: "Terrestrial",
    mars: "Terrestrial",
    jupiter: "Gas Giant",
    saturn: "Gas Giant",
    uranus: "Ice Giant",
    neptune: "Ice Giant",
  };
  const planetDescriptions = {
    mercury:
      "Mercury is the smallest planet in the Solar System and the closest to the Sun. Its orbit around the Sun takes 87.97 Earth days, the shortest of all the planets in the Solar System.",
    venus:
      "Venus is the second planet from the Sun. It is named after the Roman goddess of love and beauty. As the second-brightest natural object in the night sky after the Moon, Venus can cast shadows.",
    earth:
      "Earth is the third planet from the Sun and the only astronomical object known to harbor life. About 29% of Earth's surface is land consisting of continents and islands. The remaining 71% is covered with water.",
    mars: "Mars is the fourth planet from the Sun and the second-smallest planet in the Solar System. Named after the Roman god of war, it is often referred to as the 'Red Planet' due to its reddish appearance.",
    jupiter:
      "Jupiter is the fifth planet from the Sun and the largest in the Solar System. It is a gas giant with a mass one-thousandth that of the Sun, but two-and-a-half times that of all the other planets combined.",
    saturn:
      "Saturn is the sixth planet from the Sun and the second-largest in the Solar System. It is a gas giant with an average radius about nine times that of Earth, and is best known for its extensive ring system.",
    uranus:
      "Uranus is the seventh planet from the Sun. It has the third-largest planetary radius and fourth-largest planetary mass in the Solar System. Uranus is unique in that it rotates on its side.",
    neptune:
      "Neptune is the eighth and farthest known planet from the Sun in the Solar System. It is the fourth-largest planet by diameter and the third-most-massive planet.",
  };
  const auKm = 149597870.7;
  const planetFallbacks = [
    [
      "Mercury",
      0.387,
      2439.7,
      3.3011,
      23,
      0.0553,
      88,
      1407.6,
      0,
      5427,
      3.7,
      46,
      69.8,
      0.2056,
      7.0,
      0.034,
      440,
      4.25,
    ],
    [
      "Venus",
      0.723,
      6051.8,
      4.8675,
      24,
      0.815,
      224.7,
      -5832.5,
      0,
      5243,
      8.87,
      0,
      108.9,
      0.0068,
      3.39,
      177.4,
      737,
      10.36,
    ],
    [
      "Earth",
      1,
      6371,
      5.9722,
      24,
      1,
      365.25,
      23.93,
      1,
      5514,
      9.81,
      147.1,
      152.1,
      0.0167,
      0,
      23.44,
      288,
      11.19,
    ],
    [
      "Mars",
      1.524,
      3389.5,
      6.4171,
      23,
      0.107,
      687,
      24.62,
      2,
      3933,
      3.71,
      206.7,
      249.3,
      0.0934,
      1.85,
      25.19,
      210,
      5.03,
    ],
    [
      "Jupiter",
      5.203,
      69911,
      1.8982,
      27,
      317.8,
      4331,
      9.93,
      95,
      1326,
      24.79,
      740.6,
      816.4,
      0.0489,
      1.3,
      3.13,
      165,
      59.5,
    ],
    [
      "Saturn",
      9.537,
      58232,
      5.6834,
      26,
      95.16,
      10747,
      10.7,
      146,
      687,
      10.44,
      1352.6,
      1514.5,
      0.0565,
      2.49,
      26.73,
      134,
      35.5,
    ],
    [
      "Uranus",
      19.19,
      25362,
      8.681,
      25,
      14.54,
      30589,
      -17.2,
      28,
      1270,
      8.69,
      2741.3,
      3003.6,
      0.0472,
      0.77,
      97.77,
      76,
      21.3,
    ],
    [
      "Neptune",
      30.07,
      24622,
      1.0241,
      24,
      17.15,
      59800,
      16.1,
      16,
      1638,
      11.15,
      4444.5,
      4545.7,
      0.0086,
      1.77,
      28.32,
      72,
      23.5,
    ],
  ];
  const buildFallbackPlanets = () =>
    planetFallbacks.map(
      ([
        englishName,
        au,
        meanRadius,
        massValue,
        massExponent,
        massEarthRatio,
        sideralOrbit,
        sideralRotation,
        moonCount,
        density,
        gravity,
        perihelionAu,
        aphelionAu,
        eccentricity,
        inclination,
        axialTilt,
        avgTempC,
        escape,
      ]) => {
        const volume = (4 / 3) * Math.PI * meanRadius ** 3;
        const exponent = Math.floor(Math.log10(volume));
        return {
          id: englishName.toLowerCase(),
          englishName,
          isPlanet: true,
          bodyType: ["Jupiter", "Saturn"].includes(englishName)
            ? "Gas Giant"
            : ["Uranus", "Neptune"].includes(englishName)
              ? "Ice Giant"
              : "Terrestrial",
          discoveredBy: "Known since antiquity",
          discoveryDate: "Ancient times",
          semimajorAxis: au * auKm,
          meanRadius,
          mass: { massValue, massExponent },
          massEarthRatio,
          sideralOrbit,
          sideralRotation,
          moons: Array.from({ length: moonCount }),
          density,
          gravity,
          perihelion: perihelionAu * auKm,
          aphelion: aphelionAu * auKm,
          eccentricity,
          inclination,
          axialTilt,
          avgTemp: avgTempC,
          escape,
          vol: { volValue: volume / 10 ** exponent, volExponent: exponent },
        };
      },
    );
  let planetData = buildFallbackPlanets();

  // Optional API-token form. These elements are not in the current HTML, so everything below is null-safe.
  const keyInput = $("#planet-api-key");
  try {
    if (keyInput)
      keyInput.value = localStorage.getItem("cosmosSolarApiKey") || "";
  } catch (_) {
    /* Private browsing can block storage. */
  }
  function fieldNumber(value, unit = "") {
    return value === null || value === undefined
      ? "—"
      : `${number(value)}${unit}`;
  }
  function renderPlanetCards() {
    if (!planetsGrid) return;
    planetsGrid.replaceChildren(
      ...planetNames.map((name) => {
        const body = planetData.find(
          (item) => (item.englishName || item.id || "").toLowerCase() === name,
        );
        const card = document.createElement("button");
        card.type = "button";
        card.dataset.planetId = name;
        card.className =
          "planet-card bg-slate-800/50 border border-slate-700 rounded-2xl p-4 transition-all cursor-pointer group";
        card.setAttribute("aria-pressed", "false");
        card.style.setProperty("--planet-color", planetColors[name]);
        card.innerHTML = `<div class="relative mb-3 h-24 flex items-center justify-center"><img class="w-20 h-20 object-contain group-hover:scale-110 transition-transform" src="./assets/images/${name}.png" alt="${name}"></div><h4 class="font-semibold text-center text-sm capitalize">${name}</h4><p class="text-xs text-slate-400 text-center">${body ? `${number(body.semimajorAxis / 149597870.7, 2)} AU` : "Select to explore"}</p>`;
        return card;
      }),
    );
    const comparison = $("#planet-comparison-tbody");
    if (comparison)
      comparison.innerHTML = [...planetData]
        .sort((first, second) => {
          const firstName = (first.englishName || first.id || "").toLowerCase();
          const secondName = (
            second.englishName ||
            second.id ||
            ""
          ).toLowerCase();
          return (
            planetNames.indexOf(firstName) - planetNames.indexOf(secondName)
          );
        })
        .map((body) => {
          const name = (body.englishName || body.id).toLowerCase();
          const au = body.semimajorAxis / auKm;
          const diameter = body.meanRadius * 2;
          const massRatio =
            body.massEarthRatio ??
            (body.mass
              ? (body.mass.massValue * 10 ** body.mass.massExponent) / 5.9722e24
              : NaN);
          const orbit =
            body.sideralOrbit > 365.25
              ? `${number(body.sideralOrbit / 365.25, 1)} years`
              : `${number(body.sideralOrbit, 0)} days`;
          return `<tr data-planet-id="${name}" tabindex="0" role="button" aria-pressed="false" aria-label="Show ${escapeHTML(body.englishName)} details" class="planet-comparison-row hover:bg-slate-800/30 transition-colors cursor-pointer"><td class="px-4 md:px-6 py-3 md:py-4 sticky left-0 bg-slate-800 z-10"><div class="flex items-center space-x-2 md:space-x-3"><div class="w-6 h-6 md:w-8 md:h-8 rounded-full flex-shrink-0" style="background-color:${planetColors[name]}"></div><span class="font-semibold text-sm md:text-base whitespace-nowrap">${escapeHTML(body.englishName)}</span></div></td><td class="px-4 md:px-6 py-3 md:py-4 text-slate-300">${number(au)}</td><td class="px-4 md:px-6 py-3 md:py-4 text-slate-300">${number(diameter, 0)}</td><td class="px-4 md:px-6 py-3 md:py-4 text-slate-300">${number(massRatio, 3)}</td><td class="px-4 md:px-6 py-3 md:py-4 text-slate-300">${orbit}</td><td class="px-4 md:px-6 py-3 md:py-4 text-slate-300">${body.moons?.length ?? 0}</td><td class="px-4 md:px-6 py-3 md:py-4"><span class="px-2 py-1 rounded text-xs bg-blue-500/30 text-blue-200">${planetTypes[name] || "Planet"}</span></td></tr>`;
        })
        .join("");
  }
  const comparisonBody = $("#planet-comparison-tbody");
  function showPlanet(name) {
    const body = planetData.find(
      (item) => (item.englishName || item.id || "").toLowerCase() === name,
    );
    const card = $(`.planet-card[data-planet-id="${name}"]`, planetsGrid);
    $$(".planet-card", planetsGrid).forEach((item) => {
      const selected = item === card;
      item.setAttribute("aria-pressed", String(selected));
      item.style.borderColor = selected ? planetColors[name] : "";
      item.style.boxShadow = selected
        ? `0 0 0 1px ${planetColors[name]}55`
        : "";
    });
    $$(".planet-comparison-row", comparisonBody).forEach((row) => {
      const selected = row.dataset.planetId === name;
      row.setAttribute("aria-pressed", String(selected));
      row.style.backgroundColor = selected ? `${planetColors[name]}18` : "";
    });
    text(
      "#planet-detail-name",
      body?.englishName || name[0].toUpperCase() + name.slice(1),
    );
    text(
      "#planet-detail-description",
      planetDescriptions[name] || "Planet data is not available right now.",
    );
    text(
      "#planet-distance",
      body ? `${number(body.semimajorAxis / 1e6, 1)}M km` : "—",
    );
    text(
      "#planet-radius",
      body?.meanRadius ? `${number(body.meanRadius)} km` : "—",
    );
    text(
      "#planet-mass",
      body?.mass?.massValue
        ? `${number(body.mass.massValue)} × 10^${body.mass.massExponent} kg`
        : "—",
    );
    text(
      "#planet-density",
      body?.density ? `${number(body.density)} g/cm³` : "—",
    );
    text(
      "#planet-orbital-period",
      body?.sideralOrbit
        ? body.sideralOrbit > 365.25
          ? `${number(body.sideralOrbit / 365.25, 1)} years`
          : `${number(body.sideralOrbit)} days`
        : "—",
    );
    text(
      "#planet-rotation",
      body?.sideralRotation ? `${number(body.sideralRotation)} hours` : "—",
    );
    text("#planet-moons", String(body?.moons?.length ?? "—"));
    text(
      "#planet-gravity",
      body?.gravity ? `${number(body.gravity)} m/s²` : "—",
    );
    text("#planet-discoverer", body?.discoveredBy || "Known since antiquity");
    text("#planet-discovery-date", body?.discoveryDate || "—");
    text("#planet-body-type", planetTypes[name] || body?.bodyType || "Planet");
    text(
      "#planet-volume",
      body?.vol
        ? `${number(body.vol.volValue)} × 10^${body.vol.volExponent} km³`
        : "—",
    );
    text(
      "#planet-perihelion",
      body?.perihelion ? `${number(body.perihelion / 1e6, 1)}M km` : "—",
    );
    text(
      "#planet-aphelion",
      body?.aphelion ? `${number(body.aphelion / 1e6, 1)}M km` : "—",
    );
    text("#planet-eccentricity", fieldNumber(body?.eccentricity));
    text("#planet-inclination", fieldNumber(body?.inclination, "°"));
    text("#planet-axial-tilt", fieldNumber(body?.axialTilt, "°"));
    text(
      "#planet-temp",
      body?.avgTemp ? `${number(body.avgTemp - 273.15)}°C` : "—",
    );
    text("#planet-escape", body?.escape ? `${number(body.escape)} km/s` : "—");
    const detailImage = $("#planet-detail-image");
    if (detailImage) {
      detailImage.src = `./assets/images/${name}.png`;
      detailImage.alt = `${name} illustration`;
    }
    const facts = $("#planet-facts");
    if (facts)
      facts.innerHTML = body
        ? `<li><i class="fas fa-moon text-blue-400 mr-2"></i>${body.moons?.length ?? 0} known moons</li><li><i class="fas fa-temperature-half text-blue-400 mr-2"></i>Mean temperature: ${body.avgTemp ? `${number(body.avgTemp - 273.15)}°C` : "Not available"}</li><li><i class="fas fa-compass text-blue-400 mr-2"></i>Orbital eccentricity: ${number(body.eccentricity)}</li>`
        : "<li>Planet details appear here after connecting the API.</li>";
  }
  planetsGrid?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-planet-id]");
    if (choice && planetsGrid.contains(choice))
      showPlanet(choice.dataset.planetId);
  });
  comparisonBody?.addEventListener("click", (event) => {
    const row = event.target.closest(".planet-comparison-row[data-planet-id]");
    if (row) showPlanet(row.dataset.planetId);
  });
  comparisonBody?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest(".planet-comparison-row[data-planet-id]");
    if (!row) return;
    event.preventDefault();
    showPlanet(row.dataset.planetId);
  });
  $("#planet-key-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const key = (keyInput?.value || "").trim();
    const status = $("#planet-api-message");
    if (!key) {
      if (status) status.textContent = "Enter your API token first.";
      return;
    }
    if (status) status.textContent = "Loading planet data…";
    try {
      const data = await request(
        "https://api.le-systeme-solaire.net/rest/bodies/",
        { headers: { Authorization: `Bearer ${key}` } },
      );
      const livePlanets = (data.bodies || []).filter(
        (body) =>
          body.isPlanet &&
          planetNames.includes((body.englishName || "").toLowerCase()),
      );
      if (livePlanets.length < 8)
        throw new Error(
          "The API returned incomplete planet data. Check the token and try again.",
        );
      planetData = livePlanets.map((body) => ({
        ...body,
        dataSource: "Solar System OpenData",
      }));
      try {
        localStorage.setItem("cosmosSolarApiKey", key);
      } catch (_) {
        /* The current page session still works. */
      }
      renderPlanetCards();
      showPlanet("earth");
      if (status)
        status.textContent =
          "Planet data loaded. Your token is saved in this browser.";
    } catch (error) {
      if (status)
        status.textContent = `Could not load planet data: ${error.message}`;
    }
  });
  $("#clear-planet-key")?.addEventListener("click", () => {
    if (keyInput) keyInput.value = "";
    planetData = buildFallbackPlanets();
    try {
      localStorage.removeItem("cosmosSolarApiKey");
    } catch (_) {
      /* Ignore unavailable storage. */
    }
    renderPlanetCards();
    showPlanet("earth");
    const status = $("#planet-api-message");
    if (status) status.textContent = "Saved token cleared.";
  });
  renderPlanetCards();
  showPlanet("earth");
  if (keyInput?.value) $("#planet-key-form")?.requestSubmit();
})();
