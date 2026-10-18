# Deployment Guide - GoodWays

## Local Development
1. Clone the repository and open in VS Code.
2. Install dependencies: `npm install`.
3. Create `.env` from `.env.example` and add your `GEMINI_API_KEY`.
4. Run development server: `npm run dev`.

## Production Deployment
1. Build production bundle: `npm run build`.
2. Start production server: `npm start`.
3. Deploy the frontend with the included GitHub Pages workflow.
4. Deploy the backend with `render.yaml` on Render.
5. Configure all values from `backend/.env.example` as Render environment variables.
6. Configure the GitHub repository variables/secrets documented in `.github/workflows/deploy-frontend.yml`.

Never commit `.env` files, Firebase configuration JSON, backend data files, API keys, JWT secrets, invite codes, or service-account files.
