# Aragon Full-Stack Image Validation Challenge

An automated image verification and hosting platform built using **React 18, Vite, Tailwind CSS, Node.js, Express, PostgreSQL, and Prisma ORM**.

---

## ⚙️ How to Setup and Run Locally

Ensure you have **Node.js (>= 18)** and **PostgreSQL** installed and running on your system.

### **Step 1: Database Setup**
1. Ensure your local PostgreSQL service is active.
2. Create a database named `aragon_challenge` in your PostgreSQL server.
3. Configure the database connection string in `backend/.env` (configured for default local macOS setups):
   `DATABASE_URL="postgresql://sagarjaiswal@localhost:5432/aragon_challenge"`

---

### **Step 2: Backend Server Setup**
Open your terminal and navigate to the `backend/` folder:
```bash
cd backend

# 1. Install dependencies (bypassing peer-locks)
npm install --legacy-peer-deps

# 2. Rebuild database tables and generate Prisma client
npx prisma db push --force-reset

# 3. Start the Express development server
npm run dev
```
*   **API Base**: `http://localhost:5001` (Port 5001 avoids macOS system AirPlay receiver conflicts on port 5000).

---

### **Step 3: Frontend Client Setup**
Open a **new terminal window** and navigate to the `frontend/` folder:
```bash
cd frontend

# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Start the Vite React client
npm run dev
```
*   **Web Dashboard**: `http://localhost:3000`

---

## 🎨 Cloud Storage Integration
*   By default, if no keys are set in `backend/.env`, the system automatically activates a **Local Static Storage fallback** (saving assets under `backend/public/uploads` and serving statically). This provides a **zero-setup reviewer-first experience**!
*   To use Cloudinary, simply populate your keys in `backend/.env` (accepts separate keys or a single unified `CLOUDINARY_URL`), and the server will automatically scope uploads under the `aragon` folder.
