import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Header, { WorkspaceTab } from './components/Header';
import ProductionForm from './components/ProductionForm';
import StockView from './components/StockView';
import AllocationForm from './components/AllocationForm';
import InvoiceForm from './components/InvoiceForm';
import Login from './components/Login';
import DatabaseManagement from './components/DatabaseManagement';
import DeliveryOrderList from './components/DeliveryOrderList';
import DeliveryOrderDetail from './components/DeliveryOrderDetail';
import InvoiceList from './components/InvoiceList';
import InvoiceDetail from './components/InvoiceDetail';
import StockOpnameForm from './components/StockOpnameForm';
import StockHistoryView from './components/StockHistoryView';
import TradingHistoryView from './components/TradingHistoryView';
import DisposalHistoryView from './components/DisposalHistoryView';
import TradingPurchaseForm from './components/TradingPurchaseForm';
import StockDisposalForm from './components/StockDisposalForm';
import LedgerView from './components/LedgerView';
import ExpenseView from './components/ExpenseView';
import ExpenseForm from './components/ExpenseForm';
import SalaryView from './components/SalaryView';
import SalaryForm from './components/SalaryForm';
import CoopPriceForm from './components/CoopPriceForm';
import DashboardReport from './components/DashboardReport';
import ProductionReport from './components/ProductionReport';
import BelanjaLBReport from './components/BelanjaLBReport';
import HPPView from './components/HPPView';
import StockValueReport from './components/StockValueReport';
import ProfitLossView from './components/ProfitLossView';
import SalesReportHistory from './components/SalesReportHistory';
import DailyRecapReport from './components/DailyRecapReport';
import ActivityHistoryView from './components/ActivityHistoryView';
import ProductionEditModal from './components/ProductionEditModal';
import ManualSJForm from './components/ManualSJForm';
import ManualInvoiceForm from './components/ManualInvoiceForm';
import EndingInventoryForm from './components/EndingInventoryForm';
import SalesOrderView from './components/SalesOrderView';
import SalesOrderForm from './components/SalesOrderForm';
import SalesOrderDetailModal from './components/SalesOrderDetailModal';
import CreateDOFromSOModal from './components/CreateDOFromSOModal';
import DOReturnModal from './components/DOReturnModal';
import DOReturnsListView from './components/DOReturnsListView';
import { TrashIcon } from './components/icons';
import { db, supabase } from './supabaseClient';
import { getOfflineQueue } from './offlineSync';
import { 
    CHICKEN_PARTS, sortChickenParts, parseUserPermissions, getDefaultPermissions, 
    canEditSubModule, canViewSubModule, checkIsSuperAdmin 
} from './constants';
import { getAveragePrices } from './valuationService';
import {
    parseInvoiceExtraCosts,
    serializeInvoiceExtraCosts,
    type StockItem, type Coop, type Customer, type MasterItem, type Invoice, type DeliveryOrder,
    type SupabaseInvoice, type ExpenseRecord, type SalaryRecord, type LedgerEntry,
    type StockLog, type SupabaseProductionLog, type TradingPurchaseRecord, type StockDisposalRecord, type AllocationItem, type ActivityLog,
    type SalesOrder, type DOReturnRecord, type AppModuleId
} from './types';

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        try {
            const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
            if (isLoggedIn) {
                const loginTs = localStorage.getItem('loginTimestamp');
                if (loginTs && (Date.now() - parseInt(loginTs, 10) > 6 * 60 * 60 * 1000)) {
                    localStorage.removeItem('isLoggedIn');
                    localStorage.removeItem('username');
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('loginTimestamp');
                    return false;
                }
            }
            return isLoggedIn;
        } catch { return false; }
    });
    const [currentUserName, setCurrentUserName] = useState(() => {
        try { return localStorage.getItem('username') || ''; } catch { return ''; }
    });
    const [userRole, setUserRole] = useState(() => {
        try { return localStorage.getItem('userRole') || 'admin'; } catch { return 'admin'; }
    });

    const currentUserPerms = useMemo(() => {
        if (checkIsSuperAdmin(currentUserName, userRole)) {
            return { isSuperAdmin: true, roleName: 'Superadmin', permissions: getDefaultPermissions('edit', true) };
        }
        return parseUserPermissions(userRole);
    }, [currentUserName, userRole]);
    const [onlineUsers, setOnlineUsers] = useState<{ user: string; location: string }[]>([]);
    const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const [isOffline, setIsOffline] = useState<boolean>(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
    const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => getOfflineQueue().length);

    const getLightestPermittedLanding = useCallback((perms: Record<string, string>, isSuper: boolean) => {
        // 1. Prioritas utama sesuai permintaan: Produksi (Input Produksi)
        if (isSuper || perms.production !== 'none') {
            const canInput = canViewSubModule(perms, 'production', 'input', isSuper) || canViewSubModule(perms, 'production', 'queue', isSuper);
            return { view: 'production', subTab: canInput ? 'input' : 'report' };
        }
        // 2. Jika tidak punya akses produksi, pilih modul dengan penarikan data paling sedikit:
        // Logistik -> Inventaris (hanya menarik data master ringan)
        if (isSuper || perms.logistics !== 'none') {
            if (canViewSubModule(perms, 'logistics', 'stock', isSuper)) return { view: 'logistics', subTab: 'stock' };
            if (canViewSubModule(perms, 'logistics', 'returns', isSuper)) return { view: 'logistics', subTab: 'returns' };
            if (canViewSubModule(perms, 'logistics', 'delivery_orders', isSuper)) return { view: 'logistics', subTab: 'delivery_orders' };
            return { view: 'logistics', subTab: 'daily_recap' };
        }
        // 3. Sales Order -> Daftar Sales Order
        if (isSuper || perms.sales_orders !== 'none') {
            const canList = canViewSubModule(perms, 'sales_orders', 'list', isSuper) || canViewSubModule(perms, 'sales_orders', 'create', isSuper);
            return { view: 'sales_orders', subTab: canList ? 'list' : 'sales_history' };
        }
        // 4. Basis Data (Master Data)
        if (isSuper || perms.database !== 'none') {
            return { view: 'database', subTab: '' };
        }
        // 5. Keuangan -> pilih sub-tab yang paling ringan datanya terlebih dahulu
        if (isSuper || perms.finance !== 'none') {
            const financeOrder = ['expenses', 'salaries', 'chicken_prices', 'belanja_lb', 'invoices_list', 'ledger', 'hpp', 'stock_value', 'profit_loss'];
            const lightestTab = financeOrder.find(t => canViewSubModule(perms, 'finance', t, isSuper)) || 'chicken_prices';
            return { view: 'finance', subTab: lightestTab };
        }
        // 6. Terakhir: Dashboard
        return { view: 'reports', subTab: '' };
    }, []);

    const [activeView, setActiveView] = useState(() => {
        try {
            localStorage.removeItem('rpa_active_view');
            const savedInSession = sessionStorage.getItem('rpa_active_view');
            if (savedInSession !== null) return savedInSession;
        } catch { }
        return '';
    });
    const [financeTab, setFinanceTab] = useState(() => {
        try {
            localStorage.removeItem('rpa_finance_tab');
            return sessionStorage.getItem('rpa_finance_tab') || 'chicken_prices';
        } catch { return 'chicken_prices'; }
    });
    const [logisticsTab, setLogisticsTab] = useState(() => {
        try {
            localStorage.removeItem('rpa_logistics_tab');
            return sessionStorage.getItem('rpa_logistics_tab') || 'stock';
        } catch { return 'stock'; }
    });
    const [productionTab, setProductionTab] = useState(() => {
        try {
            localStorage.removeItem('rpa_production_tab');
            return sessionStorage.getItem('rpa_production_tab') || 'input';
        } catch { return 'input'; }
    });
    const [salesOrderTab, setSalesOrderTab] = useState(() => {
        try {
            localStorage.removeItem('rpa_sales_order_tab');
            return sessionStorage.getItem('rpa_sales_order_tab') || 'list';
        } catch { return 'list'; }
    });
    const [databaseTab, setDatabaseTab] = useState(() => {
        try {
            localStorage.removeItem('rpa_database_tab');
            return sessionStorage.getItem('rpa_database_tab') || 'coops';
        } catch { return 'coops'; }
    });
    const [openTabs, setOpenTabs] = useState<WorkspaceTab[]>(() => {
        try {
            const raw = sessionStorage.getItem('rpa_open_tabs');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch { }
        return [];
    });

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isTradingHistoryOpen, setIsTradingHistoryOpen] = useState(false);
    const [isDisposalHistoryOpen, setIsDisposalHistoryOpen] = useState(false);

    // Dynamic granular permissions for sub-module tabs
    const permittedProductionTabs = useMemo(() => {
        const tabs: { id: string; label: string }[] = [];
        if (
            canViewSubModule(currentUserPerms.permissions, 'production', 'input', currentUserPerms.isSuperAdmin) ||
            canViewSubModule(currentUserPerms.permissions, 'production', 'queue', currentUserPerms.isSuperAdmin)
        ) {
            tabs.push({ id: 'input', label: 'INPUT PRODUKSI' });
        }
        if (canViewSubModule(currentUserPerms.permissions, 'production', 'history', currentUserPerms.isSuperAdmin)) {
            tabs.push({ id: 'report', label: 'LAPORAN PRODUKSI' });
        }
        return tabs;
    }, [currentUserPerms]);

    const permittedSalesOrderTabs = useMemo(() => {
        const tabs: { id: string; label: string }[] = [];
        if (
            canViewSubModule(currentUserPerms.permissions, 'sales_orders', 'list', currentUserPerms.isSuperAdmin) ||
            canViewSubModule(currentUserPerms.permissions, 'sales_orders', 'create', currentUserPerms.isSuperAdmin)
        ) {
            tabs.push({ id: 'list', label: 'SALES ORDER' });
        }
        if (canViewSubModule(currentUserPerms.permissions, 'sales_orders', 'sales_history', currentUserPerms.isSuperAdmin)) {
            tabs.push({ id: 'sales_history', label: 'RIWAYAT PENJUALAN' });
        }
        return tabs;
    }, [currentUserPerms]);

    const permittedLogisticsTabs = useMemo(() => {
        const tabs: { id: string; label: string }[] = [];
        if (canViewSubModule(currentUserPerms.permissions, 'logistics', 'stock', currentUserPerms.isSuperAdmin)) {
            tabs.push({ id: 'stock', label: 'INVENTARIS' });
        }
        if (canViewSubModule(currentUserPerms.permissions, 'logistics', 'delivery_orders', currentUserPerms.isSuperAdmin)) {
            tabs.push({ id: 'delivery_orders', label: 'SURAT JALAN' });
        }
        if (canViewSubModule(currentUserPerms.permissions, 'logistics', 'returns', currentUserPerms.isSuperAdmin)) {
            tabs.push({ id: 'returns', label: 'RETUR & TOLAKAN' });
        }
        if (canViewSubModule(currentUserPerms.permissions, 'logistics', 'daily_recap', currentUserPerms.isSuperAdmin)) {
            tabs.push({ id: 'daily_recap', label: 'DAILY RECAP' });
        }
        return tabs;
    }, [currentUserPerms]);

    const permittedFinanceTabs = useMemo(() => {
        const all = [
            { id: 'ledger', label: 'BUKU KAS / LEDGER' },
            { id: 'chicken_prices', label: 'HARGA AYAM KANDANG' },
            { id: 'invoices_list', label: 'INVOICES' },
            { id: 'expenses', label: 'BIAYA OPERASIONAL' },
            { id: 'salaries', label: 'PENGGAJIAN KARYAWAN' },
            { id: 'stock_value', label: 'SALDO & VALUASI STOK' },
            { id: 'profit_loss', label: 'LABA RUGI (PNL)' },
            { id: 'belanja_lb', label: 'BELANJA LB' },
            { id: 'hpp', label: 'ANALISIS HPP' },
        ];
        return all.filter(t => canViewSubModule(currentUserPerms.permissions, 'finance', t.id, currentUserPerms.isSuperAdmin));
    }, [currentUserPerms]);

    const permittedDatabaseTabs = useMemo(() => {
        const all = [
            { id: 'coops', label: 'NAMA KANDANG' },
            { id: 'plates', label: 'PLAT NOMOR' },
            { id: 'customers', label: 'CUSTOMER' },
            { id: 'items', label: 'NAMA ITEM' },
            { id: 'backup', label: 'BACKUP DATABASE' },
            ...(currentUserPerms.isSuperAdmin ? [{ id: 'users', label: 'PENGATURAN AKSES & AKUN' }] : []),
        ];
        return all.filter(t => {
            if (t.id === 'users') return currentUserPerms.isSuperAdmin;
            return canViewSubModule(currentUserPerms.permissions, 'database', t.id, currentUserPerms.isSuperAdmin);
        });
    }, [currentUserPerms]);

    // Keep active subtab synchronized with user permissions
    useEffect(() => {
        if (permittedProductionTabs.length > 0 && !permittedProductionTabs.some(t => t.id === productionTab)) {
            setProductionTab(permittedProductionTabs[0].id);
        }
    }, [permittedProductionTabs, productionTab]);

    useEffect(() => {
        if (permittedSalesOrderTabs.length > 0 && !permittedSalesOrderTabs.some(t => t.id === salesOrderTab)) {
            setSalesOrderTab(permittedSalesOrderTabs[0].id);
        }
    }, [permittedSalesOrderTabs, salesOrderTab]);

    useEffect(() => {
        if (permittedLogisticsTabs.length > 0 && !permittedLogisticsTabs.some(t => t.id === logisticsTab)) {
            setLogisticsTab(permittedLogisticsTabs[0].id);
        }
    }, [permittedLogisticsTabs, logisticsTab]);

    useEffect(() => {
        if (permittedFinanceTabs.length > 0 && !permittedFinanceTabs.some(t => t.id === financeTab)) {
            setFinanceTab(permittedFinanceTabs[0].id);
        }
    }, [permittedFinanceTabs, financeTab]);

    useEffect(() => {
        if (permittedDatabaseTabs.length > 0 && !permittedDatabaseTabs.some(t => t.id === databaseTab)) {
            setDatabaseTab(permittedDatabaseTabs[0].id);
        }
    }, [permittedDatabaseTabs, databaseTab]);

    useEffect(() => {
        if (!isAuthenticated || !activeView) return;
        const isAllowed = currentUserPerms.isSuperAdmin || (
            activeView !== 'dataLogger' &&
            currentUserPerms.permissions[activeView as AppModuleId] !== 'none'
        );
        if (!isAllowed) {
            setActiveView('');
        }
    }, [isAuthenticated, currentUserPerms, activeView]);

    const getCurrentLocation = useCallback(() => {
        let loc = '';
        if (!activeView) {
            loc = 'Beranda';
        } else if (activeView === 'reports') {
            loc = 'Dashboard';
        } else if (activeView === 'production') {
            loc = productionTab === 'report' ? 'Lap. Produksi' : 'Input Produksi';
        } else if (activeView === 'sales_orders') {
            loc = salesOrderTab === 'sales_history' ? 'Riwayat Penjualan' : 'Sales Order';
        } else if (activeView === 'logistics') {
            if (logisticsTab === 'stock') {
                loc = isHistoryOpen ? 'Log Stok' : isTradingHistoryOpen ? 'Riwayat Trading' : isDisposalHistoryOpen ? 'Riwayat Pemusnahan' : 'Inventaris';
            } else if (logisticsTab === 'delivery_orders') {
                loc = 'Surat Jalan';
            } else if (logisticsTab === 'returns') {
                loc = 'Retur & Tolakan DO';
            } else {
                loc = 'Daily Recap';
            }
        } else if (activeView === 'finance') {
            loc = financeTab.replace('_', ' ').toUpperCase();
        } else if (activeView === 'database') {
            loc = 'Data';
        } else if (activeView === 'dataLogger') {
            loc = 'Riwayat Aktivitas';
        }
        return loc || activeView.toUpperCase();
    }, [activeView, productionTab, salesOrderTab, logisticsTab, financeTab, isHistoryOpen, isTradingHistoryOpen, isDisposalHistoryOpen]);

    const [isLoading, setIsLoading] = useState(false);
    const [dbError, setDbError] = useState<string | null>(null);

    const [coops, setCoops] = useState<Coop[]>([]);
    const [licensePlates, setLicensePlates] = useState<string[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [masterItems, setMasterItems] = useState<MasterItem[]>(CHICKEN_PARTS.map(name => ({ name })));
    const [stock, setStock] = useState<StockItem[]>([]);
    const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
    const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
    const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
    const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
    const [customerDebts, setCustomerDebts] = useState<{ [key: string]: number }>({});
    const [productionLogs, setProductionLogs] = useState<any[]>([]);
    const [pendingLogs, setPendingLogs] = useState<any[]>([]);
    const [tradingPurchases, setTradingPurchases] = useState<TradingPurchaseRecord[]>([]);
    const [stockDisposals, setStockDisposals] = useState<StockDisposalRecord[]>([]);
    const [earlyStock, setEarlyStock] = useState<any[]>([]);
    const [isAllocating, setIsAllocating] = useState(false);
    const [isTradingPurchaseOpen, setIsTradingPurchaseOpen] = useState(false);
    const [isDisposalOpen, setIsDisposalOpen] = useState(false);
    const [tradingPurchaseToEdit, setTradingPurchaseToEdit] = useState<TradingPurchaseRecord | null>(null);
    const [disposalToEdit, setDisposalToEdit] = useState<StockDisposalRecord | null>(null);
    const [isOpnameOpen, setIsOpnameOpen] = useState(false);
    const [isAddingExpense, setIsAddingExpense] = useState(false);
    const [isAddingSalary, setIsAddingSalary] = useState(false);
    const [salaryImportData, setSalaryImportData] = useState<Omit<SalaryRecord, 'id'>[] | null>(null);
    const [isManualSJOpen, setIsManualSJOpen] = useState(false);
    const [isManualInvoiceOpen, setIsManualInvoiceOpen] = useState(false);
    const [isEndingInventoryOpen, setIsEndingInventoryOpen] = useState(false);

    // Sales Order & DO Return states
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [doReturns, setDoReturns] = useState<DOReturnRecord[]>([]);
    const [isSalesOrderOpen, setIsSalesOrderOpen] = useState(false);
    const [salesOrderToEdit, setSalesOrderToEdit] = useState<SalesOrder | null>(null);
    const [selectedSO, setSelectedSO] = useState<SalesOrder | null>(null);
    const [isCreateDOModalOpen, setIsCreateDOModalOpen] = useState(false);
    const [soForDO, setSoForDO] = useState<SalesOrder | null>(null);
    const [activeCreatingSOId, setActiveCreatingSOId] = useState<string>('');
    const [isDOReturnModalOpen, setIsDOReturnModalOpen] = useState(false);
    const [doForReturn, setDoForReturn] = useState<DeliveryOrder | null>(null);
    const [lockedSOs, setLockedSOs] = useState<Record<string, string>>({});
    const [lockedDOs, setLockedDOs] = useState<Record<string, string>>({});

    const [selectedSJ, setSelectedSJ] = useState<DeliveryOrder | null>(null);
    const [isReceivingMode, setIsReceivingMode] = useState(false);
    const [selectedInv, setSelectedInv] = useState<Invoice | null>(null);
    const [orderToInvoice, setOrderToInvoice] = useState<DeliveryOrder | null>(null);
    const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
    const [productionToEdit, setProductionToEdit] = useState<any | null>(null);
    const [pendingInvoiceOrder, setPendingInvoiceOrder] = useState<DeliveryOrder | null>(null);
    const [otherCursors, setOtherCursors] = useState<Record<string, { x: number, y: number, location?: string }>>({});
    const fetchIdRef = useRef(0);
    const loadedGroupsRef = useRef<Set<string>>(new Set());
    const rawDataRef = useRef<{
        coops: any[];
        customers: any[];
        masterItems: any[];
        plates: string[];
        currentStock: any[];
        productionLogs: any[];
        deliveryOrders: any[];
        invoices: any[];
        expenses: any[];
        salaries: any[];
        ledger: any[];
        stockLogs: any[];
        tradingPurchases: any[];
        stockDisposals: any[];
        earlyStock: any[];
        salesOrders: SalesOrder[];
        doReturns: DOReturnRecord[];
    }>({
        coops: [],
        customers: [],
        masterItems: [],
        plates: [],
        currentStock: [],
        productionLogs: [],
        deliveryOrders: [],
        invoices: [],
        expenses: [],
        salaries: [],
        ledger: [],
        stockLogs: [],
        tradingPurchases: [],
        stockDisposals: [],
        earlyStock: [],
        salesOrders: [],
        doReturns: []
    });

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const getRequiredGroups = useCallback(() => {
        if (!activeView && !orderToInvoice && !invoiceToEdit && !selectedInv) {
            return [];
        }
        const groups = new Set<string>(['master']);
        if (activeView === 'production') {
            groups.add('production_logs');
        } else if (activeView === 'sales_orders') {
            groups.add('sales_orders');
            groups.add('delivery_orders');
            if (salesOrderTab === 'sales_history') {
                groups.add('invoices');
            }
        } else if (activeView === 'logistics') {
            if (logisticsTab === 'stock') {
                if (isHistoryOpen || isOpnameOpen) groups.add('stock_logs');
                if (isTradingHistoryOpen) groups.add('trading_purchases');
                if (isDisposalHistoryOpen) groups.add('stock_disposals');
                if (isAllocating) groups.add('delivery_orders');
            } else if (logisticsTab === 'delivery_orders') {
                groups.add('delivery_orders');
                groups.add('invoices');
                groups.add('sales_orders');
                groups.add('ledger');
            } else if (logisticsTab === 'returns') {
                groups.add('do_returns');
                groups.add('delivery_orders');
            } else if (logisticsTab === 'daily_recap') {
                groups.add('production_logs');
                groups.add('delivery_orders');
                groups.add('trading_purchases');
                groups.add('stock_disposals');
                groups.add('stock_logs');
            }
        } else if (activeView === 'finance') {
            if (financeTab === 'chicken_prices' || financeTab === 'belanja_lb') {
                groups.add('production_logs');
            } else if (financeTab === 'expenses') {
                groups.add('expenses');
            } else if (financeTab === 'salaries') {
                groups.add('salaries');
            } else if (financeTab === 'invoices_list' || financeTab === 'ledger') {
                groups.add('invoices');
                groups.add('delivery_orders');
                groups.add('ledger');
                groups.add('sales_orders');
            } else if (financeTab === 'stock_value') {
                groups.add('stock_logs');
                groups.add('invoices');
                groups.add('production_logs');
                groups.add('delivery_orders');
                groups.add('early_stock');
            } else if (financeTab === 'hpp') {
                groups.add('production_logs');
                groups.add('expenses');
                groups.add('invoices');
            } else if (financeTab === 'profit_loss') {
                groups.add('invoices');
                groups.add('production_logs');
                groups.add('expenses');
                groups.add('salaries');
                groups.add('stock_logs');
                groups.add('trading_purchases');
                groups.add('stock_disposals');
                groups.add('ledger');
                groups.add('early_stock');
            }
        } else if (activeView === 'reports') {
            groups.add('production_logs');
            groups.add('delivery_orders');
            groups.add('invoices');
            groups.add('expenses');
            groups.add('salaries');
            groups.add('stock_logs');
            groups.add('ledger');
            groups.add('trading_purchases');
            groups.add('stock_disposals');
            groups.add('early_stock');
        } else if (activeView === 'database') {
            if (databaseTab === 'customers' || databaseTab === 'backup') {
                groups.add('invoices');
                groups.add('ledger');
            }
        }
        if (orderToInvoice || invoiceToEdit || selectedInv) {
            groups.add('invoices');
            groups.add('delivery_orders');
            groups.add('ledger');
            groups.add('sales_orders');
        }
        return Array.from(groups);
    }, [
        activeView, productionTab, salesOrderTab, logisticsTab, financeTab, databaseTab,
        isHistoryOpen, isTradingHistoryOpen, isDisposalHistoryOpen, isOpnameOpen,
        isAllocating, orderToInvoice, invoiceToEdit, selectedInv
    ]);

    const applyFetchedDataToState = useCallback((fetchedGroups: string[]) => {
        const d = rawDataRef.current;
        const hasGroup = (g: string) => fetchedGroups.includes(g);

        const finalMasterItems = (d.masterItems && d.masterItems.length > 0 ? d.masterItems : CHICKEN_PARTS.map(name => ({ name })))
            .sort((a: MasterItem, b: MasterItem) => sortChickenParts(a.name, b.name));

        if (hasGroup('master')) {
            setCoops(d.coops);
            setCustomers(d.customers);
            setLicensePlates(d.plates);
            setMasterItems(finalMasterItems);
            const stockMap = new Map(d.currentStock.map((s: any) => [s.item_name, Number(s.quantity) || 0]));
            setStock(finalMasterItems.map((item: { name: string }) => ({ name: item.name, quantity: stockMap.get(item.name) || 0 })));
        }

        if (hasGroup('trading_purchases')) setTradingPurchases(d.tradingPurchases);
        if (hasGroup('stock_disposals')) setStockDisposals(d.stockDisposals);
        if (hasGroup('early_stock')) setEarlyStock(d.earlyStock || []);

        if (hasGroup('expenses')) {
            setExpenses((d.expenses || []).map((e: any) => ({
                id: e.id,
                date: e.tanggal ? new Date(e.tanggal) : new Date(),
                category: e.kategori || 'N/A',
                amount: Number(e.jumlah || 0),
                description: e.description || '',
                proofImage: e.proof_image_url
            })));
        }

        if (hasGroup('salaries')) {
            setSalaries((d.salaries || []).map((s: any) => ({
                id: s.id,
                date: s.tanggal ? new Date(s.tanggal) : new Date(),
                employeeName: s.nama_karyawan || 'N/A',
                dailyRate: Number(s.gaji_harian || 0),
                daysWorked: Number(s.hari_kerja || 0),
                cashBon: Number(s.kasbon || 0),
                totalSalary: Number(s.total_gaji || 0),
                notes: s.catatan || ''
            })));
        }

        if (hasGroup('stock_logs')) {
            setStockLogs((d.stockLogs || []).map((l: any) => ({
                id: l.id,
                timestamp: new Date(l.timestamp),
                type: l.tipe as any,
                itemName: l.item_name,
                stockBefore: Number(l.stok_awal) || 0,
                change: Number(l.perubahan) || 0,
                stockAfter: Number(l.stok_akhir) || 0,
                notes: l.keterangan || ''
            })));
        }

        if (hasGroup('production_logs')) {
            const prodRecords = (d.productionLogs || []).map((row: SupabaseProductionLog) => ({
                id: row.id,
                date: new Date(row.tanggal_produksi),
                dateStr: row.tanggal_produksi,
                truckNumber: Number(row.mobil),
                coopName: row.nama_kandang,
                driver: row.driver,
                initialEkor: Number(row.ekor),
                initialKg: Number(row.kg),
                pricePerKg: Number(row.harga_beli_kg || 0),
                mortality: Number(row.kematian_ekor),
                mortalityKg: Number(row.kematian_kg),
                isApplied: row.is_applied,
                licensePlate: row.plat,
                items: { [row.item_name]: Number(row.qty) }
            }));
            const aggregatedProd: any[] = [];
            const aggregatedPending: any[] = [];
            const prodMap = new Map();
            const pendingMap = new Map();
            prodRecords.forEach((rec: any) => {
                const dateOnly = rec.dateStr || rec.date.toISOString().slice(0, 10);
                const key = `${dateOnly}-${rec.truckNumber}`;
                const itemName = Object.keys(rec.items)[0];
                const itemQty = Number(Object.values(rec.items)[0]);
                if (rec.isApplied) {
                    if (!prodMap.has(key)) { prodMap.set(key, { ...rec, items: {} }); aggregatedProd.push(prodMap.get(key)); }
                    prodMap.get(key).items[itemName] = (prodMap.get(key).items[itemName] || 0) + itemQty;
                } else {
                    if (!pendingMap.has(key)) { pendingMap.set(key, { ...rec, items: {} }); aggregatedPending.push(pendingMap.get(key)); }
                    pendingMap.get(key).items[itemName] = (pendingMap.get(key).items[itemName] || 0) + itemQty;
                }
            });
            setProductionLogs(aggregatedProd);
            setPendingLogs(aggregatedPending);
        }

        if (hasGroup('sales_orders')) {
            setSalesOrders(d.salesOrders || []);
        }

        if (hasGroup('do_returns')) {
            setDoReturns(d.doReturns || []);
        }

        const customerAddressMap = new Map((d.customers || []).map((c: any) => [c.name, c.address || '']) as Array<[string, string]>);

        let allInvoices: Invoice[] = [];
        if (hasGroup('invoices') || hasGroup('ledger') || hasGroup('delivery_orders') || hasGroup('master')) {
            const rawLedger = (d.ledger || []).map((l: any) => ({
                ...l,
                id: l.id,
                date: new Date(l.tanggal),
                timestamp: l.timestamp,
                debit: Number(l.debit) || 0,
                credit: Number(l.credit) || 0,
                balance: Number(l.balance) || 0,
                customerId: l.customer_id,
                description: l.keterangan || l.description || '',
                paymentMethod: l.metode_bayar,
                paymentProof: l.bukti_bayar
            }));
            if (hasGroup('ledger')) {
                setLedgerEntries(rawLedger);
            }

            const invMap = new Map<string, Invoice>();
            (d.invoices || []).forEach((row: SupabaseInvoice) => {
                if (!invMap.has(row.nomor_invoice)) {
                    invMap.set(row.nomor_invoice, {
                        id: row.nomor_invoice,
                        date: new Date(row.tanggal),
                        timestamp: row.timestamp,
                        deliveryOrderId: row.nomor_sj,
                        customer: row.customer || '',
                        customerAddress: customerAddressMap.get(row.customer || '') || '',
                        itemName: '',
                        items: [],
                        subtotal: 0,
                        previousDebt: 0,
                        totalAmount: 0,
                        transfer: 0,
                        cash: 0,
                        amountPaid: 0,
                        newDebt: 0,
                        qtyDiterima: 0,
                        keterangan: row.keterangan || '',
                        status: row.invoice_status || 'Unpaid',
                        paymentMethod: '-'
                    });
                }
                const inv = invMap.get(row.nomor_invoice)!;
                const valTotal = Number(row.total) || 0;
                const valQty = Number(row.qty_diterima) || 0;
                const valHarga = Number(row.harga) || 0;
                const existingItem = inv.items.find(i => i.name === row.item_name);
                if (existingItem) {
                    existingItem.quantity += valQty;
                    existingItem.total += valTotal;
                    existingItem.price = valHarga;
                } else {
                    inv.items.push({ name: row.item_name, quantity: valQty, price: valHarga, total: valTotal });
                }
                inv.transfer = Math.max(inv.transfer, Number(row.transfer) || 0);
                inv.cash = Math.max(inv.cash, Number(row.cash) || 0);
                inv.amountPaid = inv.transfer + inv.cash;
                inv.paymentMethod = (inv.transfer > 0 && inv.cash > 0) ? 'Transfer & Cash' : inv.transfer > 0 ? 'Transfer' : inv.cash > 0 ? 'Cash' : '-';
                inv.subtotal += valTotal;
                inv.qtyDiterima += valQty;
                if (row.keterangan && (!inv.keterangan.includes('[BIAYA_LAIN:') || !inv.keterangan.includes('[ALAMAT_TAGIHAN:')) && (row.keterangan.includes('[BIAYA_LAIN:') || row.keterangan.includes('[ALAMAT_TAGIHAN:'))) {
                    inv.keterangan = row.keterangan;
                }
            });

            invMap.forEach(inv => {
                const { cleanKeterangan, extraCosts, billingAddress } = parseInvoiceExtraCosts(inv.keterangan);
                inv.itemsSubtotal = inv.subtotal;
                inv.extraCosts = extraCosts;
                const extraTotal = extraCosts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
                inv.subtotal = inv.itemsSubtotal + extraTotal;
                inv.keterangan = cleanKeterangan;
                if (billingAddress !== undefined && billingAddress.trim() !== '') {
                    inv.customerAddress = billingAddress;
                }
            });

            allInvoices = Array.from(invMap.values());

            if (hasGroup('invoices') || hasGroup('ledger') || hasGroup('master')) {
                // Hitung pembayaran per invoice yang berasal dari entri Ledger (1 invoice maupun gabungan beberapa invoice)
                const ledgerPaidByInvId = new Map<string, number>();
                const unallocatedCreditsByCustomer = new Map<string, number>();

                rawLedger.forEach((l: any) => {
                    const creditAmt = Number(l.credit) || 0;
                    if (creditAmt <= 0) return;
                    const desc = String(l.description || l.keterangan || '');

                    // Pola 1: Alokasi nominal eksplisit per invoice, misal "INV/20261008/001 (Tgl 08 Okt 2026): Rp 100.000" atau "INV/20261008/001: Rp 100.000"
                    const explicitRegex = /(INV\/[A-Za-z0-9/_-]+)(?:\s*\([^)]*\))?\s*:\s*Rp\s*([\d.,]+)/gi;
                    let match: RegExpExecArray | null;
                    let matchedExplicit = false;
                    while ((match = explicitRegex.exec(desc)) !== null) {
                        matchedExplicit = true;
                        const invKey = match[1].trim().toUpperCase();
                        const parsedAmt = Number(match[2].replace(/\./g, '').replace(/,/g, '.')) || 0;
                        if (parsedAmt > 0) {
                            ledgerPaidByInvId.set(invKey, (ledgerPaidByInvId.get(invKey) || 0) + parsedAmt);
                        }
                    }

                    // Pola 2: Menyebutkan nomor invoice tanpa nominal per item (misal "Pembayaran Faktur INV/20261008/001")
                    if (!matchedExplicit) {
                        const invMentions = desc ? desc.match(/INV\/[A-Za-z0-9/_-]+/gi) : null;
                        if (invMentions && invMentions.length === 1) {
                            const invKey = invMentions[0].trim().toUpperCase();
                            ledgerPaidByInvId.set(invKey, (ledgerPaidByInvId.get(invKey) || 0) + creditAmt);
                        } else if (invMentions && invMentions.length > 1) {
                            let rem = creditAmt;
                            invMentions.forEach((rawId, idx) => {
                                if (rem <= 0) return;
                                const invKey = rawId.trim().toUpperCase();
                                const targetInv = allInvoices.find(i => i.id.trim().toUpperCase() === invKey);
                                const alreadyPaid = ((Number(targetInv?.transfer) || 0) + (Number(targetInv?.cash) || 0)) + (ledgerPaidByInvId.get(invKey) || 0);
                                const invRem = targetInv ? Math.max(0, targetInv.subtotal - alreadyPaid) : rem;
                                const alloc = idx === invMentions.length - 1 ? rem : Math.min(rem, invRem);
                                ledgerPaidByInvId.set(invKey, (ledgerPaidByInvId.get(invKey) || 0) + alloc);
                                rem -= alloc;
                            });
                        } else if (l.customerId) {
                            const custKey = String(l.customerId).trim().toUpperCase();
                            unallocatedCreditsByCustomer.set(custKey, (unallocatedCreditsByCustomer.get(custKey) || 0) + creditAmt);
                        }
                    }
                });

                // Pola 3: Jika ada pembayaran lama di Ledger yang belum mencantumkan nomor INV, alokasikan FIFO ke invoice pelanggan tersebut yang belum lunas
                if (unallocatedCreditsByCustomer.size > 0) {
                    unallocatedCreditsByCustomer.forEach((totalUnalloc, custKey) => {
                        let rem = totalUnalloc;
                        const custInvs = allInvoices
                            .filter(inv => inv.customer && inv.customer.trim().toUpperCase() === custKey)
                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                        for (const inv of custInvs) {
                            if (rem <= 0) break;
                            const invKey = inv.id.trim().toUpperCase();
                            const directPaid = (Number(inv.transfer) || 0) + (Number(inv.cash) || 0);
                            const alreadyPaid = directPaid + (ledgerPaidByInvId.get(invKey) || 0);
                            const invRem = Math.max(0, inv.subtotal - alreadyPaid);
                            if (invRem > 0) {
                                const alloc = Math.min(rem, invRem);
                                ledgerPaidByInvId.set(invKey, (ledgerPaidByInvId.get(invKey) || 0) + alloc);
                                rem -= alloc;
                            }
                        }
                    });
                }

                const customerInvoicesMap = new Map<string, Invoice[]>();
                allInvoices.forEach(inv => {
                    const directPaid = (Number(inv.transfer) || 0) + (Number(inv.cash) || 0);
                    const ledgerPaid = ledgerPaidByInvId.get(inv.id.trim().toUpperCase()) || 0;
                    inv.amountPaid = directPaid + ledgerPaid;
                    inv.previousDebt = 0;
                    inv.totalAmount = inv.subtotal;
                    inv.newDebt = Math.max(0, inv.subtotal - inv.amountPaid);
                    inv.status = inv.newDebt <= 0 ? 'Lunas' : inv.amountPaid > 0 ? 'Sebagian' : 'Unpaid';

                    if (!customerInvoicesMap.has(inv.customer)) customerInvoicesMap.set(inv.customer, []);
                    customerInvoicesMap.get(inv.customer)!.push(inv);
                });
                const customerLedgerMap = new Map<string, any[]>();
                rawLedger.forEach((l: { customerId: string }) => {
                    if (!customerLedgerMap.has(l.customerId)) customerLedgerMap.set(l.customerId, []);
                    customerLedgerMap.get(l.customerId)!.push(l);
                });

                const debts: { [key: string]: number } = {};
                (d.customers || []).forEach((c: any) => {
                    const customerInvoices = customerInvoicesMap.get(c.name) || [];
                    const customerLedger = customerLedgerMap.get(c.name) || [];
                    const events: { type: 'inv' | 'led'; date: Date; ts: string; ref: any }[] = [];
                    customerInvoices.forEach(inv => events.push({ type: 'inv', date: new Date(inv.date), ts: inv.timestamp || '', ref: inv }));
                    customerLedger.forEach((l: { date: string | number | Date; timestamp: any }) => events.push({ type: 'led', date: new Date(l.date), ts: l.timestamp || '', ref: l }));
                    events.sort((a, b) => a.date.getTime() - b.date.getTime() || a.ts.localeCompare(b.ts));
                    let runningBalance = 0;
                    events.forEach(event => {
                        if (event.type === 'inv') {
                            const inv = event.ref;
                            const directPaid = (Number(inv.transfer) || 0) + (Number(inv.cash) || 0);
                            runningBalance += inv.subtotal - directPaid;
                        } else {
                            const l = event.ref;
                            runningBalance += (Number(l.debit) || 0) - (Number(l.credit) || 0);
                        }
                    });
                    debts[c.name] = Math.max(0, runningBalance);
                });

                if (loadedGroupsRef.current.has('invoices')) setInvoices(allInvoices);
                if (loadedGroupsRef.current.has('invoices') || loadedGroupsRef.current.has('ledger')) setCustomerDebts(debts);
            }
        }

        if (hasGroup('delivery_orders') || hasGroup('invoices') || hasGroup('sales_orders') || hasGroup('master')) {
            if (loadedGroupsRef.current.has('delivery_orders')) {
                const sjMap = new Map<string, DeliveryOrder>();
                (d.deliveryOrders || []).forEach((row: any) => {
                    if (!sjMap.has(row.nomor_sj)) {
                        sjMap.set(row.nomor_sj, {
                            id: row.nomor_sj,
                            date: new Date(row.tanggal),
                            customer: row.customer,
                            customerAddress: customerAddressMap.get(row.customer) || '',
                            items: [],
                            receivedItems: [],
                            rejectedItems: [],
                            status: 'pending'
                        });
                    }
                    const sj = sjMap.get(row.nomor_sj)!;
                    const qtySent = Number(row.qty_kirim) || 0;
                    const qtyReceived = Number(row.qty_diterima) || 0;
                    const qtyRetur = Number(row.retur) || 0;
                    const qtySusut = Number(row.susut_selisih) || 0;
                    const existingItem = sj.items.find(i => i.name === row.nama_item);
                    if (existingItem) existingItem.quantity += qtySent; else sj.items.push({ name: row.nama_item, quantity: qtySent });
                    if (qtyReceived > 0) {
                        const existingReceived = sj.receivedItems?.find(ri => ri.name === row.nama_item);
                        if (existingReceived) existingReceived.quantity += qtyReceived; else sj.receivedItems?.push({ name: row.nama_item, quantity: qtyReceived });
                    }
                    if (qtyRetur > 0) {
                        const existingRejected = sj.rejectedItems?.find(ri => ri.name === row.nama_item);
                        if (existingRejected) existingRejected.quantity += qtyRetur; else sj.rejectedItems?.push({ name: row.nama_item, quantity: qtyRetur });
                    }
                    if ((sj.receivedItems && sj.receivedItems.length > 0) || (sj.rejectedItems && sj.rejectedItems.length > 0) || qtySusut > 0) {
                        sj.status = 'received';
                    }
                });

                const allSJs = Array.from(sjMap.values());
                const fetchedSOs = d.salesOrders || [];
                allSJs.forEach(sj => {
                    const associatedInv = allInvoices.find(inv =>
                        String(inv.deliveryOrderId || '')
                            .split(',')
                            .map(s => s.trim().toLowerCase())
                            .includes(sj.id.trim().toLowerCase())
                    );
                    if (associatedInv) sj.invoiceId = associatedInv.id;
                    const associatedSO = fetchedSOs.find((so: SalesOrder) =>
                        (so.deliveryOrderIds || []).some((id: string) => id.trim().toLowerCase() === sj.id.trim().toLowerCase())
                    );
                    if (associatedSO) {
                        sj.salesOrderId = associatedSO.id;
                        if (associatedSO.customerAddress && associatedSO.customerAddress.trim() !== '') {
                            sj.customerAddress = associatedSO.customerAddress;
                        }
                    }
                });
                setDeliveryOrders(allSJs);
            }
        }
    }, []);

    const fetchInitialData = useCallback(async (isSilent: boolean = false, forceReloadActive: boolean = true) => {
        const requiredGroups = getRequiredGroups();
        const groupsToFetch = forceReloadActive
            ? requiredGroups
            : requiredGroups.filter(g => !loadedGroupsRef.current.has(g));

        if (groupsToFetch.length === 0) return;

        const currentFetchId = ++fetchIdRef.current;
        if (!isSilent) setIsLoading(true);
        try {
            if (forceReloadActive) {
                // Invalidate cached groups outside active view so switching tabs later fetches fresh data
                loadedGroupsRef.current.clear();
            }
            const partialData = await db.fetchTableGroup(groupsToFetch, 300000);
            if (currentFetchId !== fetchIdRef.current) return;

            Object.assign(rawDataRef.current, partialData);
            groupsToFetch.forEach(g => loadedGroupsRef.current.add(g));
            applyFetchedDataToState(groupsToFetch);
            setDbError(null);
            if (!isSilent) setIsLoading(false);
        } catch (error: any) {
            console.error("Fetch Data Error:", error);
            setDbError(error.message);
            if (!isSilent) setIsLoading(false);
        }
    }, [getRequiredGroups, applyFetchedDataToState]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchInitialData(false, false);
        }
    }, [isAuthenticated, fetchInitialData]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const checkSession = () => {
            const loginTs = localStorage.getItem('loginTimestamp');
            if (loginTs && (Date.now() - parseInt(loginTs, 10) > 8 * 60 * 60 * 1000)) {
                alert('Sesi Anda telah berakhir (8 jam). Silakan login kembali.');
                handleLogout();
            }
        };
        const interval = setInterval(checkSession, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [isAuthenticated, currentUserName]);

    useEffect(() => {
        try { sessionStorage.setItem('rpa_active_view', activeView); } catch { }
    }, [activeView]);

    useEffect(() => {
        try { sessionStorage.setItem('rpa_finance_tab', financeTab); } catch { }
    }, [financeTab]);

    useEffect(() => {
        try { sessionStorage.setItem('rpa_logistics_tab', logisticsTab); } catch { }
    }, [logisticsTab]);

    useEffect(() => {
        try { sessionStorage.setItem('rpa_production_tab', productionTab); } catch { }
    }, [productionTab]);

    useEffect(() => {
        try { sessionStorage.setItem('rpa_sales_order_tab', salesOrderTab); } catch { }
    }, [salesOrderTab]);

    useEffect(() => {
        try { sessionStorage.setItem('rpa_database_tab', databaseTab); } catch { }
    }, [databaseTab]);

    useEffect(() => {
        try { sessionStorage.setItem('rpa_open_tabs', JSON.stringify(openTabs)); } catch { }
    }, [openTabs]);

    const currentLocationRef = useRef(getCurrentLocation());
    const fetchInitialDataRef = useRef(fetchInitialData);

    useEffect(() => {
        currentLocationRef.current = getCurrentLocation();
    }, [getCurrentLocation]);

    useEffect(() => {
        fetchInitialDataRef.current = fetchInitialData;
    }, [fetchInitialData]);

    const handleSyncOffline = useCallback(async () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        const { syncedCount, remainingCount } = await db.syncOfflineQueue();
        setPendingSyncCount(remainingCount);
        if (syncedCount > 0) {
            await fetchInitialDataRef.current(true, true);
        }
    }, []);

    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            void handleSyncOffline();
        };
        const handleOffline = () => {
            setIsOffline(true);
        };
        const handleQueueUpdated = (e: Event) => {
            const custom = e as CustomEvent<{ count: number }>;
            setPendingSyncCount(custom.detail?.count ?? getOfflineQueue().length);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('rpa-offline-queue-updated', handleQueueUpdated as EventListener);

        if (navigator.onLine && getOfflineQueue().length > 0) {
            void handleSyncOffline();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('rpa-offline-queue-updated', handleQueueUpdated as EventListener);
        };
    }, [handleSyncOffline]);

    const myLockingSO = useMemo(() => {
        if (!isCreateDOModalOpen) return '';
        return activeCreatingSOId || soForDO?.id || '';
    }, [isCreateDOModalOpen, activeCreatingSOId, soForDO]);

    const myLockingDOs = useMemo(() => {
        const raw = orderToInvoice?.id || invoiceToEdit?.deliveryOrderId || '';
        if (!raw) return [] as string[];
        return raw.split(',').map(s => s.trim()).filter(Boolean);
    }, [orderToInvoice, invoiceToEdit]);

    const myLockingSORef = useRef(myLockingSO);
    const myLockingDOsRef = useRef(myLockingDOs);

    useEffect(() => {
        myLockingSORef.current = myLockingSO;
    }, [myLockingSO]);

    useEffect(() => {
        myLockingDOsRef.current = myLockingDOs;
    }, [myLockingDOs]);

    useEffect(() => {
        if (realtimeStatus === 'connected') {
            const channel = supabase.channel('app-live-status');
            if (channel.state === 'joined') {
                channel.track({
                    online_at: new Date().toISOString(),
                    location: getCurrentLocation(),
                    lockingSO: myLockingSO,
                    lockingDOs: myLockingDOs
                }).catch(() => { });
            }
        }
    }, [getCurrentLocation, realtimeStatus, myLockingSO, myLockingDOs]);

    useEffect(() => {
        if (!isAuthenticated || !currentUserName) return;

        const channel = supabase.channel('app-live-status', {
            config: {
                presence: {
                    key: currentUserName,
                },
                broadcast: {
                    self: false
                }
            },
        });

        let timeoutId: ReturnType<typeof setTimeout>;

        let isSubscribed = false;

        channel
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();
                const users = Object.entries(newState).map(([key, presences]: [string, any]) => ({
                    user: key,
                    location: presences[0]?.location || 'Watching'
                }));
                setOnlineUsers(users);

                const nextLockedSOs: Record<string, string> = {};
                const nextLockedDOs: Record<string, string> = {};
                Object.entries(newState).forEach(([userKey, presences]: [string, any]) => {
                    if (userKey === currentUserName) return;
                    (presences || []).forEach((p: any) => {
                        if (p?.lockingSO) {
                            nextLockedSOs[String(p.lockingSO)] = userKey;
                        }
                        if (Array.isArray(p?.lockingDOs)) {
                            p.lockingDOs.forEach((doId: string) => {
                                if (doId) nextLockedDOs[String(doId).trim()] = userKey;
                            });
                        }
                    });
                });
                setLockedSOs(nextLockedSOs);
                setLockedDOs(nextLockedDOs);

                // Cleanup cursors for users who left
                setOtherCursors((prev: Record<string, { x: number, y: number, location?: string }>) => {
                    const newC = { ...prev };
                    const currentKeys = Object.keys(newState);
                    Object.keys(newC).forEach(k => {
                        if (!currentKeys.includes(k)) delete newC[k];
                    });
                    return newC;
                });
            })
            .on('broadcast', { event: 'cursor-move' }, (payload: { payload: { user: string; x: number; y: number; location?: string } }) => {
                setOtherCursors((prev: Record<string, { x: number, y: number, location?: string }>) => ({
                    ...prev,
                    [payload.payload.user]: { x: payload.payload.x, y: payload.payload.y, location: payload.payload.location }
                }));
            })
            .on('postgres_changes', { event: '*', schema: 'public' }, () => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    fetchInitialDataRef.current(true);
                }, 3000);
            })
            .subscribe(async (status: string) => {
                if (status === 'SUBSCRIBED') {
                    isSubscribed = true;
                    setRealtimeStatus('connected');
                    await channel.track({
                        online_at: new Date().toISOString(),
                        location: currentLocationRef.current,
                        lockingSO: myLockingSORef.current,
                        lockingDOs: myLockingDOsRef.current
                    });
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    isSubscribed = false;
                    setRealtimeStatus('error');
                }
            });

        let lastMove = 0;
        const handleMouseMove = (e: MouseEvent) => {
            if (!isSubscribed) return;
            const now = Date.now();
            if (now - lastMove > 300) {
                lastMove = now;
                channel.send({
                    type: 'broadcast',
                    event: 'cursor-move',
                    payload: {
                        user: currentUserName,
                        location: currentLocationRef.current,
                        x: e.clientX,
                        y: e.clientY
                    }
                });
            }
        };
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            clearTimeout(timeoutId);
            setRealtimeStatus('connecting');
            channel.unsubscribe();
        };
    }, [isAuthenticated, currentUserName]);

    const handleLogin = async (u: string, p: string) => {
        setIsLoading(true);
        try {
            const userData = await db.verifyUser(u, p);
            if (userData) {
                await db.addActivityLog(u, 'LOGIN', 'users', u);
                loadedGroupsRef.current.clear();
                setActiveView('');
                setOpenTabs([]);
                try {
                    sessionStorage.removeItem('rpa_active_view');
                    sessionStorage.removeItem('rpa_open_tabs');
                } catch { }
                setIsAuthenticated(true); setCurrentUserName(u); setUserRole(userData.role);
                localStorage.setItem('isLoggedIn', 'true'); localStorage.setItem('username', u); localStorage.setItem('userRole', userData.role);
                localStorage.setItem('loginTimestamp', Date.now().toString());
            } else { alert('Username atau password salah!'); }
        } catch (e: any) { alert('Error Login: ' + e.message); } finally { setIsLoading(false); }
    };

    const handleLogout = async () => {
        if (currentUserName) {
            try { await db.addActivityLog(currentUserName, 'LOGOUT', 'users', currentUserName); } catch (e) { }
        }
        setIsAuthenticated(false); setCurrentUserName(''); setUserRole('admin');
        setOpenTabs([]);
        try {
            localStorage.removeItem('isLoggedIn'); localStorage.removeItem('username'); localStorage.removeItem('userRole'); localStorage.removeItem('loginTimestamp');
            sessionStorage.removeItem('rpa_active_view'); sessionStorage.removeItem('rpa_finance_tab'); sessionStorage.removeItem('rpa_logistics_tab'); sessionStorage.removeItem('rpa_production_tab'); sessionStorage.removeItem('rpa_sales_order_tab'); sessionStorage.removeItem('rpa_database_tab'); sessionStorage.removeItem('rpa_open_tabs');
        } catch (e) { }
    };

    const handleApplyPending = async (record: any) => {
        try { const dateStr = new Date(record.date).toISOString().slice(0, 10); await db.applyProductionBatch(dateStr, record.truckNumber.toString(), currentUserName); await fetchInitialData(true); alert('Produksi berhasil di-apply ke stok.'); } catch (e: any) { alert('Gagal: ' + e.message); }
    };

    const handleInvoiceSubmit = async (invoicesArray: Omit<Invoice, 'id' | 'date' | 'timestamp'>[], isEdit: boolean = false, useLiveDebt: boolean = false) => {
        setIsLoading(true);
        try {
            // Determine the reference date: from invoiceToEdit if editing, or from orderToInvoice if creating
            let refDateStr: string;
            let refDate: Date;
            if (!isEdit && orderToInvoice) {
                const y = orderToInvoice.date.getUTCFullYear();
                const m = String(orderToInvoice.date.getUTCMonth() + 1).padStart(2, '0');
                const d = String(orderToInvoice.date.getUTCDate()).padStart(2, '0');
                refDateStr = `${y}-${m}-${d}`;
                refDate = orderToInvoice.date;
            } else if (isEdit && invoiceToEdit) {
                const y = invoiceToEdit.date.getUTCFullYear();
                const m = String(invoiceToEdit.date.getUTCMonth() + 1).padStart(2, '0');
                const d = String(invoiceToEdit.date.getUTCDate()).padStart(2, '0');
                refDateStr = `${y}-${m}-${d}`;
                refDate = invoiceToEdit.date;
            } else {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                refDateStr = `${y}-${m}-${d}`;
                refDate = new Date(`${refDateStr}T00:00:00Z`);
            }

            let invoiceId = isEdit ? invoicesArray[0].editInvoiceId! : '';

            if (!isEdit) {
                const [yearStr, monthStr, dayStr] = refDateStr.split('-');
                const datePart = `${dayStr}${monthStr}${yearStr.slice(-2)}`;

                // Use refDateStr to filter existing invoices for sequence numbering
                const sameDayInvoices = invoices.filter((inv: Invoice) => {
                    const y = inv.date.getUTCFullYear();
                    const m = String(inv.date.getUTCMonth() + 1).padStart(2, '0');
                    const d = String(inv.date.getUTCDate()).padStart(2, '0');
                    return `${y}-${m}-${d}` === refDateStr;
                });
                const lastInvSeqs = sameDayInvoices.map((inv: Invoice) => parseInt(inv.id.split('/').pop() || '0'));
                const nextInvSeq = (lastInvSeqs.length > 0 ? Math.max(...lastInvSeqs) : 0) + 1;
                invoiceId = `INV/${datePart}/${nextInvSeq.toString().padStart(3, '0')}`;
            }

            const dbEntries = invoicesArray.map(inv => ({
                tanggal: refDateStr,
                nomor_sj: inv.deliveryOrderId,
                nomor_invoice: invoiceId,
                customer: inv.customer,
                item_name: inv.itemName,
                harga: Number(inv.items[0]?.price) || 0,
                total: Number(inv.items[0]?.total) || 0,
                transfer: Number(inv.transfer) || 0,
                cash: Number(inv.cash) || 0,
                qty_diterima: Number(inv.qtyDiterima) || 0,
                keterangan: (serializeInvoiceExtraCosts(inv.keterangan || '', inv.extraCosts, inv.customerAddress) + (!useLiveDebt ? ' [REKAMAN]' : '')).trim(),
                invoice_status: inv.status
            }));

            if (isEdit) {
                await db.updateInvoice(invoiceId, dbEntries, currentUserName);
            } else {
                const savedId = await db.addInvoices(dbEntries, currentUserName);
                if (savedId) {
                    invoiceId = savedId;
                }
            }

            // Sync DO quantity
            const sjID = invoicesArray[0].deliveryOrderId;
            if (sjID && !sjID.startsWith('MANUAL-')) {
                const existingSJ = deliveryOrders.find((o: DeliveryOrder) => o.id === sjID);
                if (existingSJ) {
                    const adjustQty = (_name: string, q: number) => q;

                    const updatedOrder = { ...existingSJ, items: [...existingSJ.items], receivedItems: [...(existingSJ.receivedItems || [])] };
                    let hasChanges = false;

                    invoicesArray.forEach((inv: Omit<Invoice, 'id' | 'date' | 'timestamp'>) => {
                        const invItemObj = inv.items[0];
                        if (invItemObj) {
                            const foundItem = updatedOrder.items.find((i: AllocationItem) => i.name === inv.itemName);
                            if (foundItem) {
                                if (foundItem.quantity !== inv.qtyDiterima) {
                                    hasChanges = true;
                                    foundItem.quantity = inv.qtyDiterima; // Update qty_kirim to match invoice qty
                                }
                            } else {
                                // Added item in invoice
                                hasChanges = true;
                                updatedOrder.items.push({ name: inv.itemName, quantity: inv.qtyDiterima });
                            }

                            const foundReceived = updatedOrder.receivedItems?.find((ri: AllocationItem) => ri.name === inv.itemName);
                            if (foundReceived) {
                                if (foundReceived.quantity !== inv.qtyDiterima) {
                                    hasChanges = true;
                                    foundReceived.quantity = inv.qtyDiterima;
                                }
                            } else {
                                hasChanges = true;
                                if (!updatedOrder.receivedItems) updatedOrder.receivedItems = [];
                                updatedOrder.receivedItems.push({ name: inv.itemName, quantity: inv.qtyDiterima });
                            }
                        }
                    });

                    // Actually, if we just call handleDeliveryOrderEdit, it will figure out the stock adjustments!
                    if (hasChanges) {
                        try {
                            const { data: previousData } = await supabase.from('delivery_orders').select('*').eq('nomor_sj', sjID);
                            const doEntries = updatedOrder.items.map((it: AllocationItem) => {
                                const qtyKirim = it.quantity;
                                const qtyDiterima = updatedOrder.receivedItems?.find((ri: AllocationItem) => ri.name === it.name)?.quantity || 0;
                                return {
                                    tanggal: updatedOrder.date.toISOString().slice(0, 10),
                                    nomor_sj: sjID,
                                    customer: updatedOrder.customer,
                                    nama_item: it.name,
                                    qty_kirim: qtyKirim,
                                    qty_kirim2: adjustQty(it.name, qtyKirim),
                                    qty_diterima: qtyDiterima,
                                    qty_diterima2: adjustQty(it.name, qtyDiterima),
                                    retur: updatedOrder.rejectedItems?.find((ri: AllocationItem) => ri.name === it.name)?.quantity || 0
                                };
                            });

                            if (previousData) {
                                for (const it of updatedOrder.items) {
                                    const prevItem = previousData.find((prev: any) => prev.nama_item === it.name);
                                    const qtyKirim = it.quantity;
                                    const prevQtyKirim = prevItem ? Number(prevItem.qty_kirim) : 0;
                                    if (qtyKirim !== prevQtyKirim) {
                                        const diff = qtyKirim - prevQtyKirim;
                                        const kgDiff = adjustQty(it.name, diff);
                                        if (kgDiff !== 0) {
                                            await db.adjustStock(
                                                it.name,
                                                -kgDiff,
                                                'Alokasi',
                                                `Update kuantitas SJ ${sjID} dari Invoice: dari ${prevQtyKirim} menjadi ${qtyKirim}`,
                                                currentUserName
                                            );
                                        }
                                    }
                                }
                                for (const prev of previousData) {
                                    const stillExists = updatedOrder.items.some((it: AllocationItem) => it.name === prev.nama_item);
                                    if (!stillExists) {
                                        const kgQty = adjustQty(prev.nama_item, Number(prev.qty_kirim));
                                        if (kgQty > 0) {
                                            await db.adjustStock(
                                                prev.nama_item,
                                                kgQty,
                                                'Alokasi',
                                                `Hapus item SJ ${sjID} dari Invoice`,
                                                currentUserName
                                            );
                                        }
                                    }
                                }
                            }
                            await supabase.from('delivery_orders').delete().eq('nomor_sj', sjID);
                            await supabase.from('delivery_orders').insert(doEntries);
                        } catch (err) {
                            console.error("Gagal update SJ dari Invoice", err);
                        }
                    }
                } else if (sjID.includes(',')) {
                    // Jika Invoice merupakan gabungan lebih dari 1 SJ (Combine SJ), pastikan SJ yang masih berstatus pending otomatis tercatat qty_diterima = qty_kirim
                    const combinedSJIds = sjID.split(',').map(s => s.trim()).filter(Boolean);
                    for (const singleSJId of combinedSJIds) {
                        const sjObj = deliveryOrders.find((o: DeliveryOrder) => o.id.trim().toLowerCase() === singleSJId.toLowerCase());
                        if (sjObj && sjObj.status === 'pending') {
                            try {
                                const { data: sjRows } = await supabase.from('delivery_orders').select('*').eq('nomor_sj', sjObj.id);
                                if (sjRows && sjRows.length > 0) {
                                    for (const r of sjRows) {
                                        if (Number(r.qty_diterima || 0) === 0 && Number(r.qty_kirim || 0) > 0) {
                                            await supabase
                                                .from('delivery_orders')
                                                .update({
                                                    qty_diterima: Number(r.qty_kirim),
                                                    qty_diterima2: Number(r.qty_kirim2 || r.qty_kirim)
                                                })
                                                .eq('id', r.id);
                                        }
                                    }
                                }
                            } catch (err) {
                                console.warn(`Gagal auto-confirm qty_diterima untuk SJ gabungan ${singleSJId}:`, err);
                            }
                        }
                    }
                }
            }

            setOrderToInvoice(null);
            setInvoiceToEdit(null);
            setSelectedSJ(null);

            const itemsSubtotal = invoicesArray.reduce((sum, inv) => sum + inv.subtotal, 0);
            const extraCosts = invoicesArray[0].extraCosts || [];
            const extraTotal = extraCosts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
            const savedInvoice: Invoice = {
                ...invoicesArray[0],
                keterangan: ((invoicesArray[0].keterangan || '').replace('[REKAMAN]', '').trim() + (!useLiveDebt ? ' [REKAMAN]' : '')).trim(),
                id: invoiceId,
                date: refDate,
                timestamp: new Date().toISOString(),
                items: invoicesArray.flatMap(inv => inv.items),
                itemsSubtotal,
                extraCosts,
                subtotal: itemsSubtotal + extraTotal,
                totalAmount: itemsSubtotal + extraTotal,
                newDebt: itemsSubtotal + extraTotal,
                qtyDiterima: invoicesArray.reduce((sum, inv) => sum + inv.qtyDiterima, 0),
            };
            await fetchInitialData(true);
            setActiveView('finance');
            setFinanceTab('invoices_list');
            setSelectedInv(savedInvoice);
        } catch (error: any) {
            alert('Gagal: ' + error.message);
            void fetchInitialData(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAllocationSubmit = async (allocs: { customer: string; items: AllocationItem[] }[], selectedDate: string) => {
        setIsLoading(true);
        try {
            const todayStr = selectedDate;
            const [year, month, day] = selectedDate.split('-').map(Number);
            const datePart = `${day.toString().padStart(2, '0')}${month.toString().padStart(2, '0')}${year.toString().slice(-2)}`;

            const todaySJs = deliveryOrders.filter((o: DeliveryOrder) => new Date(o.date).toISOString().slice(0, 10) === todayStr);
            const lastSeqs = todaySJs.map((sj: DeliveryOrder) => parseInt(sj.id.split('/').pop() || '0'));
            let nextSeqNum = (lastSeqs.length > 0 ? Math.max(...lastSeqs) : 0) + 1;

            const adjustQty = (_name: string, q: number) => q;

            const deliveryOrderPromises = [];
            const createdSJList: DeliveryOrder[] = [];
            for (const al of allocs) {
                const chunks: AllocationItem[][] = []; for (let i = 0; i < al.items.length; i += 15) { chunks.push(al.items.slice(i, i + 15)); }
                for (const chunk of chunks) {
                    const sjNumber = `DO/${datePart}/${nextSeqNum.toString().padStart(3, '0')}`;
                    nextSeqNum++;
                    createdSJList.push({
                        id: sjNumber,
                        date: new Date(todayStr),
                        customer: al.customer,
                        items: chunk,
                        receivedItems: [],
                        rejectedItems: [],
                        status: 'pending'
                    });
                    deliveryOrderPromises.push(
                        db.addDeliveryOrders(chunk.map(it => ({
                            tanggal: todayStr,
                            nomor_sj: sjNumber,
                            customer: al.customer,
                            nama_item: it.name,
                            qty_kirim: it.quantity,
                            qty_kirim2: adjustQty(it.name, it.quantity)
                        })), currentUserName)
                    );
                }
            }
            await Promise.all(deliveryOrderPromises);
            setIsAllocating(false);
            setLogisticsTab('delivery_orders');
            await fetchInitialData(true);
            if (createdSJList.length > 0) {
                setSelectedSJ(createdSJList[0]);
                setIsReceivingMode(false);
            }
        } catch (error: any) { alert('Gagal membuat SJ: ' + error.message); }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        if (pendingInvoiceOrder) {
            handleSelectInvoicing(pendingInvoiceOrder);
            setPendingInvoiceOrder(null);
        }
    }, [invoices, pendingInvoiceOrder]);

    const mergeOrderIntoInvoice = (order: DeliveryOrder, prevInv: Invoice) => {
        // Merge DO numbers cleanly
        const existingDOs = prevInv.deliveryOrderId
            ? prevInv.deliveryOrderId.split(',').map(s => s.trim()).filter(Boolean)
            : [];
        const newDOs = order.id.split(',').map(s => s.trim()).filter(Boolean);
        const combinedDOs = Array.from(new Set([...existingDOs, ...newDOs])).join(', ');

        // Merge items (summing quantities of existing items, appending new items)
        const itemMap = new Map<string, { quantity: number; price: number }>();
        prevInv.items.forEach(it => {
            itemMap.set(it.name, { quantity: it.quantity, price: it.price });
        });

        const orderItems = order.receivedItems && order.receivedItems.length > 0 ? order.receivedItems : order.items;
        orderItems.forEach(it => {
            const current = itemMap.get(it.name);
            if (current) {
                current.quantity += it.quantity;
            } else {
                const soPrice = soDefaultPrices[it.name] || 0;
                itemMap.set(it.name, { quantity: it.quantity, price: soPrice });
            }
        });

        const mergedItems = Array.from(itemMap.entries()).map(([name, data]) => ({
            name,
            quantity: data.quantity,
            price: data.price,
            total: data.quantity * data.price
        }));

        const mergedSubtotal = mergedItems.reduce((acc, it) => acc + it.total, 0);

        const updatedInvoice: Invoice = {
            ...prevInv,
            deliveryOrderId: combinedDOs,
            items: mergedItems,
            subtotal: mergedSubtotal,
            qtyDiterima: mergedItems.reduce((acc, it) => acc + it.quantity, 0),
            totalAmount: mergedSubtotal + prevInv.previousDebt,
            newDebt: Math.max(0, (mergedSubtotal + prevInv.previousDebt) - prevInv.amountPaid)
        };

        setInvoiceToEdit(updatedInvoice);
        setOrderToInvoice({
            ...order,
            id: combinedDOs,
            items: mergedItems.map(it => ({ name: it.name, quantity: it.quantity })),
            receivedItems: mergedItems.map(it => ({ name: it.name, quantity: it.quantity }))
        });
    };

    const handleCombineInvoicing = async (orders: DeliveryOrder[], salesOrderId: string, mergeIntoInvoice?: Invoice) => {
        if (!orders || orders.length === 0) return;

        // 1. Cek apakah ada SJ yang sedang dikunci oleh user lain
        for (const o of orders) {
            const lockedByUser = lockedDOs[o.id];
            if (lockedByUser) {
                alert(`Surat Jalan ${o.id} sedang dalam proses pembuatan Invoice oleh "${lockedByUser}". Silakan tunggu agar tidak terjadi double invoice.`);
                return;
            }
        }

        // 2. Cek langsung ke database apakah salah satu SJ ini baru saja dibuatkan invoice oleh pengguna Finance lain
        try {
            for (const o of orders) {
                const { data: liveInvRows } = await supabase
                    .from('invoices')
                    .select('nomor_invoice, nomor_sj')
                    .ilike('nomor_sj', `%${o.id}%`);

                if (liveInvRows && liveInvRows.length > 0) {
                    const matched = liveInvRows.find(r =>
                        String(r.nomor_sj || '')
                            .split(',')
                            .map(s => s.trim().toLowerCase())
                            .includes(o.id.trim().toLowerCase())
                    );
                    if (matched && (!mergeIntoInvoice || matched.nomor_invoice !== mergeIntoInvoice.id)) {
                        alert(`Surat Jalan ${o.id} sudah dibuatkan Faktur Invoice (${matched.nomor_invoice}) oleh pengguna Finance lain! Data akan disinkronkan.`);
                        await fetchInitialData(true);
                        return;
                    }
                }
            }
        } catch (e) {
            console.warn('Pre-check live combine invoice warning:', e);
        }

        // 3. Gabungkan daftar Nomor SJ dan rincian kuantitas barangnya
        const combinedMap = new Map<string, number>();
        const sjNumbers: string[] = [];
        let latestDate = orders[0].date;

        orders.forEach((sj: DeliveryOrder) => {
            if (!sjNumbers.includes(sj.id)) {
                sjNumbers.push(sj.id);
            }
            if (new Date(sj.date).getTime() > new Date(latestDate).getTime()) {
                latestDate = sj.date;
            }
            const itemsToCount = sj.receivedItems && sj.receivedItems.length > 0 ? sj.receivedItems : sj.items;
            itemsToCount.forEach((it: AllocationItem) => {
                combinedMap.set(it.name, (combinedMap.get(it.name) || 0) + it.quantity);
            });
        });

        const mergedItems = Array.from(combinedMap.entries()).map(([name, quantity]) => ({ name, quantity }));
        const combinedOrder: DeliveryOrder = {
            ...orders[0],
            id: sjNumbers.join(', '),
            date: latestDate,
            salesOrderId: salesOrderId || orders[0].salesOrderId,
            items: mergedItems,
            receivedItems: mergedItems
        };

        if (mergeIntoInvoice) {
            mergeOrderIntoInvoice(combinedOrder, mergeIntoInvoice);
            return;
        }

        setInvoiceToEdit(null);
        setOrderToInvoice(combinedOrder);
    };

    const handleSelectInvoicing = async (order: DeliveryOrder) => {
        const lockedByUser = lockedDOs[order.id];
        if (lockedByUser) {
            alert(`Surat Jalan ${order.id} sedang dalam proses pembuatan Invoice oleh "${lockedByUser}". Silakan tunggu agar tidak terjadi double invoice.`);
            return;
        }

        if (order.invoiceId) {
            const existingInv = invoices.find((inv: Invoice) => inv.id === order.invoiceId);
            if (existingInv) {
                setInvoiceToEdit(existingInv);
                setOrderToInvoice(order);
                return;
            }
        }

        // Cek langsung ke database apakah SJ ini baru saja dibuatkan invoice oleh pengguna Finance lain
        try {
            const { data: liveInvRows } = await supabase
                .from('invoices')
                .select('nomor_invoice, nomor_sj')
                .ilike('nomor_sj', `%${order.id}%`);

            if (liveInvRows && liveInvRows.length > 0) {
                const matched = liveInvRows.find(r =>
                    String(r.nomor_sj || '')
                        .split(',')
                        .map(s => s.trim().toLowerCase())
                        .includes(order.id.trim().toLowerCase())
                );
                if (matched) {
                    alert(`Surat Jalan ${order.id} sudah dibuatkan Faktur Invoice (${matched.nomor_invoice}) oleh pengguna Finance lain! Data akan disinkronkan.`);
                    await fetchInitialData(true);
                    return;
                }
            }
        } catch (e) {
            console.warn('Pre-check live invoice warning:', e);
        }

        // Opsi penggabungan HANYA jika berasal dari Sales Order (SO) yang sama
        if (order.salesOrderId && order.salesOrderId.trim() !== '') {
            const targetSOId = order.salesOrderId.trim();

            // 1. Cek apakah ada invoice aktif yang sebelumnya sudah dibuat dari Sales Order yang sama
            const sameSOInvoices = invoices.filter(inv => {
                if (inv.status === 'Lunas') return false;
                if (inv.customer.trim().toLowerCase() !== order.customer.trim().toLowerCase()) return false;
                const invDOList = (inv.deliveryOrderId || '').split(',').map(s => s.trim());
                return deliveryOrders.some(d =>
                    d.salesOrderId === targetSOId &&
                    invDOList.includes(d.id)
                );
            });

            if (sameSOInvoices.length > 0) {
                const prevInv = sameSOInvoices[0];
                const wantsMerge = window.confirm(
                    `Pengiriman Surat Jalan ${order.id} berasal dari Sales Order yang sama (${targetSOId}) dengan Faktur ${prevInv.id}.\n\n` +
                    `Apakah pengiriman ini ingin DIGABUNGKAN dan DITAMBAHKAN ke Faktur ${prevInv.id} sebelumnya (sehingga invoice menjadi satu)?\n\n` +
                    `• Klik OK: Gabungkan ke Faktur ${prevInv.id}\n` +
                    `• Klik Batal: Terbitkan Faktur Baru terpisah`
                );
                if (wantsMerge) {
                    mergeOrderIntoInvoice(order, prevInv);
                    return;
                }
            }

            // 2. Cek apakah ada DO lain yang sudah diterima dari SO yang SAMA yang belum di-invoice (dan tidak sedang dikunci user lain)
            const otherReadyDOsSameSO = deliveryOrders.filter((o: DeliveryOrder) =>
                o.id !== order.id &&
                o.salesOrderId === targetSOId &&
                (o.status === 'received' || o.status === 'revised') &&
                !o.invoiceId &&
                !lockedDOs[o.id]
            );

            if (otherReadyDOsSameSO.length > 0) {
                const allDOsOfSO = [order, ...otherReadyDOsSameSO];
                const sjList = allDOsOfSO.map(d => d.id).join(', ');
                const wantsCombine = window.confirm(
                    `Ditemukan ${allDOsOfSO.length} pengiriman Surat Jalan dari Sales Order yang sama (${targetSOId}):\n${sjList}\n\n` +
                    `Apakah Anda ingin menggabungkan seluruh pengiriman dari Sales Order ini menjadi 1 faktur invoice sekaligus?`
                );
                if (wantsCombine) {
                    const combinedMap = new Map<string, number>();
                    const sjNumbers: string[] = [];
                    allDOsOfSO.forEach((sj: DeliveryOrder) => {
                        sjNumbers.push(sj.id);
                        const itemsToCount = sj.receivedItems && sj.receivedItems.length > 0 ? sj.receivedItems : sj.items;
                        itemsToCount.forEach((it: AllocationItem) => {
                            combinedMap.set(it.name, (combinedMap.get(it.name) || 0) + it.quantity);
                        });
                    });
                    const mergedItems = Array.from(combinedMap.entries()).map(([name, quantity]) => ({ name, quantity }));
                    setOrderToInvoice({
                        ...order,
                        id: sjNumbers.join(', '),
                        items: mergedItems,
                        receivedItems: mergedItems
                    });
                    return;
                }
            }
        }

        setOrderToInvoice(order);
    };

    const handleDeleteProduction = async (date: string, truckNumber: string) => {
        if (!window.confirm(`Hapus data produksi Mobil #${truckNumber} tanggal ${date}?`)) return;
        try { await db.deleteProductionBatch(date, truckNumber, currentUserName); await fetchInitialData(true); alert('Data produksi dihapus.'); } catch (e: any) { alert('Gagal: ' + e.message); }
    };

    const handleDeleteSJ = async (sjNumber: string) => {
        if (!window.confirm(`Hapus Surat Jalan ${sjNumber}?`)) return;
        try { await db.deleteDeliveryOrder(sjNumber, currentUserName); await fetchInitialData(true); alert('SJ Berhasil dihapus.'); } catch (e: any) { alert('Gagal: ' + e.message); }
    };

    const handleSaveSalesOrder = async (order: SalesOrder) => {
        setIsLoading(true);
        try {
            await db.saveSalesOrder(order, currentUserName);
            await fetchInitialData(true);
            setIsSalesOrderOpen(false);
            setSalesOrderToEdit(null);
            alert(`Sales Order ${order.id} berhasil disimpan!`);
        } catch (error: any) {
            alert('Gagal menyimpan Sales Order: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseSalesOrder = async (soId: string) => {
        const targetSO = salesOrders.find(so => so.id === soId);
        if (!targetSO) return;
        if (!window.confirm(`Konfirmasi penutupan Sales Order ${soId} oleh Finance?\n\nStatus SO akan diubah menjadi 'completed' (Selesai/Closed).`)) {
            return;
        }
        setIsLoading(true);
        try {
            const todayStr = new Date().toLocaleDateString('id-ID');
            const updatedSO: SalesOrder = {
                ...targetSO,
                status: 'completed',
                notes: ((targetSO.notes || '').replace(/\[CLOSED BY FINANCE.*?\]/g, '').trim() + ` [CLOSED BY FINANCE ${todayStr}]`).trim()
            };
            await db.saveSalesOrder(updatedSO, currentUserName);
            await fetchInitialData(true);
            alert(`Sales Order ${soId} berhasil ditutup (Close) oleh Finance!`);
        } catch (error: any) {
            alert('Gagal menutup Sales Order: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteSalesOrder = async (id: string) => {
        if (!window.confirm(`Hapus Sales Order ${id}?`)) return;
        setIsLoading(true);
        try {
            await db.deleteSalesOrder(id, currentUserName);
            await fetchInitialData(true);
            alert('Sales Order berhasil dihapus.');
        } catch (error: any) {
            alert('Gagal menghapus Sales Order: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateDOFromSO = async (payload: {
        soId: string;
        deliveryOrderId: string;
        date: string;
        customer: string;
        items: { name: string; quantity: number }[];
    }) => {
        setIsLoading(true);
        try {
            if (lockedSOs[payload.soId]) {
                alert(`Sales Order ${payload.soId} sedang dibuatkan Surat Jalan oleh "${lockedSOs[payload.soId]}". Pembuatan dibatalkan untuk mencegah double Surat Jalan.`);
                setIsLoading(false);
                return;
            }

            const existingDO = deliveryOrders.find(d => d.id.toLowerCase() === payload.deliveryOrderId.toLowerCase());
            if (existingDO) {
                alert(`Nomor DO ${payload.deliveryOrderId} sudah ada! Silakan gunakan nomor lain.`);
                setIsLoading(false);
                return;
            }

            // Cek langsung ke Supabase untuk mencegah 2 orang membuat DO pada SO yang sama secara bersamaan
            const localSO = salesOrders.find(so => so.id === payload.soId);
            const { data: liveSORow } = await supabase
                .from('sales_orders')
                .select('*')
                .eq('id', payload.soId)
                .maybeSingle();

            if (liveSORow) {
                if (liveSORow.status === 'completed' || liveSORow.status === 'cancelled') {
                    alert(`Sales Order ${payload.soId} sudah berstatus "${liveSORow.status}" (kemungkinan baru saja dibuatkan Surat Jalan oleh pengguna lain). Data akan diperbarui.`);
                    await fetchInitialData(true);
                    setIsCreateDOModalOpen(false);
                    setSoForDO(null);
                    setActiveCreatingSOId('');
                    setIsLoading(false);
                    return;
                }

                const liveDOIds: string[] = Array.isArray(liveSORow.delivery_order_ids)
                    ? liveSORow.delivery_order_ids
                    : (typeof liveSORow.delivery_order_ids === 'string' ? JSON.parse(liveSORow.delivery_order_ids || '[]') : []);
                const localDOIds: string[] = localSO?.deliveryOrderIds || [];

                if (liveDOIds.length > localDOIds.length) {
                    const newlyAdded = liveDOIds.filter(id => !localDOIds.includes(id));
                    alert(`Sales Order ${payload.soId} baru saja diterbitkan Surat Jalan (${newlyAdded.join(', ')}) oleh pengguna lain! Data akan diperbarui terlebih dahulu agar tidak terjadi double Surat Jalan.`);
                    await fetchInitialData(true);
                    setIsLoading(false);
                    return;
                }
            }

            // 1. Pastikan customer terdaftar di master_customers (cocokkan huruf besar/kecil)
            const matchedCustomer = customers.find(c => c.name.trim().toLowerCase() === payload.customer.trim().toLowerCase());
            const finalCustomerName = matchedCustomer ? matchedCustomer.name : payload.customer.trim().toUpperCase();
            if (!matchedCustomer && finalCustomerName) {
                try {
                    await supabase.from('master_customers').upsert({ name: finalCustomerName, address: '' }, { onConflict: 'name' });
                } catch (custErr) {
                    console.warn('Auto upsert master_customers warning:', custErr);
                }
            }

            // 2. Pastikan semua item terdaftar di master_items
            for (const it of payload.items) {
                const matchedItem = masterItems.find(m => m.name.trim().toLowerCase() === it.name.trim().toLowerCase());
                const finalItemName = matchedItem ? matchedItem.name : it.name.trim().toUpperCase();
                if (!matchedItem && finalItemName) {
                    try {
                        await supabase.from('master_items').upsert({ name: finalItemName }, { onConflict: 'name' });
                    } catch (itemErr) {
                        console.warn('Auto upsert master_items warning:', itemErr);
                    }
                }
            }

            // 3. Siapkan baris DO dengan data lengkap (termasuk timestamp, retur, qty_diterima)
            const nowIso = new Date().toISOString();
            const doRows = payload.items.map(it => {
                const matchedItem = masterItems.find(m => m.name.trim().toLowerCase() === it.name.trim().toLowerCase());
                const finalItemName = matchedItem ? matchedItem.name : it.name.trim().toUpperCase();
                return {
                    tanggal: payload.date,
                    nomor_sj: payload.deliveryOrderId,
                    customer: finalCustomerName,
                    nama_item: finalItemName,
                    qty_kirim: Number(it.quantity) || 0,
                    qty_kirim2: Number(it.quantity) || 0,
                    qty_diterima: 0,
                    retur: 0,
                    susut_selisih: 0,
                    timestamp: nowIso
                };
            });

            // 4. Masukkan ke tabel delivery_orders & potong stok
            await db.addDeliveryOrders(doRows, currentUserName);

            // 5. Update status dan kuantitas pemenuhan pada Sales Order
            const targetSO = salesOrders.find(so => so.id === payload.soId);
            if (targetSO) {
                const updatedItems = targetSO.items.map(it => {
                    const shipped = payload.items.find(pi => pi.name.trim().toLowerCase() === it.name.trim().toLowerCase());
                    const newlyFulfilled = shipped ? Number(shipped.quantity) : 0;
                    return {
                        ...it,
                        fulfilledQty: (Number(it.fulfilledQty) || 0) + newlyFulfilled
                    };
                });

                const allFulfilled = updatedItems.every(it => (Number(it.fulfilledQty) || 0) >= Number(it.quantity));
                const someFulfilled = updatedItems.some(it => (Number(it.fulfilledQty) || 0) > 0);
                const newStatus: SalesOrderStatus = allFulfilled ? 'completed' : someFulfilled ? 'partial' : 'pending';

                const existingDOIds = targetSO.deliveryOrderIds || [];
                const updatedSO: SalesOrder = {
                    ...targetSO,
                    items: updatedItems,
                    status: newStatus,
                    deliveryOrderIds: existingDOIds.includes(payload.deliveryOrderId)
                        ? existingDOIds
                        : [...existingDOIds, payload.deliveryOrderId]
                };

                await db.saveSalesOrder(updatedSO, currentUserName);
            }

            // 6. Refresh data dan arahkan ke tab Surat Jalan
            await fetchInitialData(true);
            setIsCreateDOModalOpen(false);
            setSoForDO(null);
            setActiveCreatingSOId('');

            setActiveView('logistics');
            setLogisticsTab('delivery_orders');

            // Langsung tampilkan preview/detail Surat Jalan (DO)
            const createdDO: DeliveryOrder = {
                id: payload.deliveryOrderId,
                date: new Date(payload.date),
                customer: finalCustomerName,
                customerAddress: targetSO?.customerAddress || matchedCustomer?.address || '',
                items: payload.items.map(it => ({ name: it.name, quantity: it.quantity })),
                receivedItems: [],
                rejectedItems: [],
                status: 'pending',
                salesOrderId: payload.soId
            };
            setSelectedSJ(createdDO);
            setIsReceivingMode(false);
        } catch (error: any) {
            console.error('Error creating DO from SO:', error);
            alert('Gagal menerbitkan Surat Jalan (DO): ' + (error.message || error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveDOReturns = async (records: DOReturnRecord[]) => {
        setIsLoading(true);
        try {
            for (const rec of records) {
                await db.saveDOReturn(rec, currentUserName);
            }
            await fetchInitialData(true);
            setIsDOReturnModalOpen(false);
            setDoForReturn(null);
            alert('Data retur/tolakan berhasil dicatat dan stok telah disesuaikan!');
        } catch (error: any) {
            alert('Gagal memproses retur: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteDOReturn = async (id: string) => {
        if (!window.confirm('Hapus riwayat retur ini?')) return;
        setIsLoading(true);
        try {
            await db.deleteDOReturn(id, currentUserName);
            await fetchInitialData(true);
            alert('Data retur berhasil dihapus.');
        } catch (error: any) {
            alert('Gagal menghapus: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const soDefaultPrices = useMemo(() => {
        const targetCustomer = orderToInvoice?.customer || invoiceToEdit?.customer;
        const targetDOId = orderToInvoice?.id || invoiceToEdit?.deliveryOrderId;
        const targetSOId = orderToInvoice?.salesOrderId;
        if (!targetCustomer) return {};

        const priceMap: Record<string, number> = {};

        // 1. Direct match with Sales Order by salesOrderId or deliveryOrderIds
        const directSO = salesOrders.find(so =>
            (targetSOId && so.id === targetSOId) ||
            (targetDOId && so.deliveryOrderIds && so.deliveryOrderIds.some(dId => targetDOId.includes(dId)))
        );

        if (directSO) {
            directSO.items.forEach(it => {
                if (it.price && it.price > 0) {
                    priceMap[it.name] = it.price;
                }
            });
        }

        // 2. Also check customer Sales Orders (most recent first) to fill missing item prices
        const customerSOs = salesOrders
            .filter(so => so.customer && targetCustomer && so.customer.trim().toLowerCase() === targetCustomer.trim().toLowerCase())
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        for (const so of customerSOs) {
            so.items.forEach(it => {
                if (!priceMap[it.name] && it.price && it.price > 0) {
                    priceMap[it.name] = it.price;
                }
            });
        }

        return priceMap;
    }, [orderToInvoice, invoiceToEdit, salesOrders]);

    const readyDOCount = useMemo(() => {
        return deliveryOrders.filter(o => (o.status === 'received' || o.status === 'revised') && !o.invoiceId).length;
    }, [deliveryOrders]);

    const subModuleMap = useMemo(() => ({
        production: {
            items: permittedProductionTabs,
            activeId: productionTab,
            onSelect: (subId: string) => {
                setActiveView('production');
                setProductionTab(subId);
            }
        },
        sales_orders: {
            items: permittedSalesOrderTabs,
            activeId: salesOrderTab,
            onSelect: (subId: string) => {
                setActiveView('sales_orders');
                setSalesOrderTab(subId);
            }
        },
        logistics: {
            items: permittedLogisticsTabs,
            activeId: logisticsTab,
            onSelect: (subId: string) => {
                setActiveView('logistics');
                setLogisticsTab(subId);
                setIsHistoryOpen(false);
                setIsTradingHistoryOpen(false);
                setIsDisposalHistoryOpen(false);
            }
        },
        finance: {
            items: permittedFinanceTabs.map(t => ({
                ...t,
                badge: t.id === 'invoices_list' && readyDOCount > 0 ? `${readyDOCount} SIAP` : undefined
            })),
            activeId: financeTab,
            onSelect: (subId: string) => {
                setActiveView('finance');
                setFinanceTab(subId);
            }
        },
        database: {
            items: permittedDatabaseTabs,
            activeId: databaseTab,
            onSelect: (subId: string) => {
                setActiveView('database');
                setDatabaseTab(subId);
            }
        }
    }), [
        permittedProductionTabs, productionTab,
        permittedSalesOrderTabs, salesOrderTab,
        permittedLogisticsTabs, logisticsTab,
        permittedFinanceTabs, financeTab, readyDOCount,
        permittedDatabaseTabs, databaseTab
    ]);

    const activeTabInfo = useMemo((): WorkspaceTab | null => {
        if (!activeView) return null;
        const moduleTitles: Record<string, string> = {
            reports: 'Dashboard',
            production: 'Produksi',
            sales_orders: 'Sales Order',
            logistics: 'Logistik',
            finance: 'Keuangan',
            database: 'Basis Data',
            dataLogger: 'Riwayat'
        };
        const moduleLabel = moduleTitles[activeView] || activeView;
        const subConfig = (subModuleMap as Record<string, { items: { id: string; label: string }[]; activeId: string }>)[activeView];
        if (subConfig && subConfig.items.length > 0) {
            const subItem = subConfig.items.find(i => i.id === subConfig.activeId) || subConfig.items[0];
            return {
                key: `${activeView}:${subItem.id}`,
                view: activeView,
                subId: subItem.id,
                label: subItem.label,
                moduleLabel
            };
        }
        return {
            key: activeView,
            view: activeView,
            label: moduleLabel,
            moduleLabel
        };
    }, [activeView, subModuleMap]);

    useEffect(() => {
        if (!activeTabInfo) return;
        setOpenTabs(prev => {
            if (prev.some(t => t.key === activeTabInfo.key)) return prev;
            return [...prev, activeTabInfo];
        });
    }, [activeTabInfo]);

    const handleSelectWorkspaceTab = useCallback((tab: WorkspaceTab) => {
        setActiveView(tab.view);
        if (tab.subId) {
            if (tab.view === 'production') setProductionTab(tab.subId);
            else if (tab.view === 'sales_orders') setSalesOrderTab(tab.subId);
            else if (tab.view === 'logistics') {
                setLogisticsTab(tab.subId);
                setIsHistoryOpen(false);
                setIsTradingHistoryOpen(false);
                setIsDisposalHistoryOpen(false);
            }
            else if (tab.view === 'finance') setFinanceTab(tab.subId);
            else if (tab.view === 'database') setDatabaseTab(tab.subId);
        }
    }, []);

    const handleCloseWorkspaceTab = useCallback((key: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenTabs(prev => {
            const idx = prev.findIndex(t => t.key === key);
            if (idx === -1) return prev;
            const nextTabs = prev.filter(t => t.key !== key);
            if (activeTabInfo?.key === key) {
                if (nextTabs.length === 0) {
                    setActiveView('');
                } else {
                    const fallback = nextTabs[Math.min(idx, nextTabs.length - 1)];
                    handleSelectWorkspaceTab(fallback);
                }
            }
            return nextTabs;
        });
    }, [activeTabInfo, handleSelectWorkspaceTab]);

    const handleReorderWorkspaceTabs = useCallback((fromIndex: number, toIndex: number) => {
        setOpenTabs(prev => {
            if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length || fromIndex === toIndex) {
                return prev;
            }
            const updated = [...prev];
            const [moved] = updated.splice(fromIndex, 1);
            updated.splice(toIndex, 0, moved);
            return updated;
        });
    }, []);

    if (!isAuthenticated) return <Login onLogin={handleLogin} />;

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden">
            {Object.entries(otherCursors).map(([user, pos]) => {
                if (pos.location !== currentLocationRef.current) return null;
                return (
                    <div
                        key={user}
                        className="pointer-events-none fixed z-[10000] drop-shadow-md transition-all duration-75 ease-linear transform-gpu"
                        style={{ left: pos.x, top: pos.y, transform: 'translate(-5px, -5px)' }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-emerald-500 fill-emerald-500 stroke-white drop-shadow-md" strokeWidth="2" strokeLinejoin="round">
                            <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 01.35-.15h6.42c.45 0 .67-.54.35-.85L5.5 3.21z" />
                        </svg>
                        <div className="absolute left-4 top-4 bg-emerald-500 text-white text-[10px] font-black tracking-widest px-2 py-0.5 rounded-full uppercase shadow-sm whitespace-nowrap">
                            {user}
                        </div>
                    </div>
                );
            })}
            {isLoading && (
                <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-md z-[9999] flex items-center justify-center">
                    <div className="w-12 h-12 border-[4px] border-indigo-600 border-t-transparent rounded-full animate-spin shadow-xl bg-white/20 p-2" />
                </div>
            )}
            <div className="print:hidden">
                <Header 
                    activeView={activeView} 
                    setActiveView={setActiveView} 
                    onLogout={handleLogout} 
                    onlineUsers={onlineUsers} 
                    realtimeStatus={realtimeStatus} 
                    userName={currentUserName}
                    userRole={currentUserPerms.isSuperAdmin ? 'Superadmin' : currentUserPerms.roleName}
                    userPermissions={currentUserPerms.permissions}
                    isSuperAdmin={currentUserPerms.isSuperAdmin}
                    subModuleMap={subModuleMap}
                    openTabs={openTabs}
                    activeTabKey={activeTabInfo?.key || ''}
                    onSelectTab={handleSelectWorkspaceTab}
                    onCloseTab={handleCloseWorkspaceTab}
                    onReorderTabs={handleReorderWorkspaceTabs}
                    isOffline={isOffline}
                    pendingSyncCount={pendingSyncCount}
                    onSyncOffline={handleSyncOffline}
                />
            </div>
            <main className={`flex-1 ${openTabs.length > 0 ? 'mt-24' : 'mt-14'} p-3 md:p-6 lg:p-8 max-w-[1440px] mx-auto w-full print:hidden transition-all duration-150`}>
                {dbError ? (
                    <div className="bg-rose-50 border border-rose-100 p-8 rounded-3xl text-rose-700 font-bold text-center">
                        <p>Koneksi Error: {dbError}</p>
                        <button onClick={() => fetchInitialData()} className="mt-4 px-6 py-2 bg-rose-600 text-white rounded-xl">Coba Lagi</button>
                    </div>
                ) : !activeView ? (
                    <div className="min-h-[70vh] flex items-center justify-center px-4">
                        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 md:p-10 shadow-2xs max-w-lg w-full text-center space-y-5">
                            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200/70 mx-auto flex items-center justify-center p-3">
                                <img src="/logo trial.png" alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="space-y-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>
                                        {new Date().toLocaleDateString('id-ID', {
                                            weekday: 'long',
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                                <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight pt-1">
                                    {(() => {
                                        const hr = new Date().getHours();
                                        const greeting = hr < 11 ? 'Selamat Pagi' : hr < 15 ? 'Selamat Siang' : hr < 18 ? 'Selamat Sore' : 'Selamat Malam';
                                        return `${greeting}, ${currentUserName || 'User'}`;
                                    })()}
                                </h1>
                                <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
                                    Selamat datang di Sistem Operasional <span className="font-semibold text-slate-700">PT Mitra Karya Foodindo (RPA)</span>. Silakan pilih modul pada menu navigasi di atas untuk mulai bekerja.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : !currentUserPerms.isSuperAdmin && (activeView === 'dataLogger' || currentUserPerms.permissions[activeView as AppModuleId] === 'none') ? (
                    <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 text-center space-y-4 max-w-lg mx-auto my-12 shadow-sm">
                        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl mx-auto flex items-center justify-center text-2xl border border-rose-100">
                            🔒
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Akses Modul Dibatasi</h3>
                        <p className="text-xs text-slate-500 font-medium">
                            Akun Anda tidak memiliki izin untuk mengakses modul <strong>{activeView.toUpperCase()}</strong>. Hubungi Super Administrator untuk memperbarui hak akses akun Anda.
                        </p>
                    </div>
                ) : (
                    <>
                        {activeView === 'production' && (
                            <div className="space-y-4">
                                {productionTab === 'input' ? (
                                    <div className="space-y-6">
                                        {canViewSubModule(currentUserPerms.permissions, 'production', 'input', currentUserPerms.isSuperAdmin) && (
                                            <ProductionForm onSubmit={async (n: number, c: string, d: string, l: string, e: number, k: number, m: number, mk: number, it: Record<string, number>, pr: number, auto: boolean, date: string) => {
                                                setIsLoading(true);
                                                try {
                                                    await db.addProductionLogs(Object.entries(it).filter(([_, q]) => Number(q) > 0).map(([i, q]) => ({ tanggal_produksi: date, item_name: i, qty: Number(q), ekor: e, kg: k, mobil: n.toString(), plat: l, harga_beli_kg: pr, kematian_ekor: m, kematian_kg: mk, nama_kandang: c, driver: d })), auto, currentUserName);
                                                    await fetchInitialData(true);
                                                } finally {
                                                    setIsLoading(false);
                                                }
                                            }} coops={coops} licensePlates={licensePlates} masterItems={masterItems} existingLogs={productionLogs} />
                                        )}
                                        {pendingLogs.length > 0 && canViewSubModule(currentUserPerms.permissions, 'production', 'queue', currentUserPerms.isSuperAdmin) && (
                                            <div className="bg-slate-900/5 p-4 rounded-[2.5rem] border border-slate-200">
                                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 px-2">Antrian Produksi</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {pendingLogs.map((log: any, idx: number) => (
                                                        <div key={idx} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                                                            <div className="flex justify-between mb-3"><span className="text-[8px] font-black text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded-full">Mobil #{log.truckNumber}</span><span className="text-[8px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-full uppercase">Pending</span></div>
                                                            <h4 className="font-black text-slate-800 text-base">{log.coopName}</h4>
                                                            <p className="text-[9px] text-slate-400 font-bold mb-3 uppercase">{new Date(log.date).toLocaleDateString('id-ID')}</p>
                                                            <div className="flex gap-2">
                                                                {canEditSubModule(currentUserPerms.permissions, 'production', 'queue', currentUserPerms.isSuperAdmin) && (
                                                                    <button onClick={() => handleApplyPending(log)} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase">Apply</button>
                                                                )}
                                                                {currentUserPerms.isSuperAdmin && <button onClick={() => handleDeleteProduction(new Date(log.date).toISOString().slice(0, 10), log.truckNumber.toString())} className="p-3 bg-rose-50 text-rose-600 rounded-xl"><TrashIcon /></button>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border border-slate-200">
                                        <ProductionReport
                                            productionHistory={productionLogs}
                                            userRole={currentUserPerms.isSuperAdmin ? 'superadmin' : userRole}
                                            onDeleteRecord={canEditSubModule(currentUserPerms.permissions, 'production', 'history', currentUserPerms.isSuperAdmin) ? handleDeleteProduction : undefined}
                                            onEditRecord={(rec: any) => setProductionToEdit(rec)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        {activeView === 'sales_orders' && (
                            <div className="space-y-4">
                                {salesOrderTab === 'list' ? (
                                    <SalesOrderView
                                        salesOrders={salesOrders}
                                        customers={customers}
                                        masterItems={masterItems}
                                        currentStock={stock}
                                        lockedSOs={lockedSOs}
                                        onAddOrder={() => {
                                            setSalesOrderToEdit(null);
                                            setIsSalesOrderOpen(true);
                                        }}
                                        onCreateOrder={() => {
                                            setSalesOrderToEdit(null);
                                            setIsSalesOrderOpen(true);
                                        }}
                                        onEditOrder={(order) => {
                                            setSalesOrderToEdit(order);
                                            setIsSalesOrderOpen(true);
                                        }}
                                        onDeleteOrder={handleDeleteSalesOrder}
                                        onSelectOrder={(order) => setSelectedSO(order)}
                                        onViewDetail={(order) => setSelectedSO(order)}
                                        onCreateDO={(order) => {
                                            if (lockedSOs[order.id]) {
                                                alert(`Sales Order ${order.id} sedang dibuatkan Surat Jalan oleh ${lockedSOs[order.id]}.`);
                                                return;
                                            }
                                            setSoForDO(order);
                                            setActiveCreatingSOId(order.id);
                                            setIsCreateDOModalOpen(true);
                                        }}
                                        userRole={currentUserPerms.isSuperAdmin ? 'superadmin' : userRole}
                                    />
                                ) : (
                                    <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border border-slate-200">
                                        <SalesReportHistory
                                            deliveryOrders={deliveryOrders}
                                            invoices={invoices}
                                            onSelectSJ={(order: DeliveryOrder) => setSelectedSJ(order)}
                                            onSelectInvoice={(inv: Invoice) => setSelectedInv(inv)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        {activeView === 'logistics' && (
                            <div className="space-y-4">
                                {logisticsTab === 'delivery_orders' && canEditSubModule(currentUserPerms.permissions, 'logistics', 'manual_sj', currentUserPerms.isSuperAdmin) && (
                                    <div className="flex justify-end">
                                        <button onClick={() => setIsManualSJOpen(true)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                                            + SJ MANUAL (Quick Print)
                                        </button>
                                    </div>
                                )}
                                {logisticsTab === 'stock' ? (
                                    isHistoryOpen ? (
                                        <StockHistoryView logs={stockLogs} onBack={() => setIsHistoryOpen(false)} />
                                    ) : isTradingHistoryOpen ? (
                                        <TradingHistoryView
                                            logs={tradingPurchases}
                                            onBack={() => setIsTradingHistoryOpen(false)}
                                            userRole={userRole}
                                            onEdit={(log: any) => { setTradingPurchaseToEdit(log); setIsTradingPurchaseOpen(true); }}
                                            onDelete={async (id: string, date: string) => {
                                                if (window.confirm(`Hapus pembelian trading tanggal ${new Date(date).toLocaleDateString('id-ID')}?`)) {
                                                    try {
                                                        await db.deleteTradingPurchase(id, currentUserName);
                                                        await fetchInitialData(true);
                                                        alert("Dihapus.");
                                                    } catch (e: any) { alert(e.message); }
                                                }
                                            }}
                                        />
                                    ) : isDisposalHistoryOpen ? (
                                        <DisposalHistoryView
                                            logs={stockDisposals}
                                            onBack={() => setIsDisposalHistoryOpen(false)}
                                            userRole={userRole}
                                            onEdit={(log: any) => { setDisposalToEdit(log); setIsDisposalOpen(true); }}
                                            onDelete={async (id: string, date: string) => {
                                                if (window.confirm(`Hapus pemusnahan tanggal ${new Date(date).toLocaleDateString('id-ID')}?`)) {
                                                    try {
                                                        await db.deleteStockDisposal(id, currentUserName);
                                                        await fetchInitialData(true);
                                                        alert("Dihapus.");
                                                    } catch (e: any) { alert(e.message); }
                                                }
                                            }}
                                        />
                                    ) : (
                                        <StockView
                                            stock={stock}
                                            stockLogs={stockLogs}
                                            onStartAllocation={() => setIsAllocating(true)}
                                            onStartOpname={() => setIsOpnameOpen(true)}
                                            onViewHistory={() => setIsHistoryOpen(true)}
                                            onViewTradingHistory={() => setIsTradingHistoryOpen(true)}
                                            onViewDisposalHistory={() => setIsDisposalHistoryOpen(true)}
                                            onStartTradingPurchase={() => setIsTradingPurchaseOpen(true)}
                                            onStartDisposal={() => setIsDisposalOpen(true)}
                                            canAllocate={canEditSubModule(currentUserPerms.permissions, 'logistics', 'stock_allocation', currentUserPerms.isSuperAdmin)}
                                            canOpname={canEditSubModule(currentUserPerms.permissions, 'logistics', 'stock_opname', currentUserPerms.isSuperAdmin)}
                                            canTrade={canEditSubModule(currentUserPerms.permissions, 'logistics', 'trading', currentUserPerms.isSuperAdmin)}
                                            canDisposal={canEditSubModule(currentUserPerms.permissions, 'logistics', 'disposal', currentUserPerms.isSuperAdmin)}
                                            canViewHistory={canViewSubModule(currentUserPerms.permissions, 'logistics', 'stock_history', currentUserPerms.isSuperAdmin)}
                                        />
                                    )
                                ) : logisticsTab === 'delivery_orders' ? (
                                    <DeliveryOrderList 
                                        deliveryOrders={deliveryOrders} 
                                        onSelectOrder={(order: DeliveryOrder) => {
                                            setSelectedSJ(order);
                                            setIsReceivingMode(false);
                                        }} 
                                        customers={customers} 
                                        onDeleteSJ={canEditSubModule(currentUserPerms.permissions, 'logistics', 'delivery_orders', currentUserPerms.isSuperAdmin) ? handleDeleteSJ : undefined} 
                                        userRole={userRole}
                                        onCreateFromSO={canEditSubModule(currentUserPerms.permissions, 'logistics', 'create_do_so', currentUserPerms.isSuperAdmin) ? () => {
                                            setSoForDO(null);
                                            setIsCreateDOModalOpen(true);
                                        } : undefined}
                                        onInputReturn={canEditSubModule(currentUserPerms.permissions, 'logistics', 'returns', currentUserPerms.isSuperAdmin) ? (order: DeliveryOrder) => {
                                            setDoForReturn(order);
                                            setIsDOReturnModalOpen(true);
                                        } : undefined}
                                        onStartReceiving={canEditSubModule(currentUserPerms.permissions, 'logistics', 'do_receiving', currentUserPerms.isSuperAdmin) ? (order: DeliveryOrder) => {
                                            setSelectedSJ(order);
                                            setIsReceivingMode(true);
                                        } : undefined}
                                    />
                                ) : logisticsTab === 'returns' ? (
                                    <DOReturnsListView 
                                        returns={doReturns}
                                        onDeleteReturn={canEditSubModule(currentUserPerms.permissions, 'logistics', 'returns', currentUserPerms.isSuperAdmin) ? handleDeleteDOReturn : undefined}
                                        onNewReturn={canEditSubModule(currentUserPerms.permissions, 'logistics', 'returns', currentUserPerms.isSuperAdmin) ? () => {
                                            if (deliveryOrders.length > 0) {
                                                setDoForReturn(deliveryOrders[0]);
                                                setIsDOReturnModalOpen(true);
                                            } else {
                                                alert('Belum ada Surat Jalan (DO) untuk diretur.');
                                            }
                                        } : undefined}
                                        userRole={userRole}
                                    />
                                ) : (
                                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200">
                                        <DailyRecapReport productionHistory={productionLogs} deliveryOrders={deliveryOrders} tradingPurchases={tradingPurchases} stockDisposals={stockDisposals} masterItems={masterItems} stockLogs={stockLogs} />
                                    </div>
                                )}
                            </div>
                        )}
                        {activeView === 'finance' && (
                            <div className="space-y-4">
                                {financeTab === 'ledger' && <LedgerView
                                    ledgerEntries={ledgerEntries}
                                    invoices={invoices}
                                    deliveryOrders={deliveryOrders}
                                    customers={customers}
                                    customerDebts={customerDebts}
                                    userRole={currentUserPerms.isSuperAdmin || canEditSubModule(currentUserPerms.permissions, 'finance', 'ledger', currentUserPerms.isSuperAdmin) ? 'superadmin' : userRole}
                                    onRefresh={async () => { await fetchInitialData(true); }}
                                    onAddPayment={async (d) => { await db.addLedgerEntry({ customer_id: d.customerId, tanggal: d.date.toISOString().slice(0, 10), keterangan: d.description, debit: 0, credit: d.credit, metode_bayar: d.paymentMethod, bukti_bayar: d.paymentProof }, currentUserName); await sleep(1500); await fetchInitialData(true); }}
                                    onAddManualPurchase={async (d) => { await db.addLedgerEntry({ customer_id: d.customerId, tanggal: d.date.toISOString().slice(0, 10), keterangan: d.description, debit: d.debit, credit: 0, bukti_bayar: d.paymentProof }, currentUserName); await sleep(1500); await fetchInitialData(true); }}
                                    onDeleteLedgerEntry={async (id) => { if (window.confirm('Hapus transaksi ini?')) { await db.deleteLedgerEntry(id, currentUserName); await sleep(1500); await fetchInitialData(true); } }}
                                    onEditLedgerEntry={async (id, d) => { if (window.confirm('Update transaksi ini?')) { await db.deleteLedgerEntry(id, currentUserName); await db.addLedgerEntry({ customer_id: d.customerId, tanggal: d.date.toISOString().slice(0, 10), keterangan: d.description, debit: d.debit, credit: d.credit, metode_bayar: d.paymentMethod, bukti_bayar: d.paymentProof }, currentUserName); await sleep(1500); await fetchInitialData(true); } }}
                                    onEditInvoice={(inv) => setInvoiceToEdit(inv)}
                                    onDeleteInvoice={async (id) => { if (window.confirm('Hapus invoice ini?')) { await db.deleteInvoice(id, currentUserName); await sleep(1500); await fetchInitialData(true); } }}
                                    onSelectSJ={(sj) => setSelectedSJ(sj)}
                                />}
                                {financeTab === 'chicken_prices' && <CoopPriceForm productionHistory={[...productionLogs, ...pendingLogs]} onUpdatePrices={async (updates: any) => { try { await db.updateProductionPrices(updates, currentUserName); await fetchInitialData(true); alert('Harga Beli Terupdate'); } catch (e: any) { alert(e.message); } }} onCancel={() => { }} />}
                                {financeTab === 'invoices_list' && (
                                    <InvoiceList 
                                        invoices={invoices} 
                                        deliveryOrders={deliveryOrders}
                                        salesOrders={salesOrders}
                                        customerDebts={customerDebts} 
                                        lockedDOs={lockedDOs}
                                        onSelectInvoice={(inv: Invoice) => setSelectedInv(inv)} 
                                        onStartInvoicing={handleSelectInvoicing}
                                        onCombineInvoicing={handleCombineInvoicing}
                                        onCloseSalesOrder={handleCloseSalesOrder}
                                    />
                                )}
                                {financeTab === 'expenses' && <ExpenseView expenses={expenses} onAddExpense={() => setIsAddingExpense(true)} onDeleteExpense={async (id: string) => { if (window.confirm('Hapus record ini?')) { await db.deleteExpense(id, currentUserName); await fetchInitialData(true); } }} />}
                                {financeTab === 'salaries' && <SalaryView salaries={salaries} onAddSalary={() => setIsAddingSalary(true)} onDeleteSalary={async (id: string) => { if (window.confirm('Hapus data gaji ini?')) { await db.deleteSalary(id, currentUserName); await fetchInitialData(true); } }} onImportSalaries={(data: any) => { setSalaryImportData(data); setIsAddingSalary(true); }} />}
                                {financeTab === 'stock_value' && <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200"><StockValueReport stockLogs={stockLogs} invoices={invoices} masterItems={masterItems} stock={stock} productionHistory={productionLogs} deliveryOrders={deliveryOrders} onInputEarlyStock={async (date: string, value: number) => { try { await db.upsertEarlyStock(date, value, currentUserName); await fetchInitialData(true); alert('Saldo Awal berhasil disimpan.'); } catch (e: any) { alert(e.message); } }} /></div>}
                                {financeTab === 'profit_loss' && <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200"><ProfitLossView invoices={invoices} productionHistory={[...productionLogs, ...pendingLogs]} expenses={expenses} salaries={salaries} stockLogs={stockLogs} tradingPurchases={tradingPurchases} stockDisposals={stockDisposals} stock={stock} ledgerEntries={ledgerEntries} earlyStock={earlyStock} masterItems={masterItems} /></div>}
                                {financeTab === 'belanja_lb' && <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200"><BelanjaLBReport productionHistory={[...productionLogs, ...pendingLogs]} /></div>}
                                {financeTab === 'hpp' && <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200"><HPPView productionHistory={productionLogs} expenses={expenses} invoices={invoices} masterItems={masterItems} /></div>}
                            </div>
                        )}
                        {activeView === 'reports' && (
                            <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border border-slate-200">
                                <DashboardReport
                                    productionHistory={[...productionLogs, ...pendingLogs]}
                                    deliveryOrders={deliveryOrders}
                                    invoices={invoices}
                                    expenses={expenses}
                                    salaries={salaries}
                                    stockLogs={stockLogs}
                                    stock={stock}
                                    ledgerEntries={ledgerEntries}
                                    tradingPurchases={tradingPurchases}
                                    stockDisposals={stockDisposals}
                                    earlyStock={earlyStock}
                                    onSelectPNL={() => { setActiveView('finance'); setFinanceTab('profit_loss'); }}
                                />
                            </div>
                        )}
                        {/* FIX DATABASE MANAGEMENT SECTION */}
                        {activeView === 'database' && (
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200">
                                <DatabaseManagement
                                    coops={coops}
                                    licensePlates={licensePlates}
                                    customers={customers}
                                    masterItems={masterItems}
                                    customerDebts={customerDebts}
                                    onAdd={async (type: string, data: any) => {
                                        await db.addMasterData(type, data, currentUserName);
                                        await fetchInitialData(true);
                                    }}
                                    onDelete={async (type: string, identifier: string) => {
                                        // Panggil fungsi hapus di database
                                        if (db.deleteMasterData) {
                                            await db.deleteMasterData(type, identifier, currentUserName);
                                        } else {
                                            // Jika fungsi belum ada, buat alert
                                            alert('Fungsi hapus sedang disiapkan.');
                                        }
                                        await fetchInitialData(true);
                                    }}
                                    onUpdateCustomer={async (oldName: string, newName: string, newAddress: string) => {
                                        await db.updateCustomerName(oldName, newName, newAddress, currentUserName);
                                        await fetchInitialData(true);
                                        alert('Data customer dan transaksi terkait berhasil diperbarui.');
                                    }}
                                    currentUserName={currentUserName}
                                    userRole={currentUserPerms.isSuperAdmin ? 'superadmin' : userRole}
                                    userPermissions={currentUserPerms.permissions}
                                    isSuperAdmin={currentUserPerms.isSuperAdmin}
                                    activeSubView={databaseTab as any}
                                    onChangeSubView={(v) => setDatabaseTab(v)}
                                />
                            </div>
                        )}
                        {activeView === 'dataLogger' && currentUserPerms.isSuperAdmin && (
                            <ActivityHistoryView />
                        )}
                    </>
                )}
            </main>
            {isAllocating && <AllocationForm stock={stock} customers={customers} masterItems={masterItems} onSubmit={handleAllocationSubmit} onCancel={() => setIsAllocating(false)} />}
            {isTradingPurchaseOpen && <TradingPurchaseForm initialData={tradingPurchaseToEdit || undefined} stock={stock} masterItems={masterItems} onSubmit={async (d: any) => { try { setIsLoading(true); if (tradingPurchaseToEdit) { await db.editTradingPurchase(tradingPurchaseToEdit.id, { tanggal: d.date.toISOString().slice(0, 10), item_name: d.itemName, kg: d.quantity, harga_per_kg: d.pricePerKg }, currentUserName); setTradingPurchaseToEdit(null); } else { await db.addTradingPurchase({ tanggal: d.date.toISOString().slice(0, 10), item_name: d.itemName, kg: d.quantity, harga_per_kg: d.pricePerKg }, currentUserName); } setIsTradingPurchaseOpen(false); await fetchInitialData(true); } catch (e: any) { alert(e.message); } finally { setIsLoading(false); } }} onCancel={() => { setIsTradingPurchaseOpen(false); setTradingPurchaseToEdit(null); }} />}
            {isDisposalOpen && <StockDisposalForm initialData={disposalToEdit || undefined} stock={stock} masterItems={masterItems} onSubmit={async (d: any) => { try { setIsLoading(true); if (disposalToEdit) { await db.editStockDisposal(disposalToEdit.id, { tanggal: d.date.toISOString().slice(0, 10), item_name: d.itemName, kg: d.quantity, harga_valuasi_kg: d.pricePerKg, keterangan: d.notes }, currentUserName); setDisposalToEdit(null); } else { await db.addStockDisposal({ tanggal: d.date.toISOString().slice(0, 10), item_name: d.itemName, kg: d.quantity, harga_valuasi_kg: d.pricePerKg, keterangan: d.notes }, currentUserName); } setIsDisposalOpen(false); await fetchInitialData(true); } catch (e: any) { alert(e.message); } finally { setIsLoading(false); } }} onCancel={() => { setIsDisposalOpen(false); setDisposalToEdit(null); }} />}
            {isOpnameOpen && <StockOpnameForm
                stockLogs={stockLogs}
                currentStock={stock}
                masterItems={masterItems}
                onSubmit={async (data: Record<string, number>, date: string) => {
                    setIsLoading(true);
                    try {
                        const todayStr = new Date().toLocaleDateString('en-CA');
                        const isToday = date === todayStr;

                        console.log(`[Opname] Memulai opname untuk tanggal: ${date} (Hari ini: ${isToday})`);
                        const entries = Object.entries(data);
                        let updatedCount = 0;
                        let errorCount = 0;
                        let skipCount = 0;
                        let errors: string[] = [];

                        for (const [itemName, realQtyVal] of entries) {
                            try {
                                const realQty = parseFloat(String(realQtyVal));
                                if (isNaN(realQty)) {
                                    skipCount++;
                                    continue;
                                }

                                const wasUpdated = await db.syncStockOpname(itemName, realQty, date, isToday, currentUserName);
                                if (wasUpdated) {
                                    updatedCount++;
                                } else {
                                    skipCount++;
                                }
                            } catch (itemErr: any) {
                                console.error(`[Opname] Gagal pada item ${itemName}:`, itemErr);
                                errorCount++;
                                errors.push(`${itemName}: ${itemErr.message}`);
                            }
                        }

                        console.log(`[Opname] Selesai. Sukses: ${updatedCount}, Lewat: ${skipCount}, Gagal: ${errorCount}`);

                        await fetchInitialData(true);
                        setIsOpnameOpen(false);

                        let message = `Proses Selesai.\n- Berhasil disesuaikan: ${updatedCount} item`;
                        if (skipCount > 0) message += `\n- Dilewati (stok sudah sesuai): ${skipCount} item`;
                        if (errorCount > 0) message += `\n- GAGAL: ${errorCount} item.`;

                        if (errors.length > 0) {
                            console.table(errors);
                            alert(message + '\n\nDetail error tersimpan di log konsol.');
                        } else {
                            alert(message);
                        }
                    } catch (e: any) {
                        console.error('[Opname] Fatal Error:', e);
                        alert('Gagal total menjalankan opname: ' + e.message);
                    } finally {
                        setIsLoading(false);
                    }
                }}
                onCancel={() => setIsOpnameOpen(false)}
            />}
            {isAddingExpense && <ExpenseForm onSubmit={async (d: any) => {
                if (Array.isArray(d)) {
                    await db.addExpenses(d, currentUserName);
                } else {
                    await db.addExpense(d, currentUserName);
                }
                setIsAddingExpense(false);
                await fetchInitialData(true);
            }} onCancel={() => setIsAddingExpense(false)} />}
            {isAddingSalary && <SalaryForm initialData={salaryImportData || undefined} onSubmit={async (d: any) => { await db.addSalaries(d, currentUserName); setIsAddingSalary(false); setSalaryImportData(null); await fetchInitialData(true); }} onCancel={() => { setIsAddingSalary(false); setSalaryImportData(null); }} />}
            {isManualSJOpen && <ManualSJForm customers={customers} masterItems={masterItems} onCancel={() => setIsManualSJOpen(false)} />}
            {isManualInvoiceOpen && <ManualInvoiceForm customers={customers} masterItems={masterItems} onCancel={() => setIsManualInvoiceOpen(false)} />}
            {isEndingInventoryOpen && <EndingInventoryForm
                earlyStock={earlyStock}
                currentUserName={currentUserName}
                onSubmit={async (date: string, amount: number) => {
                    await db.upsertEarlyStock(date, amount, currentUserName);
                    await fetchInitialData(true);
                    alert('Data Ending Inventory berhasil diperbarui.');
                }}
                onDelete={async (date: string) => {
                    await db.deleteEarlyStock(date, currentUserName);
                    await fetchInitialData(true);
                }}
                onCancel={() => setIsEndingInventoryOpen(false)}
            />}

            {selectedSJ && <DeliveryOrderDetail 
                order={selectedSJ} 
                masterItems={masterItems} 
                initialReceivingMode={isReceivingMode}
                onClose={() => {
                    setSelectedSJ(null);
                    setIsReceivingMode(false);
                }} 
                onUpdateOrder={async (o: DeliveryOrder) => {
                try {
                    const { data: previousData } = await supabase.from('delivery_orders').select('nama_item, retur, qty_kirim').eq('nomor_sj', o.id);
                    const adjustQty = (_name: string, q: number) => q;
                    if (previousData) {
                        await Promise.all(previousData.map((prev: any) => {
                            const kgRetur = adjustQty(prev.nama_item, Number(prev.retur || 0));
                            if (kgRetur > 0) { return db.adjustStock(prev.nama_item, -kgRetur, 'Alokasi', `Koreksi Retur SJ ${o.id}`, currentUserName); }
                            return Promise.resolve();
                        }));
                    }

                    const dbEntries = o.items.map((it: AllocationItem) => {
                        const qtyKirim = it.quantity;
                        const qtyDiterima = o.receivedItems?.find((ri: AllocationItem) => ri.name === it.name)?.quantity || 0;
                        const retur = o.rejectedItems?.find((ri: AllocationItem) => ri.name === it.name)?.quantity || 0;
                        const susut = Math.max(0, qtyKirim - retur - qtyDiterima);
                        return {
                            tanggal: o.date.toISOString().slice(0, 10),
                            nomor_sj: o.id,
                            customer: o.customer,
                            nama_item: it.name,
                            qty_kirim: qtyKirim,
                            qty_kirim2: adjustQty(it.name, qtyKirim),
                            qty_diterima: qtyDiterima,
                            qty_diterima2: adjustQty(it.name, qtyDiterima),
                            retur: retur,
                            susut_selisih: susut,
                            timestamp: new Date().toISOString()
                        };
                    });

                    if (previousData) {
                        // Handle deltas for each item
                        // 1. Shipped quantity changes (Kirim) -> Stock decreases when Kirim increases
                        // 2. Returned quantity changes (Retur) -> Stock increases when Retur increases

                        // Track items we've already processed to find deleted items later
                        const processedItems = new Set<string>();

                        for (const it of o.items) {
                            processedItems.add(it.name);
                            const prevItem = previousData.find((prev: any) => prev.nama_item === it.name);

                            const qtyKirim = it.quantity;
                            const prevQtyKirim = prevItem ? Number(prevItem.qty_kirim) : 0;

                            // Shipped adjustment
                            if (qtyKirim !== prevQtyKirim) {
                                const diffKirim = qtyKirim - prevQtyKirim;
                                const kgDiffKirim = adjustQty(it.name, diffKirim);
                                if (kgDiffKirim !== 0) {
                                    await db.adjustStock(
                                        it.name,
                                        -kgDiffKirim,
                                        'Alokasi',
                                        `Update kuantitas Kirim SJ ${o.id}: dari ${prevQtyKirim} menjadi ${qtyKirim}`,
                                        currentUserName
                                    );
                                }
                            }

                            // Returned adjustment
                            const newRetur = o.rejectedItems?.find((ri: AllocationItem) => ri.name === it.name)?.quantity || 0;
                            const prevRetur = prevItem ? Number(prevItem.retur) : 0;

                            if (newRetur !== prevRetur) {
                                const diffRetur = newRetur - prevRetur;
                                const kgDiffRetur = adjustQty(it.name, diffRetur);
                                if (kgDiffRetur !== 0) {
                                    await db.adjustStock(
                                        it.name,
                                        kgDiffRetur,
                                        'Alokasi',
                                        `Update kuantitas Retur SJ ${o.id}: dari ${prevRetur} menjadi ${newRetur}`,
                                        currentUserName
                                    );
                                }
                            }
                        }

                        // 3. Handle entirely removed items
                        for (const prev of previousData) {
                            if (!processedItems.has(prev.nama_item)) {
                                // Original Kirim added back, Original Retur removed (if it was added before)
                                // Net back to stock = Kirim - Retur
                                const netPrevQty = Number(prev.qty_kirim) - Number(prev.retur);
                                const kgNet = adjustQty(prev.nama_item, netPrevQty);
                                if (kgNet > 0) {
                                    await db.adjustStock(
                                        prev.nama_item,
                                        kgNet,
                                        'Alokasi',
                                        `Hapus item SJ ${o.id} (Kembali ke stok)`,
                                        currentUserName
                                    );
                                }
                            }
                        }
                    } else {
                        // If no previous data (new SJ being confirmed/received for the first time)
                        // Note: Standard SJ creation usually happens in AllocationForm which already subtracts stock.
                        // This block handles the case where SJ is created/received in one go or from Manual SJ.
                        // Actually, if status is 'pending', stock was already subtracted.
                        // If we are confirming for the first time, we only need to add retur.

                        if (o.rejectedItems) {
                            await Promise.all(o.rejectedItems.map((item: AllocationItem) => {
                                const kgRetur = adjustQty(item.name, Number(item.quantity));
                                if (kgRetur > 0) { return db.adjustStock(item.name, kgRetur, 'Alokasi', `Retur dari SJ ${o.id}`, currentUserName); }
                                return Promise.resolve();
                            }));
                        }
                    }
                    await supabase.from('delivery_orders').delete().eq('nomor_sj', o.id);
                    await supabase.from('delivery_orders').insert(dbEntries);
                    await fetchInitialData(true);
                    setSelectedSJ(null);
                    setIsReceivingMode(false);
                    alert(`Penerimaan Surat Jalan ${o.id} berhasil disimpan! Data siap ditagihkan di modul Keuangan (DO Siap Di-Invoice).`);
                } catch (e: any) {
                    alert('Gagal: ' + e.message);
                }
            }} onInputReturn={(o) => { setSelectedSJ(null); setDoForReturn(o); setIsDOReturnModalOpen(true); }} />}
            {(orderToInvoice && !invoiceToEdit) && (
                <InvoiceForm
                    order={orderToInvoice}
                    defaultPrices={soDefaultPrices}
                    previousDebt={customerDebts[orderToInvoice.customer] || 0}
                    liveDebt={customerDebts[orderToInvoice.customer] || 0}
                    deliveryOrders={deliveryOrders}
                    salesOrders={salesOrders}
                    customers={customers}
                    lockedDOs={lockedDOs}
                    onSubmit={handleInvoiceSubmit}
                    onCancel={() => setOrderToInvoice(null)}
                />
            )}
            {selectedInv && (
                <InvoiceDetail
                    invoice={selectedInv}
                    liveDebt={customerDebts[selectedInv.customer] || 0}
                    salesOrderId={(() => {
                        const invSJs = (selectedInv.deliveryOrderId || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                        const matchedDO = deliveryOrders.find(d => invSJs.includes(d.id.trim().toLowerCase()) && d.salesOrderId);
                        if (matchedDO?.salesOrderId) return matchedDO.salesOrderId;
                        const matchedSO = salesOrders.find(so => (so.deliveryOrderIds || []).some(id => invSJs.includes(id.trim().toLowerCase())));
                        return matchedSO?.id;
                    })()}
                    onClose={() => setSelectedInv(null)}
                    onEdit={(inv: Invoice) => { setInvoiceToEdit(inv); setSelectedInv(null); }}
                />
            )}
            {invoiceToEdit && (
                <InvoiceForm
                    initialData={invoiceToEdit}
                    order={orderToInvoice || undefined}
                    defaultPrices={soDefaultPrices}
                    previousDebt={invoiceToEdit.previousDebt}
                    liveDebt={Math.max(0, (customerDebts[invoiceToEdit.customer] || 0) - (invoiceToEdit.subtotal - invoiceToEdit.amountPaid))}
                    deliveryOrders={deliveryOrders}
                    salesOrders={salesOrders}
                    customers={customers}
                    lockedDOs={lockedDOs}
                    onSubmit={handleInvoiceSubmit}
                    onCancel={() => { setInvoiceToEdit(null); setOrderToInvoice(null); }}
                />
            )}
            {productionToEdit && <ProductionEditModal record={productionToEdit} coops={coops} licensePlates={licensePlates} masterItems={masterItems} onSubmit={async (updates: any, isApplied: boolean) => { try { const dateStr = new Date(productionToEdit.date).toISOString().slice(0, 10); await db.deleteProductionBatch(dateStr, productionToEdit.truckNumber.toString(), currentUserName); await db.addProductionLogs(updates, isApplied, currentUserName); setProductionToEdit(null); await fetchInitialData(true); alert('Data produksi terupdate.'); } catch (e: any) { alert('Gagal: ' + e.message); } }} onCancel={() => setProductionToEdit(null)} />}

            {/* Sales Order Form Modal */}
            {isSalesOrderOpen && (
                <SalesOrderForm
                    initialData={salesOrderToEdit || undefined}
                    customers={customers}
                    masterItems={masterItems}
                    currentStock={stock}
                    onSubmit={handleSaveSalesOrder}
                    onCancel={() => {
                        setIsSalesOrderOpen(false);
                        setSalesOrderToEdit(null);
                    }}
                />
            )}

            {/* Sales Order Detail Modal */}
            {selectedSO && (
                <SalesOrderDetailModal
                    order={selectedSO}
                    lockedSOs={lockedSOs}
                    onClose={() => setSelectedSO(null)}
                    onCreateDO={(order) => {
                        if (lockedSOs[order.id]) {
                            alert(`Sales Order ${order.id} sedang dibuatkan Surat Jalan oleh ${lockedSOs[order.id]}.`);
                            return;
                        }
                        setSelectedSO(null);
                        setSoForDO(order);
                        setActiveCreatingSOId(order.id);
                        setIsCreateDOModalOpen(true);
                    }}
                />
            )}

            {/* Create DO from SO Modal */}
            {isCreateDOModalOpen && (
                <CreateDOFromSOModal
                    initialSalesOrder={soForDO}
                    salesOrders={salesOrders}
                    existingDOs={deliveryOrders}
                    currentStock={stock}
                    customers={customers}
                    masterItems={masterItems}
                    lockedSOs={lockedSOs}
                    onSelectSOChange={setActiveCreatingSOId}
                    onSubmit={handleCreateDOFromSO}
                    onCancel={() => {
                        setIsCreateDOModalOpen(false);
                        setSoForDO(null);
                        setActiveCreatingSOId('');
                    }}
                    onNavigateToSO={() => {
                        setActiveView('sales_orders');
                    }}
                />
            )}

            {/* DO Return Modal */}
            {isDOReturnModalOpen && doForReturn && (
                <DOReturnModal
                    deliveryOrder={doForReturn}
                    onSubmit={handleSaveDOReturns}
                    onCancel={() => {
                        setIsDOReturnModalOpen(false);
                        setDoForReturn(null);
                    }}
                />
            )}
        </div>
    );
};

export default App;