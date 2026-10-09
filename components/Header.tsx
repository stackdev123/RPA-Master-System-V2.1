import React, { useState, useRef, useEffect } from 'react';
import { 
  BoxIcon, TruckIcon, DatabaseIcon, DocumentTextIcon, 
  ChartBarIcon, BanknotesIcon, LogoutIcon, MenuIcon, XIcon,
  ShoppingCartIcon
} from './icons';
import type { AppModuleId, UserPermissions } from '../types';

interface OnlineUser {
    user: string;
    location: string;
}

export interface SubModuleNavItem {
    id: string;
    label: string;
    badge?: string | number;
}

export interface ModuleSubNavConfig {
    items: SubModuleNavItem[];
    activeId: string;
    onSelect: (subId: string) => void;
}

export interface WorkspaceTab {
    key: string;
    view: string;
    subId?: string;
    label: string;
    moduleLabel: string;
}

interface HeaderProps {
    activeView: string;
    setActiveView: (view: string) => void;
    onLogout: () => void;
    onlineUsers?: OnlineUser[];
    realtimeStatus?: 'connecting' | 'connected' | 'error';
    userName?: string;
    userRole?: string;
    userPermissions?: UserPermissions;
    isSuperAdmin?: boolean;
    subModuleMap?: Record<string, ModuleSubNavConfig>;
    openTabs?: WorkspaceTab[];
    activeTabKey?: string;
    onSelectTab?: (tab: WorkspaceTab) => void;
    onCloseTab?: (key: string, e: React.MouseEvent) => void;
    onReorderTabs?: (fromIndex: number, toIndex: number) => void;
    isOffline?: boolean;
    pendingSyncCount?: number;
    onSyncOffline?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
    activeView, 
    setActiveView, 
    onLogout, 
    onlineUsers = [], 
    userName,
    userRole = 'admin',
    userPermissions,
    isSuperAdmin = false,
    subModuleMap = {},
    openTabs = [],
    activeTabKey = '',
    onSelectTab,
    onCloseTab,
    onReorderTabs,
    isOffline = false,
    pendingSyncCount = 0,
    onSyncOffline
}) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showOnlineList, setShowOnlineList] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [mobileExpandedModule, setMobileExpandedModule] = useState<string | null>(activeView || null);
    const [draggedTabKey, setDraggedTabKey] = useState<string | null>(null);
    const navRef = useRef<HTMLDivElement>(null);
    const tabBarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeView) {
            setMobileExpandedModule(activeView);
        }
    }, [activeView]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(e.target as Node)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const displayRole = React.useMemo(() => {
        if (isSuperAdmin) return 'Superadmin';
        if (!userRole) return 'Staff';
        const trimmed = userRole.trim();
        if (trimmed.startsWith('{')) {
            try {
                const parsed = JSON.parse(trimmed);
                return parsed.name || (parsed.role === 'superadmin' ? 'Superadmin' : 'Staff');
            } catch {
                return 'Staff';
            }
        }
        return userRole;
    }, [userRole, isSuperAdmin]);

    const navItems = [
        { id: 'reports', label: 'Dashboard', icon: <ChartBarIcon />, color: 'text-violet-500' },
        { id: 'production', label: 'Produksi', icon: <TruckIcon />, color: 'text-emerald-500' },
        { id: 'sales_orders', label: 'Sales Order', icon: <ShoppingCartIcon />, color: 'text-teal-500' },
        { id: 'logistics', label: 'Logistik', icon: <BoxIcon />, color: 'text-amber-500' },
        { id: 'finance', label: 'Keuangan', icon: <BanknotesIcon />, color: 'text-blue-500' },
        { id: 'database', label: 'Basis Data', icon: <DatabaseIcon />, color: 'text-rose-500' },
        { id: 'dataLogger', label: 'Riwayat', icon: <DocumentTextIcon />, color: 'text-slate-500' },
    ];

    const visibleNavItems = navItems.filter((item) => {
        if (item.id === 'dataLogger') return Boolean(isSuperAdmin);
        if (isSuperAdmin) return true;
        if (!userPermissions) return true;
        return userPermissions[item.id as AppModuleId] !== 'none';
    });

    const handleModuleClick = (id: string) => {
        const subConfig = subModuleMap[id];
        if (subConfig && subConfig.items.length > 0) {
            // Hanya buka/tutup dropdown sub-menu tanpa langsung memuat modul
            setOpenDropdown((prev) => (prev === id ? null : id));
        } else {
            setActiveView(id);
            setOpenDropdown(null);
            setIsMobileMenuOpen(false);
        }
    };

    const handleSubModuleClick = (moduleId: string, subId: string) => {
        const subConfig = subModuleMap[moduleId];
        if (subConfig) {
            subConfig.onSelect(subId);
        } else {
            setActiveView(moduleId);
        }
        setOpenDropdown(null);
        setIsMobileMenuOpen(false);
    };

    const formatLabel = (raw: string) => {
        const acronyms = new Set(['HPP', 'LB', 'SO', 'DO', 'SJ', 'RPA']);
        return raw
            .split(' ')
            .map((word) => {
                const clean = word.replace(/[()]/g, '').toUpperCase();
                if (clean === 'PNL') return word.replace(/pnl/i, 'PnL');
                if (acronyms.has(clean)) return word.toUpperCase();
                if (word === '&' || word === '/') return word;
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join(' ');
    };

    return (
        <>
            {/* Unified Top Header + Multi-Tab Workspace Bar */}
            <header className="fixed top-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                {/* Main Navigation Row */}
                <div className="h-14 flex items-center justify-between px-4 md:px-8 max-w-[1440px] mx-auto w-full">
                    {/* Brand */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <img src="/logo trial.png" alt="Logo" className="w-7 h-7 object-contain" />
                        <div className="hidden sm:flex items-baseline gap-2">
                            <span className="font-bold text-slate-900 text-[13px] tracking-tight">PT Mitra Karya Foodindo</span>
                            <span className="hidden xl:inline-block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">RPA</span>
                        </div>
                    </div>

                    {/* Seamless Navigation */}
                    <nav ref={navRef} className="hidden md:flex items-center h-full gap-1">
                        {visibleNavItems.map((item) => {
                            const isActive = activeView === item.id;
                            const subConfig = subModuleMap[item.id];
                            const hasDropdown = Boolean(subConfig && subConfig.items.length > 0);
                            const isDropdownOpen = openDropdown === item.id;
                            const hasModuleBadge = hasDropdown && subConfig.items.some(s => Boolean(s.badge));

                            return (
                                <div key={item.id} className="relative h-full flex items-center">
                                    <button
                                        type="button"
                                        onClick={() => handleModuleClick(item.id)}
                                        className={`
                                            relative h-9 px-3 rounded-lg flex items-center gap-2 text-xs font-medium transition-all duration-150 shrink-0
                                            ${isActive
                                                ? 'text-slate-900 font-semibold bg-slate-100/90'
                                                : isDropdownOpen
                                                ? 'text-slate-900 bg-slate-100/60'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                            }
                                        `}
                                    >
                                        <span className={`transition-colors ${isActive || isDropdownOpen ? item.color : 'text-slate-400'}`}>
                                            {React.cloneElement(item.icon as React.ReactElement<any>, { className: "h-4 w-4" })}
                                        </span>
                                        <span className="whitespace-nowrap">{item.label}</span>
                                        {hasModuleBadge && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                        )}
                                        {hasDropdown && (
                                            <svg
                                                className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${isDropdownOpen ? 'rotate-180 text-slate-700' : ''}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        )}
                                    </button>

                                    {hasDropdown && isDropdownOpen && (
                                        <div className="absolute top-[calc(100%-4px)] left-0 pt-1.5 z-[300] min-w-[215px]">
                                            <div className="bg-white border border-slate-200/90 shadow-xl shadow-slate-900/8 rounded-xl p-1.5 space-y-0.5">
                                                {subConfig.items.map((sub) => {
                                                    const isSubActive = isActive && subConfig.activeId === sub.id;
                                                    return (
                                                        <button
                                                            key={sub.id}
                                                            type="button"
                                                            onClick={() => handleSubModuleClick(item.id, sub.id)}
                                                            className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                                                                isSubActive
                                                                    ? 'bg-slate-900 text-white font-semibold'
                                                                    : 'text-slate-600 font-medium hover:bg-slate-100/80 hover:text-slate-900'
                                                            }`}
                                                        >
                                                            <span className="truncate">
                                                                {formatLabel(sub.label)}
                                                            </span>
                                                            {sub.badge && (
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                                                                    isSubActive
                                                                        ? 'bg-white/20 text-white'
                                                                        : 'bg-indigo-50 text-indigo-600'
                                                                }`}>
                                                                    {sub.badge}
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </nav>

                    {/* Right Utilities */}
                    <div className="flex items-center gap-2 shrink-0">
                        {isOffline && (
                            <span
                                title="Koneksi terputus — Menampilkan data tersimpan & menyimpan input baru ke antrian lokal"
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold"
                            >
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                <span>Offline{pendingSyncCount > 0 ? ` (${pendingSyncCount})` : ''}</span>
                            </span>
                        )}
                        {!isOffline && pendingSyncCount > 0 && (
                            <button
                                type="button"
                                onClick={onSyncOffline}
                                title="Klik untuk sinkronisasi data offline ke server"
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                                <span>Sync ({pendingSyncCount})</span>
                            </button>
                        )}
                        {/* Online Presence Indicator */}
                        <div className="relative">
                            <button 
                                onMouseEnter={() => setShowOnlineList(true)}
                                onMouseLeave={() => setShowOnlineList(false)}
                                onClick={() => setShowOnlineList(!showOnlineList)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                            >
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                <span className="text-[11px] font-medium">{onlineUsers.length}</span>
                            </button>
                            
                            {showOnlineList && onlineUsers.length > 0 && (
                                <div className="absolute top-full right-0 mt-1.5 w-44 bg-white border border-slate-200/80 shadow-lg rounded-xl py-2 px-3 z-[200]">
                                    <p className="text-[10px] font-semibold text-slate-400 mb-1.5">User Aktif</p>
                                    <ul className="space-y-1.5">
                                        {onlineUsers.map((item, i) => (
                                            <li key={i} className="flex items-center justify-between gap-2 text-xs">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0" />
                                                    <span className="font-medium text-slate-700 capitalize truncate">{item.user}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 truncate max-w-[70px]">{item.location}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200/70">
                            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px] uppercase">
                                {(userName || displayRole).slice(0, 2)}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                                {userName && (
                                    <span className="font-semibold text-slate-700 capitalize truncate max-w-[100px]">
                                        {userName}
                                    </span>
                                )}
                                <span className="text-[10px] font-medium text-slate-400">
                                    ({displayRole})
                                </span>
                            </div>
                        </div>

                        <button 
                            onClick={onLogout} 
                            title="Keluar / Logout" 
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                            <LogoutIcon />
                        </button>
                        <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg">
                            <MenuIcon />
                        </button>
                    </div>
                </div>

                {/* Chrome-Style Multi-Tab Bar */}
                {openTabs.length > 0 && (
                    <div className="bg-slate-100/80 border-t border-slate-200/70">
                        <div
                            ref={tabBarRef}
                            onWheel={(e) => {
                                if (tabBarRef.current && e.deltaY !== 0) {
                                    tabBarRef.current.scrollLeft += e.deltaY;
                                }
                            }}
                            className="h-9 px-3 md:px-8 max-w-[1440px] mx-auto w-full flex items-end gap-1 overflow-x-auto no-scrollbar select-none pt-1"
                        >
                            {openTabs.map((tab, idx) => {
                                const isTabActive = activeTabKey === tab.key;
                                const isDragging = draggedTabKey === tab.key;
                                const navItem = navItems.find(n => n.id === tab.view);
                                return (
                                    <div
                                        key={tab.key}
                                        draggable
                                        onDragStart={(e) => {
                                            setDraggedTabKey(tab.key);
                                            e.dataTransfer.effectAllowed = 'move';
                                            e.dataTransfer.setData('text/plain', tab.key);
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                            if (!draggedTabKey || draggedTabKey === tab.key || !onReorderTabs) return;
                                            const fromIndex = openTabs.findIndex(t => t.key === draggedTabKey);
                                            if (fromIndex !== -1 && fromIndex !== idx) {
                                                onReorderTabs(fromIndex, idx);
                                            }
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            setDraggedTabKey(null);
                                        }}
                                        onDragEnd={() => setDraggedTabKey(null)}
                                        onClick={() => onSelectTab && onSelectTab(tab)}
                                        className={`
                                            group relative h-8 pl-3 pr-2 rounded-t-lg flex items-center gap-2 text-xs cursor-grab active:cursor-grabbing transition-all duration-150 shrink-0 max-w-[240px]
                                            ${isTabActive
                                                ? 'bg-slate-50 text-slate-900 font-semibold border-t border-x border-slate-200/90 shadow-[0_-1px_3px_rgba(15,23,42,0.03)] z-10 -mb-px'
                                                : 'bg-transparent text-slate-500 font-medium hover:bg-white/60 hover:text-slate-800 border-t border-x border-transparent'
                                            }
                                            ${isDragging ? 'opacity-60 ring-1 ring-indigo-400/60 scale-[0.98]' : ''}
                                        `}
                                    >
                                        {navItem && (
                                            <span className={`shrink-0 pointer-events-none ${isTabActive ? navItem.color : 'text-slate-400 group-hover:text-slate-600'}`}>
                                                {React.cloneElement(navItem.icon as React.ReactElement<any>, { className: "h-3.5 w-3.5" })}
                                            </span>
                                        )}
                                        <span className="truncate text-[11px] leading-none pointer-events-none">
                                            {formatLabel(tab.label)}
                                        </span>
                                        <button
                                            type="button"
                                            title="Tutup Tab"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onCloseTab) onCloseTab(tab.key, e);
                                            }}
                                            className={`
                                                w-4 h-4 rounded-md flex items-center justify-center transition-colors shrink-0 ml-0.5 cursor-pointer
                                                ${isTabActive
                                                    ? 'text-slate-400 hover:bg-slate-200/80 hover:text-slate-700'
                                                    : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-200/80 hover:text-slate-700'
                                                }
                                            `}
                                        >
                                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </header>

            {/* Mobile Sidebar */}
            <div className={`fixed inset-0 z-[110] md:hidden transition-all duration-200 ${isMobileMenuOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}>
                <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)} />
                <div className={`absolute top-0 right-0 h-full w-68 bg-white shadow-xl transition-transform duration-200 transform ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="p-4 h-full flex flex-col">
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <img src="/logo trial.png" alt="Logo" className="w-7 h-7" />
                                <span className="font-bold text-slate-800 text-xs">Menu Navigasi</span>
                            </div>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex-1 space-y-0.5 overflow-y-auto">
                            {visibleNavItems.map((item) => {
                                const isActive = activeView === item.id;
                                const subConfig = subModuleMap[item.id];
                                const hasDropdown = Boolean(subConfig && subConfig.items.length > 0);
                                const isExpanded = mobileExpandedModule === item.id;

                                return (
                                    <div key={item.id}>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if (hasDropdown) {
                                                    setMobileExpandedModule(isExpanded ? null : item.id);
                                                } else {
                                                    handleModuleClick(item.id);
                                                }
                                            }} 
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                                                isActive 
                                                    ? 'bg-slate-100 text-slate-900' 
                                                    : 'text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <span className={isActive ? item.color : 'text-slate-400'}>
                                                    {React.cloneElement(item.icon as React.ReactElement<any>, { className: "h-4 w-4" })}
                                                </span>
                                                <span>{item.label}</span>
                                            </div>
                                            {hasDropdown && (
                                                <svg
                                                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            )}
                                        </button>

                                        {hasDropdown && isExpanded && (
                                            <div className="ml-4 pl-3 border-l border-slate-200 space-y-0.5 my-1">
                                                {subConfig.items.map((sub) => {
                                                    const isSubActive = isActive && subConfig.activeId === sub.id;
                                                    return (
                                                        <button
                                                            key={sub.id}
                                                            type="button"
                                                            onClick={() => handleSubModuleClick(item.id, sub.id)}
                                                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-left text-xs transition-colors ${
                                                                isSubActive
                                                                    ? 'bg-slate-900 text-white font-semibold'
                                                                    : 'text-slate-500 font-medium hover:bg-slate-50 hover:text-slate-900'
                                                            }`}
                                                        >
                                                            <span className="capitalize">{sub.label.toLowerCase()}</span>
                                                            {sub.badge && (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-600">
                                                                    {sub.badge}
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <button onClick={onLogout} className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-rose-50 text-rose-600 font-semibold text-xs hover:bg-rose-100 transition-colors">
                            <LogoutIcon /> Keluar
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Header;