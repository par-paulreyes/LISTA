# Digital Transformation Center - Inventory Management System

This is the frontend application for the Digital Transformation Center's Inventory Management System, built with [Next.js](https://nextjs.org).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Features

- **Inventory Management**: Add, edit, and track inventory items
- **Maintenance Logs**: Record and track maintenance activities
- **QR Code Scanning**: Scan QR codes for quick item identification
- **System Diagnostics**: Monitor system status and health
- **User Authentication**: Secure login and user management
- **Responsive Design**: Works on desktop and mobile devices

## Chatbot (IVY) Capabilities

The in-app assistant (IVY) helps you perform inventory and maintenance tasks directly from chat:

- Find and list items
  - Examples: "find monitors", "search Dell laptops", "lookup ICTCE-PC-003"
  - Searches across `article_type`, `category`, `brand`, and `qr_code`
- Count availability
  - Example: "how many printers are available?"
- Items needing maintenance
  - Example: "which computers need servicing?"
- Show insights and summaries
  - Examples: "insights", "summarize inventory status"
- Reports and exports
  - Examples: "export inventory to excel", "report"
- Maintenance logs
  - Examples: "logs", "recent logs"
- Forecasts and trends
  - Examples: "forecast", "predict maintenance tasks next month"
- Statistical queries
  - Examples: "average number of items per location", "average per category"
- Item CRUD (with confirmation for risky actions)
  - Add: `add { "qr_code": "NEW-QR-001", "article_type": "Laptop", "brand": "Dell", "item_status": "Available", "location": "HQ" }`
  - Update: `update { "id": 123, "update": { "item_status": "In Use" } }`
  - Delete: `delete { "id": 123 }`
- Natural-language updates (auto-resolve ID via QR and infer fields)
  - Examples: "move DTC-MON-00268 to DTC", "set status of ICTCE-PC-003 to In Use"
  - On confirm, IVY updates `location`/`item_status` automatically
- Conversational continuity
  - Follow-ups like "do the same for monitors" use recent chat history

Notes
- Risky actions (add/update/delete) require confirmation.
- When Gemini is configured, responses are grounded with live aggregates and relevant items/logs.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
