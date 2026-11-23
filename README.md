# Smart Expense Tracker

A responsive, browser-based personal finance dashboard for recording everyday spending, reviewing useful patterns, and setting a monthly budget. The app is built with plain HTML, CSS, and JavaScript. Transactions and budget preferences stay in the browser's LocalStorage; there is no account or backend.

## Features

- A live dashboard for all-time expenses, current-month spending, transaction count, highest-spending category, recent transactions, and budget progress.
- Add, edit, and delete expenses. Each record includes a title, positive amount, one of eight categories, date, and optional description.
- Search transactions by title; filter by category; sort by date or amount.
- Interactive charts for recent monthly trends, category breakdown, and category comparisons. Charts are powered by Chart.js and update with expense changes.
- Monthly budget setting with utilization, remaining amount, and approaching/over-budget notices.
- LocalStorage persistence with basic validation of restored transaction records and budget values.
- CSV export and confirmation before clearing all transactions.
- Responsive desktop, tablet, and mobile navigation and layouts.

## Technology

HTML5, CSS3, vanilla JavaScript, browser LocalStorage, and Chart.js 4 (loaded from jsDelivr). Google Fonts and Chart.js require an internet connection; core transaction storage and calculations do not use a backend.

## Run locally

No package installation or build step is required. Download or clone the project and open `index.html` in a modern browser. For a local HTTP server, run this command from the project directory:

```bash
python3 -m http.server 3000
```

Then visit `http://localhost:3000`. Data is saved in the same browser profile and origin. Clearing browser site data removes it.

## Screenshots

Add screenshots here after capturing the app, for example:

- `screenshots/dashboard.png` — Desktop dashboard
- `screenshots/mobile.png` — Mobile layout

## Deploy with GitHub Pages

1. Push the project files (`index.html`, `style.css`, `script.js`, and this README) to a GitHub repository.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. Wait for GitHub Pages to publish the site and open the URL shown in the Pages settings.

No server-side build or backend configuration is required. Data is local to each visitor's browser and is not shared across devices.

## Future improvements

Optional directions include recurring expenses, custom categories, date-range filters, multiple budget periods, import from CSV, richer accessibility preferences, and a manual backup/restore file.

## Privacy note

This app does not transmit expense records to a server. Chart.js and font files are fetched from their CDNs when available. Avoid using a shared browser profile if your expense data is sensitive.
