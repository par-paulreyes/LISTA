# DTC-IMS (Digital Transformation Center - Inventory Management System)

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [System Architecture](#system-architecture)
4. [Prerequisites](#prerequisites)
5. [Setup Guide](#setup-guide)
    - [Database Setup](#database-setup)
    - [Backend Setup](#backend-setup)
    - [Frontend Setup](#frontend-setup)
6. [Usage Guide](#usage-guide)
    - [Login & Registration](#login--registration)
    - [Dashboard](#dashboard)
    - [QR Code Scanning & Add Item Flow](#qr-code-scanning--add-item-flow)
    - [Inventory Management](#inventory-management)
    - [Maintenance Logs](#maintenance-logs)
    - [Profile Management](#profile-management)
7. [Maintenance & Administration](#maintenance--administration)
8. [Troubleshooting & Tips](#troubleshooting--tips)
9. [Contributing](#contributing)
10. [License](#license)

---

## Overview

DTC-IMS is a full-stack inventory management system for the Digital Transformation Center. It provides secure, role-based access to manage assets, track maintenance, and monitor diagnostics, with a modern web interface and QR code integration.

---

## Features

- **User Authentication**: Secure login and registration, role-based access (admin/user).
- **Inventory Management**: Add, edit, view, and filter items; upload images; export data.
- **QR Code Tagging & Scanning**: Each item is assigned a unique QR code tag. Scan or upload QR codes for instant item lookup, inventory management, and seamless add-item flow. QR codes encode the item’s unique identifier and type, enabling fast and accurate tracking.
  - **Supported QR Tag Types:**
    - `PC` — Desktop Computer
    - `PR` — Printer
    - `MON` — Monitor
    - `TP` — Laptop
    - `MS` — Mouse
    - `KEY` — Keyboard
    - `UPS` — UPS (Uninterruptible Power Supply)
    - `TAB` — Tablet
    - `PWB` — Power Bank
    - `UTLY` — Utility
    - `TOOL` — Tool
    - `SPLY` — Supply
  - The QR code format typically includes the tag, a unique code, and may look like: `ICTCE-PC-001` (for a desktop computer).
  - **Peripheral Tagging Rule:** Keyboard, mouse, monitor, and UPS that are assigned to a specific PC share the same QR code ID as the PC. For example, if a PC's QR code is `ICTCE-PC-00001`, then the associated keyboard, mouse, monitor, and UPS will also use `ICTCE-PC-00001` as their QR code ID. This allows all related peripherals to be tracked together with the main PC asset.
- **Maintenance Logs**: Record, view, and export maintenance activities.
- **Diagnostics**: Track item/system health and status.
- **Profile Management**: Update user info and profile picture.
- **Responsive UI**: Works on desktop and mobile.
- **Data Export**: Export inventory and logs as CSV, Excel, or PDF.

---

## System Architecture

- **Frontend**: Next.js (React), Tailwind CSS, Zustand, Supabase for storage.
- **Backend**: Node.js (Express), MySQL, JWT authentication, REST API.
- **Database**: MySQL (see `database_setup.sql` for schema and sample data).

---

## Prerequisites

- Node.js (v16+)
- npm (comes with Node.js)
- MySQL server (local or remote)
- (Optional) HTTPS certificates for secure local development

---

## Setup Guide

### Database Setup

1. **Create the Database:**
   - Import `database_setup.sql` into your MySQL server:
     ```sh
     mysql -u <user> -p < database_setup.sql
     ```
   - This creates tables, sample data, and a default admin user:
     - **Username:** `admin`
     - **Password:** `123456`

2. **Configure Database Credentials:**
   - You’ll need your DB host, port, user, password, and database name for the backend `.env` file.

---

### Backend Setup

1. **Install dependencies:**
   ```sh
   cd backend
   npm install
   ```

2. **Configure Environment:**
   - Copy `.env.example` to `.env` and fill in:
     - Database credentials
     - JWT secret
     - (Optional) HTTPS certificate paths

3. **Start the backend server:**
   ```sh
   npm start
   ```
   - The server runs on the host/port specified in `.env`.

---

### Frontend Setup

1. **Install dependencies:**
   ```sh
   cd frontend
   npm install
   ```

2. **Start the frontend development server:**
   ```sh
   npm run dev
   ```
   - The app is available at [http://localhost:3000](http://localhost:3000).

   - For HTTPS (recommended for QR scanning):
     ```sh
     npm run dev:https
     ```
     - Make sure to provide valid certificate and key files if prompted.

---

## Usage Guide

### Login & Registration

- **Login:** Go to `/login`, enter your username and password.
- **Register:** Go to `/register` to create a new user (admin approval may be required).
- **Session:** After login, you are redirected to the dashboard.

### Dashboard

- **Overview:** See stats on total items, maintenance status, recently added items, and quick links.
- **Navigation:** Use the bottom navbar to access Inventory, Logs, QR Scanner, and Profile.

### QR Code Scanning & Add Item Flow

- **Access:** Go to `/qr-scanner` from the navbar.
- **Scan:** Use your device camera (requires HTTPS or localhost) or upload an image of a QR code.
- **Manual Entry:** If camera is unavailable, enter the QR code manually.
- **QR Tagging:** Each inventory item should have a QR code label/tag attached. The QR code encodes the item’s unique identifier (e.g., property number or system-generated code) and a type tag (see supported types above). You can generate and print QR codes for new items after adding them to the system.
- **Result:**
  - If the QR code matches an existing item, you are shown the item details.
  - **If the item is not found, you are automatically redirected to the Add Item form, with the QR code pre-filled.**
- **Add Item:**
  - Fill in the item details, upload or capture an image, and submit the form.
  - On success, you are redirected to the inventory list.

### Inventory Management

- **View Items:** Go to `/inventory` to see all items. Filter by category, type, status, or maintenance.
- **Edit/View Item:** Click an item to view details, edit info, or update image.
- **Export:** Use the export button to download inventory as CSV, Excel, or PDF.

### Maintenance Logs

- **View Logs:** Go to `/logs` to see all maintenance activities. Filter and search as needed.
- **Export Logs:** Download logs as CSV or PDF.
- **Item Logs:** View and add logs directly from an item’s detail page.

### Profile Management

- **View/Edit Profile:** Go to `/profile` to view and update your info and profile picture.
- **Change Password:** Update your password from the profile page.

---

## Maintenance & Administration

- **Backend:**
  - Use `npm run dev` for development (auto-reloads with nodemon).
  - Check logs in the terminal for errors.
  - Update environment variables in `.env` as needed.
- **Frontend:**
  - Use `npm run build` and `npm start` for production.
  - For HTTPS, ensure certificates are valid and paths are correct.
- **Database:**
  - Use `database_setup.sql` to reset or seed the database.
  - Backup your database regularly.
- **Data Export:**
  - Use the export features in Inventory and Logs for backups or reporting.

---

## Troubleshooting & Tips

- **Cannot connect to backend:** Check `.env` settings and that MySQL is running.
- **HTTPS/Camera issues:** Use HTTPS for QR scanning. Provide valid certificates or use `localhost`.
- **Login issues:** Ensure the backend is running and the database is seeded.
- **Image upload issues:** Check Supabase credentials and storage settings.
- **Environment variables:** Always restart the backend after changing `.env`.

---

## Contributing

Pull requests and issues are welcome! Please follow standard coding and documentation practices.

---

## License

[MIT](LICENSE)