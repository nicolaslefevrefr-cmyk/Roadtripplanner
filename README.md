# RoadTrip Planner

A progressive web app (PWA) for planning road trips — POIs, routes, day itineraries, costs, GPS tracking, and day zone overlays.

## Deploy to GitHub Pages

1. Create a new GitHub repository
2. Upload all files in this folder to the repository root
3. Go to **Settings → Pages → Source → Deploy from branch → main / root**
4. Your app will be live at `https://yourusername.github.io/your-repo-name/`

The app will work offline after the first visit (service worker caches the app shell).

## Features

- 📍 Add POIs with categories, costs, ratings, links, tags
- 🛣️ Calculate car/walk/bike routes via OSRM
- 📅 Organise days with drag-and-drop items
- 💰 Full cost breakdown: fuel, hotels, activities, daily expenses
- 🗺️ Day zone ellipse overlays on the map
- 🧭 Live GPS tracking with nearby POI list
- ☁️ Save/load JSON + Google Drive sync
- 📱 Works as an installed PWA on mobile and desktop

## Google Drive Sync

To enable Google Drive sync, replace `GOOGLE_CLIENT_ID` in `config.js` with your own OAuth 2.0 client ID from [Google Cloud Console](https://console.cloud.google.com).
