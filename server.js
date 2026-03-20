const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const fetch = require("node-fetch");
const nunjucks = require("nunjucks");
const { SUPPORTED_LANGUAGES, translate } = require("./server/i18n");

const app = express();
const PORT = process.env.PORT || 5000;
const SESSION_SECRET = process.env.SESSION_SECRET || "smart-agri-dev-secret";
const USERS_FILE = path.join(__dirname, "data", "users.json");

const ensureUsersFile = () => {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]), "utf-8");
  }
};

const loadUsers = () => {
  ensureUsersFile();
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
};

const saveUsers = (users) => {
  ensureUsersFile();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
};

const normalizeLocationName = (location) => {
  const clean = String(location || "").trim().replace(/\s+/g, " ");
  return clean.replace(/\b\w/g, (char) => char.toUpperCase());
};

const normalizeLang = (value) => {
  if (!value) {
    return null;
  }
  const cleaned = String(value).trim();
  if (SUPPORTED_LANGUAGES[cleaned]) {
    return cleaned;
  }
  const lowered = cleaned.toLowerCase();
  if (SUPPORTED_LANGUAGES[lowered]) {
    return lowered;
  }
  const match = Object.keys(SUPPORTED_LANGUAGES).find(
    (code) => code.toLowerCase() === lowered
  );
  return match || null;
};

const getLang = (req) => {
  const normalized = normalizeLang(req.query.lang);
  if (normalized) {
    req.session.lang = normalized;
  }
  return req.session.lang || "en";
};

const messageStyles = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-700",
  warning: "bg-amber-50 border-amber-200 text-amber-700",
  danger: "bg-rose-50 border-rose-200 text-rose-700",
  info: "bg-blue-50 border-blue-200 text-blue-700"
};

const addMessage = (req, category, text) => {
  if (!req.session.messages) {
    req.session.messages = [];
  }
  req.session.messages.push({
    category,
    text,
    css: messageStyles[category] || messageStyles.info
  });
};

const messageText = (lang, key) => translate(key, lang);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax"
    }
  })
);

app.use("/static", express.static(path.join(__dirname, "frontend", "static")));

const templatesPath = path.join(__dirname, "frontend", "templates");
nunjucks.configure(templatesPath, {
  autoescape: true,
  express: app,
  noCache: true
});
app.set("view engine", "html");

app.use((req, res, next) => {
  const currentLang = getLang(req);
  res.locals.t = (key) => translate(key, currentLang);
  res.locals.current_lang = currentLang;
  res.locals.supported_languages = Object.entries(SUPPORTED_LANGUAGES).map(
    ([code, label]) => ({ code, label })
  );
  res.locals.session = { username: req.session.username };
  res.locals.requestPath = req.path;
  res.locals.messages = req.session.messages || [];
  req.session.messages = [];
  next();
});

app.get("/set-language", (req, res) => {
  const normalized = normalizeLang(req.query.lang) || "en";
  req.session.lang = normalized;
  const nextPath = req.query.next;
  if (nextPath && String(nextPath).startsWith("/")) {
    return res.redirect(nextPath);
  }
  return res.redirect("/");
});

app.get("/", (req, res) => {
  res.render("landing.html");
});

app.get("/login", (req, res) => {
  if (req.session.username) {
    return res.redirect("/dashboard");
  }
  res.render("login.html");
});

app.post("/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const lang = res.locals.current_lang;
  if (!username || !password) {
    addMessage(req, "danger", messageText(lang, "error_username_password_required"));
    return res.redirect("/login");
  }

  const users = loadUsers();
  const user = users.find((entry) => entry.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    addMessage(req, "danger", messageText(lang, "error_invalid_login"));
    return res.redirect("/login");
  }

  req.session.username = username;
  addMessage(req, "success", messageText(lang, "login_success"));
  return res.redirect("/dashboard");
});

app.get("/signup", (req, res) => {
  res.render("signup.html");
});

app.post("/signup", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const confirmPassword = String(req.body.confirm_password || "");
  const lang = res.locals.current_lang;

  if (!username || !password) {
    addMessage(req, "danger", messageText(lang, "error_username_password_required"));
    return res.redirect("/signup");
  }

  if (password !== confirmPassword) {
    addMessage(req, "danger", messageText(lang, "error_passwords_mismatch"));
    return res.redirect("/signup");
  }

  const users = loadUsers();
  const exists = users.some((entry) => entry.username === username);
  if (exists) {
    addMessage(req, "warning", messageText(lang, "error_username_exists"));
    return res.redirect("/signup");
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  users.push({
    id: Date.now(),
    username,
    passwordHash,
    createdAt: new Date().toISOString()
  });
  saveUsers(users);

  addMessage(req, "success", messageText(lang, "signup_success"));
  return res.redirect("/login");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.route("/dashboard")
  .get((req, res) => {
    if (!req.session.username) {
      addMessage(req, "warning", messageText(res.locals.current_lang, "warning_login_required"));
      return res.redirect("/login");
    }
    res.render("dashboard.html", {
      username: req.session.username,
      result: null,
      selected_season: "Kharif",
      input_location: "",
      input_crop: "",
      location_hint: res.locals.t("location_hint")
    });
  })
  .post((req, res) => {
    if (!req.session.username) {
      addMessage(req, "warning", messageText(res.locals.current_lang, "warning_login_required"));
      return res.redirect("/login");
    }
    res.render("dashboard.html", {
      username: req.session.username,
      result: null,
      selected_season: String(req.body.season || "Kharif").trim(),
      input_location: String(req.body.location || "").trim(),
      input_crop: String(req.body.crop_type || "").trim(),
      location_hint: res.locals.t("location_hint")
    });
  });

app.get("/resolve-location", async (req, res) => {
  const latRaw = String(req.query.lat || "").trim();
  const lonRaw = String(req.query.lon || "").trim();
  if (!latRaw || !lonRaw) {
    return res.status(400).json({ error: "lat and lon are required" });
  }

  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: "lat and lon must be numeric" });
  }

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lon),
      zoom: "10",
      addressdetails: "1"
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      { headers: { "User-Agent": "smart-agriculture-ui/1.0" } }
    );

    if (!response.ok) {
      throw new Error("Reverse geocoding unavailable");
    }

    const payload = await response.json();
    const address = payload.address || {};
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.county ||
      address.state_district ||
      payload.name ||
      "";
    const district = address.state_district || address.county || "";
    const state = address.state || "";

    const normalizedCity = normalizeLocationName(city);
    const normalizedDistrict = normalizeLocationName(district);

    const location = normalizedCity || normalizedDistrict || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

    return res.json({
      location,
      city: normalizedCity,
      district: normalizedDistrict,
      state: normalizeLocationName(state),
      lat,
      lon,
      source: "nominatim"
    });
  } catch (error) {
    return res.json({
      location: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      city: "",
      district: "",
      state: "",
      lat,
      lon,
      source: "fallback"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Smart Agriculture UI running on http://127.0.0.1:${PORT}`);
});
