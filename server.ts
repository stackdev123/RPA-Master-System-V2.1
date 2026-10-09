import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import cron from "node-cron";
import { db } from "./supabaseClient";
import { calculateStockValuation } from "./valuationService";
import path from "path";
import os from "os";
import fs from "fs";

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        if (iface) {
            for (let i = 0; i < iface.length; i++) {
                const alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                    return alias.address;
                }
            }
        }
    }
    return '0.0.0.0';
}

const DATA_DIR = path.join(process.cwd(), 'data');
const SO_FILE = path.join(DATA_DIR, 'sales_orders.json');
const RETURNS_FILE = path.join(DATA_DIR, 'do_returns.json');

function ensureDataFiles() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(SO_FILE)) {
        fs.writeFileSync(SO_FILE, JSON.stringify([]));
    }
    if (!fs.existsSync(RETURNS_FILE)) {
        fs.writeFileSync(RETURNS_FILE, JSON.stringify([]));
    }
}

function readJsonFile(filePath: string) {
    try {
        ensureDataFiles();
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content || '[]');
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e);
        return [];
    }
}

function writeJsonFile(filePath: string, data: any) {
    try {
        ensureDataFiles();
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error(`Error writing ${filePath}:`, e);
    }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Sales Orders API
  app.get("/api/sales-orders", (req: Request, res: Response) => {
    const orders = readJsonFile(SO_FILE);
    res.json(orders);
  });

  app.post("/api/sales-orders", (req: Request, res: Response) => {
    try {
      const newOrder = req.body;
      if (!newOrder || !newOrder.id) {
        return res.status(400).json({ error: "Data order tidak valid" });
      }
      const orders = readJsonFile(SO_FILE);
      const existingIdx = orders.findIndex((o: any) => o.id === newOrder.id);
      if (existingIdx >= 0) {
        orders[existingIdx] = { ...orders[existingIdx], ...newOrder, updatedAt: new Date().toISOString() };
      } else {
        orders.unshift({ ...newOrder, timestamp: newOrder.timestamp || new Date().toISOString() });
      }
      writeJsonFile(SO_FILE, orders);
      res.json({ success: true, order: newOrder });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/sales-orders/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const orders = readJsonFile(SO_FILE);
      const filtered = orders.filter((o: any) => o.id !== id);
      writeJsonFile(SO_FILE, filtered);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DO Returns API
  app.get("/api/do-returns", (req: Request, res: Response) => {
    const returns = readJsonFile(RETURNS_FILE);
    res.json(returns);
  });

  app.post("/api/do-returns", (req: Request, res: Response) => {
    try {
      const returnData = req.body;
      if (!returnData || !returnData.id) {
        return res.status(400).json({ error: "Data return tidak valid" });
      }
      const returns = readJsonFile(RETURNS_FILE);
      returns.unshift({ ...returnData, timestamp: returnData.timestamp || new Date().toISOString() });
      writeJsonFile(RETURNS_FILE, returns);
      res.json({ success: true, record: returnData });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/do-returns/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const returns = readJsonFile(RETURNS_FILE);
      const filtered = returns.filter((r: any) => r.id !== id);
      writeJsonFile(RETURNS_FILE, filtered);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Manual Trigger for testing (optional, but helpful)
  app.post("/api/admin/capture-stock", async (req: Request, res: Response) => {
     try {
       const data = await db.getInitialData();
       const val = calculateStockValuation(data.invoices, data.currentStock);
       const dateStr = new Date().toISOString().split('T')[0];
       await db.upsertEarlyStock(dateStr, val, "MANUAL_TRIGGER");
       res.json({ success: true, date: dateStr, value: val });
     } catch (err: any) {
       res.status(500).json({ error: err.message });
     }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    const localIP = getLocalIP();
    console.log(`\n  \x1b[32mDPJ RPA SYSTEM v1.0.0\x1b[0m\n`);
    console.log(`  ➜  Local:   \x1b[36mhttp://localhost:${PORT}/\x1b[0m`);
    console.log(`  ➜  Network: \x1b[36mhttp://${localIP}:${PORT}/\x1b[0m\n`);
  });
}

startServer();
