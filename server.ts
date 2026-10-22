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
const ARRIVALS_FILE = path.join(DATA_DIR, 'lb_arrivals.json');
const RAW_PURCHASES_FILE = path.join(DATA_DIR, 'raw_material_purchases.json');
const DAILY_PRICES_FILE = path.join(DATA_DIR, 'daily_stock_prices.json');
const PACKING_MATERIALS_FILE = path.join(DATA_DIR, 'packing_materials.json');
const PACKING_OPNAME_FILE = path.join(DATA_DIR, 'packing_opname.json');
const PACKING_USAGES_FILE = path.join(DATA_DIR, 'packing_usages.json');

const DEFAULT_PACKING_MATERIALS = [
  { id: 'mat-1', name: 'Plastik PE 1 Kg', category: 'plastik', unit: 'lembar', current_stock: 5000, min_stock_alert: 500, unit_cost: 150, notes: 'Kemasan ayam partisi 1 kg' },
  { id: 'mat-2', name: 'Plastik PE 2 Kg', category: 'plastik', unit: 'lembar', current_stock: 3500, min_stock_alert: 500, unit_cost: 220, notes: 'Kemasan karkas 2 kg' },
  { id: 'mat-3', name: 'Plastik Curah / Jumbo', category: 'plastik', unit: 'lembar', current_stock: 4000, min_stock_alert: 500, unit_cost: 300, notes: 'Kemasan kantong curah' },
  { id: 'mat-4', name: 'Karung Plastik 25 Kg', category: 'karung', unit: 'pcs', current_stock: 800, min_stock_alert: 100, unit_cost: 1800, notes: 'Karung anyam packing luar' },
  { id: 'mat-5', name: 'Lakban / Seal Tape', category: 'lainnya', unit: 'roll', current_stock: 60, min_stock_alert: 10, unit_cost: 12000, notes: 'Lakban segel kemasan' },
  { id: 'mat-6', name: 'Tali Rafia Roll', category: 'lainnya', unit: 'roll', current_stock: 30, min_stock_alert: 5, unit_cost: 15000, notes: 'Tali ikat karung' }
];

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
    if (!fs.existsSync(ARRIVALS_FILE)) {
        fs.writeFileSync(ARRIVALS_FILE, JSON.stringify([]));
    }
    if (!fs.existsSync(RAW_PURCHASES_FILE)) {
        fs.writeFileSync(RAW_PURCHASES_FILE, JSON.stringify([]));
    }
    if (!fs.existsSync(DAILY_PRICES_FILE)) {
        fs.writeFileSync(DAILY_PRICES_FILE, JSON.stringify([]));
    }
    if (!fs.existsSync(PACKING_MATERIALS_FILE)) {
        fs.writeFileSync(PACKING_MATERIALS_FILE, JSON.stringify(DEFAULT_PACKING_MATERIALS, null, 2));
    }
    if (!fs.existsSync(PACKING_OPNAME_FILE)) {
        fs.writeFileSync(PACKING_OPNAME_FILE, JSON.stringify([]));
    }
    if (!fs.existsSync(PACKING_USAGES_FILE)) {
        fs.writeFileSync(PACKING_USAGES_FILE, JSON.stringify([]));
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

  // LB Arrivals API
  app.get("/api/lb-arrivals", (req: Request, res: Response) => {
    const arrivals = readJsonFile(ARRIVALS_FILE);
    res.json(arrivals);
  });

  app.post("/api/lb-arrivals", (req: Request, res: Response) => {
    try {
      const arrival = req.body;
      if (!arrival || !arrival.id) {
        return res.status(400).json({ error: "Data kedatangan LB tidak valid" });
      }
      const arrivals = readJsonFile(ARRIVALS_FILE);
      const existingIdx = arrivals.findIndex((a: any) => a.id === arrival.id);
      if (existingIdx >= 0) {
        arrivals[existingIdx] = { ...arrivals[existingIdx], ...arrival, updatedAt: new Date().toISOString() };
      } else {
        arrivals.unshift({ ...arrival, timestamp: arrival.timestamp || new Date().toISOString() });
      }
      writeJsonFile(ARRIVALS_FILE, arrivals);
      res.json({ success: true, record: arrival });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/lb-arrivals/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const arrivals = readJsonFile(ARRIVALS_FILE);
      const filtered = arrivals.filter((a: any) => a.id !== id);
      writeJsonFile(ARRIVALS_FILE, filtered);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // RAW MATERIAL PURCHASES API
  // ==========================================
  app.get("/api/raw-material-purchases", (req: Request, res: Response) => {
    const purchases = readJsonFile(RAW_PURCHASES_FILE);
    res.json(purchases);
  });

  app.post("/api/raw-material-purchases", (req: Request, res: Response) => {
    try {
      const record = req.body;
      if (!record || !record.id) {
        return res.status(400).json({ error: "Data pembelian raw material tidak valid" });
      }
      const purchases = readJsonFile(RAW_PURCHASES_FILE);
      const existingIdx = purchases.findIndex((p: any) => p.id === record.id);
      if (existingIdx >= 0) {
        purchases[existingIdx] = { ...purchases[existingIdx], ...record, updatedAt: new Date().toISOString() };
      } else {
        purchases.unshift({ ...record, timestamp: record.timestamp || new Date().toISOString() });
      }
      writeJsonFile(RAW_PURCHASES_FILE, purchases);
      res.json({ success: true, record });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/raw-material-purchases/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const purchases = readJsonFile(RAW_PURCHASES_FILE);
      const filtered = purchases.filter((p: any) => p.id !== id);
      writeJsonFile(RAW_PURCHASES_FILE, filtered);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // DAILY STOCK VALUATION & PRICES API
  // ==========================================
  app.get("/api/daily-stock-prices", (req: Request, res: Response) => {
    const { date } = req.query;
    const prices = readJsonFile(DAILY_PRICES_FILE);
    if (date && typeof date === 'string') {
      const filtered = prices.filter((p: any) => p.date === date);
      return res.json(filtered);
    }
    res.json(prices);
  });

  app.post("/api/daily-stock-prices", (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const prices = readJsonFile(DAILY_PRICES_FILE);

      if (Array.isArray(payload)) {
        // Bulk items update
        payload.forEach((item: any) => {
          const idx = prices.findIndex((p: any) => p.date === item.date && p.item_name === item.item_name);
          if (idx >= 0) {
            prices[idx] = { ...prices[idx], ...item, timestamp: new Date().toISOString() };
          } else {
            prices.unshift({ ...item, id: item.id || `dsp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, timestamp: new Date().toISOString() });
          }
        });
      } else if (payload && payload.date) {
        const idx = prices.findIndex((p: any) => p.date === payload.date && p.item_name === payload.item_name);
        if (idx >= 0) {
          prices[idx] = { ...prices[idx], ...payload, timestamp: new Date().toISOString() };
        } else {
          prices.unshift({ ...payload, id: payload.id || `dsp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, timestamp: new Date().toISOString() });
        }
      }
      writeJsonFile(DAILY_PRICES_FILE, prices);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // PACKING MATERIALS MASTER API
  // ==========================================
  app.get("/api/packing-materials", (req: Request, res: Response) => {
    const materials = readJsonFile(PACKING_MATERIALS_FILE);
    res.json(materials);
  });

  app.post("/api/packing-materials", (req: Request, res: Response) => {
    try {
      const mat = req.body;
      if (!mat || !mat.name) {
        return res.status(400).json({ error: "Nama packing material harus diisi" });
      }
      const materials = readJsonFile(PACKING_MATERIALS_FILE);
      const newMat = {
        id: mat.id || `mat-${Date.now()}`,
        name: mat.name,
        category: mat.category || 'plastik',
        unit: mat.unit || 'lembar',
        current_stock: Number(mat.current_stock) || 0,
        min_stock_alert: Number(mat.min_stock_alert) || 100,
        unit_cost: Number(mat.unit_cost) || 0,
        notes: mat.notes || ''
      };
      materials.push(newMat);
      writeJsonFile(PACKING_MATERIALS_FILE, materials);
      res.json({ success: true, material: newMat });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/packing-materials/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const materials = readJsonFile(PACKING_MATERIALS_FILE);
      const idx = materials.findIndex((m: any) => m.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: "Material tidak ditemukan" });
      }
      materials[idx] = { ...materials[idx], ...updates };
      writeJsonFile(PACKING_MATERIALS_FILE, materials);
      res.json({ success: true, material: materials[idx] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/packing-materials/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const materials = readJsonFile(PACKING_MATERIALS_FILE);
      const filtered = materials.filter((m: any) => m.id !== id);
      writeJsonFile(PACKING_MATERIALS_FILE, filtered);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // PACKING OPNAME API (Daily Stock Opname)
  // ==========================================
  app.get("/api/packing-opname", (req: Request, res: Response) => {
    const logs = readJsonFile(PACKING_OPNAME_FILE);
    res.json(logs);
  });

  app.post("/api/packing-opname", (req: Request, res: Response) => {
    try {
      const payload = req.body; // Can be a single entry or an array of opname items
      const logs = readJsonFile(PACKING_OPNAME_FILE);
      const materials = readJsonFile(PACKING_MATERIALS_FILE);

      const items = Array.isArray(payload) ? payload : [payload];
      items.forEach((item: any) => {
        const logEntry = {
          id: item.id || `opname_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          date: item.date || new Date().toISOString().slice(0, 10),
          material_id: item.material_id,
          material_name: item.material_name,
          system_stock: Number(item.system_stock) || 0,
          physical_stock: Number(item.physical_stock) || 0,
          difference: (Number(item.physical_stock) || 0) - (Number(item.system_stock) || 0),
          unit: item.unit || 'lembar',
          notes: item.notes || '',
          operator: item.operator || 'Admin Gudang',
          timestamp: new Date().toISOString()
        };
        logs.unshift(logEntry);

        // Update the actual current stock in packing_materials.json to physical stock
        const matIdx = materials.findIndex((m: any) => m.id === item.material_id);
        if (matIdx >= 0) {
          materials[matIdx].current_stock = Number(item.physical_stock) || 0;
        }
      });

      writeJsonFile(PACKING_OPNAME_FILE, logs);
      writeJsonFile(PACKING_MATERIALS_FILE, materials);
      res.json({ success: true, count: items.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // PACKING USAGES API (Daily Production Usage)
  // ==========================================
  app.get("/api/packing-usages", (req: Request, res: Response) => {
    const { date } = req.query;
    const usages = readJsonFile(PACKING_USAGES_FILE);
    if (date && typeof date === 'string') {
      const filtered = usages.filter((u: any) => u.date === date);
      return res.json(filtered);
    }
    res.json(usages);
  });

  app.post("/api/packing-usages", (req: Request, res: Response) => {
    try {
      const record = req.body;
      if (!record || !record.items || !Array.isArray(record.items)) {
        return res.status(400).json({ error: "Data pemakaian packing tidak valid" });
      }
      const usages = readJsonFile(PACKING_USAGES_FILE);
      const materials = readJsonFile(PACKING_MATERIALS_FILE);

      const usageEntry = {
        id: record.id || `usage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        production_id: record.production_id || '',
        date: record.date || new Date().toISOString().slice(0, 10),
        truck_number: record.truck_number,
        no_do: record.no_do,
        items: record.items, // [{ material_id, material_name, qty_used, unit, unit_cost, total_cost }]
        total_cost: record.total_cost || record.items.reduce((s: number, i: any) => s + (Number(i.total_cost) || 0), 0),
        notes: record.notes || '',
        operator: record.operator || '',
        timestamp: new Date().toISOString()
      };

      // Automatically deduct stock from packing_materials
      record.items.forEach((usedItem: any) => {
        const matIdx = materials.findIndex((m: any) => m.id === usedItem.material_id);
        if (matIdx >= 0) {
          const deduction = Number(usedItem.qty_used) || 0;
          materials[matIdx].current_stock = Math.max(0, (Number(materials[matIdx].current_stock) || 0) - deduction);
        }
      });

      usages.unshift(usageEntry);
      writeJsonFile(PACKING_USAGES_FILE, usages);
      writeJsonFile(PACKING_MATERIALS_FILE, materials);

      res.json({ success: true, record: usageEntry });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/packing-usages/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const usages = readJsonFile(PACKING_USAGES_FILE);
      const filtered = usages.filter((u: any) => u.id !== id);
      writeJsonFile(PACKING_USAGES_FILE, filtered);
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
