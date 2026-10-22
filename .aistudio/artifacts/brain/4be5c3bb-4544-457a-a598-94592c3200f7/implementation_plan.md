# Implementation Plan - Live Bird Arrival & Per-Truck Production Yield Enhancement

## Overview
Enhance the production input module so that:
1. Live Bird (LB) arrival captures:
   - Supplier (selected from Master Data / Customers)
   - Driver / Supir (manual text input)
   - License Plate / Plat Nomor (manual text input)
   - Quantity in Pcs/Ekor and Kg (Total Ekor & Total Kg, plus Mortality)
2. Production items input are populated from Master Data (`masterItems`).
3. Per-truck production yield is calculated and displayed as yield ratio percentages per item category relative to the initial Live Bird weight.

## Proposed Changes

### 1. Production Form (`components/ProductionForm.tsx`)
- Add Supplier selection dropdown populated from master data / customers.
- Keep Driver and License Plate as manual text inputs.
- Ensure Initial Live Bird quantity accepts Ekor (pcs) and Kg.
- Render Production items from Master Data items (`masterItems`).
- Add a live per-truck yield summary breakdown (item category ratios vs initial LB weight).

### 2. State & Database Persistence (`App.tsx` & `supabaseClient.ts`)
- Ensure supplier, driver, license plate, initial ekor, initial kg, and item quantities are correctly persisted in `production_logs`.

## Verification Plan
- Run `compile_applet` to verify compilation.
- Verify user workflow in Production input form.
