# Smart Agriculture UI

Farmer-friendly UI with a **Node/Express backend** and a cinematic agriculture design.

## What this system does
- Landing page, login, signup, and dashboard UI
- Multi-language UI labels
- Secure signup/login using hashed passwords stored locally in JSON
- Location map picker with reverse geocoding

## Project structure

```text
smart-agriculture-ml/
├── frontend/
│   ├── templates/
│   ├── static/
├── server/
│   ├── i18n.js
├── data/
│   ├── users.json
├── server.js
├── package.json
├── README.md
└── .gitignore
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm start
```

3. Open in browser:

```text
http://127.0.0.1:5000
```

## Notes
- Login/signup credentials are stored in `data/users.json` (hashed via bcryptjs).
- Reverse geocoding uses OpenStreetMap Nominatim.
