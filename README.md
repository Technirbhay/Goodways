# GoodWays AI — Road Damage Measurement & Government Repair Platform

GoodWays is a full-stack civic intelligence platform that empowers citizens to report road surface potholes with automated metric sizing, precise shoelace geometry, debris exclusion filters, and direct 1-click dispatch to government grievance portals (NHAI, CPGRAMS, State PWD).

---

## 1. Project Dependencies

### Frontend (`frontend/package.json`)
- **React** (`^19.0.1`) & **React DOM**
- **Tailwind CSS** (`^4.3.3`)
- **Leaflet** (`^1.9.4`) & React Leaflet mapping
- **Lucide React** (`^0.546.0`) for UI icons
- **Vite** (`^8.3.0`) & `@vitejs/plugin-react`

### Backend (`backend/package.json`)
- **Express** (`^4.21.2`)
- **Google GenAI SDK** (`@google/genai ^2.4.0`) for Gemini Vision AI analysis
- **jsonwebtoken** (`^9.0.2`) for secure token-based authentication & RBAC
- **dotenv** (`^17.2.3`)
- **tsx** (`^4.21.0`) for TypeScript execution in Node.js

---

## 2. Prerequisites (Windows & VS Code)

Before you begin, ensure you have installed:
1. **Node.js** (v18 or higher): [Download Node.js](https://nodejs.org/)
2. **Visual Studio Code**: [Download VS Code](https://code.visualstudio.com/)
3. **Git**: [Download Git](https://git-scm.com/)

---

## 3. Extract and Open the Project in VS Code

1. Extract the downloaded `GoodWays.zip` archive into a folder on your computer.
2. Open **Visual Studio Code**.
3. Select **File > Open Folder...** and choose the extracted `GoodWays` root folder.
4. Open the integrated terminal in VS Code by pressing `` Ctrl + ` `` (Control + Backtick).

---

## 4. Configure Environment Variables

1. Locate `.env.example` in the root directory (and review `backend/.env.example` / `frontend/.env.example`).
2. Create your local `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and configure your keys:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   PORT=3000
   JWT_SECRET=replace_with_a_long_random_secret
   ```
   *(Note: Never commit your `.env` file or expose your API key in client-side code).*

---

## 5. Install Dependencies & Run the Application

In your VS Code terminal, run the following commands:

1. **Install root & workspace dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server (Express backend + Vite frontend proxy)**:
   ```bash
   npm run dev
   ```

3. Open your browser and go to **`http://localhost:3000`**.

---

## 6. Database Setup & Migrations (PostgreSQL / Supabase)

GoodWays persists records in `backend/data/` (JSON store) and includes SQL migrations for PostgreSQL / Supabase deployments:
- **Migration file**: `backend/migrations/001_initial_schema.sql`
- To initialize Supabase / PostgreSQL tables, execute `001_initial_schema.sql` in your Supabase SQL editor or PostgreSQL CLI.

---

## 7. Role-Based Access Control (RBAC) & First Administrator

### Citizen Portal
- Click **Sign In / Register** and create a Citizen account or use the instant 1-click demo buttons.
- Citizens can capture/upload road photos, auto-detect live GPS coordinates, view AI vision annotations, and dispatch grievances.

### Authority Command Center
- Government officials and PWD engineers log in via the **Authority Portal**.
- **Security Control**: Unapproved official registrations remain in `pending` state until authorized by the Super Admin or activated using the Master Admin Passkey:
   The admin invite code is configured only as a private backend environment variable.
- The Super Admin can review pending applications, approve officers, or revoke access directly from the **Authority Access & Approvals** tab in the dashboard.

---

## 8. Running Tests & Production Build

- **Typecheck & Linter**:
  ```bash
  npm run lint
  ```
- **Production Build**:
  ```bash
  npm run build
  ```
- **Backend Integration Tests**:
  ```bash
  cd backend && npm test
  ```

---

## 9. Publishing Safely to GitHub

To push your cleaned project to GitHub without exposing secrets:
```bash
git init
git add .
git commit -m "feat: complete GoodWays AI road damage platform"
git branch -M main
git remote add origin https://github.com/<your-username>/GoodWays.git
git push -u origin main
```

---

## License
Distributed under the MIT License. See `LICENSE` for more information.
