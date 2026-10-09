import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../supabaseClient';
import type { UserAccount, AppModuleId, AccessLevel, UserPermissions } from '../types';
import { APP_MODULES, getDefaultPermissions, parseUserPermissions, checkIsSuperAdmin } from '../constants';
import { 
    PlusIcon, TrashIcon, EditIcon, XIcon, CheckCircleIcon, 
    EyeIcon, EyeOffIcon, ChevronDownIcon, KeyIcon, SearchIcon, ShieldCheckIcon 
} from './icons';

interface UserManagementViewProps {
    currentUserName: string;
    userRole: string;
}

const ROLE_PRESETS: { id: string; label: string; icon: string; description: string; getPerms: () => UserPermissions }[] = [
    {
        id: 'full_logistics',
        label: 'Staf Gudang & Logistik',
        icon: '📦',
        description: 'Akses penuh seluruh operasional logistik: stok gudang, alokasi SJ, opname, trading, disposal, dan rekapitulasi',
        getPerms: () => {
            const p = getDefaultPermissions('none');
            const logMod = APP_MODULES.find(m => m.id === 'logistics');
            if (logMod) {
                p.logistics = 'edit';
                logMod.subModules.forEach(s => { p[s.id] = 'edit'; });
            }
            p.reports = 'viewer';
            p['reports.dashboard'] = 'viewer';
            return p;
        }
    },
    {
        id: 'driver_delivery',
        label: 'Supir / Pengiriman DO',
        icon: '🚚',
        description: 'Akses surat jalan (DO), konfirmasi timbangan tiba pelanggan, retur tolakan, dan monitoring stok viewer',
        getPerms: () => {
            const p = getDefaultPermissions('none');
            p.logistics = 'edit';
            p['logistics.delivery_orders'] = 'edit';
            p['logistics.do_receiving'] = 'edit';
            p['logistics.returns'] = 'edit';
            p['logistics.stock'] = 'viewer';
            p.reports = 'viewer';
            p['reports.dashboard'] = 'viewer';
            return p;
        }
    },
    {
        id: 'warehouse_stock',
        label: 'Admin Stok & Cold Storage',
        icon: '🧊',
        description: 'Kelola stok fisik karkas, otorisasi alokasi muat SJ, stock opname fisik, pembelian trading, dan pemusnahan afkir',
        getPerms: () => {
            const p = getDefaultPermissions('none');
            p.logistics = 'edit';
            p['logistics.stock'] = 'edit';
            p['logistics.stock_allocation'] = 'edit';
            p['logistics.stock_opname'] = 'edit';
            p['logistics.trading'] = 'edit';
            p['logistics.disposal'] = 'edit';
            p['logistics.stock_history'] = 'viewer';
            p['logistics.daily_recap'] = 'viewer';
            p.reports = 'viewer';
            p['reports.dashboard'] = 'viewer';
            return p;
        }
    },
    {
        id: 'finance_billing',
        label: 'Admin Keuangan & Faktur',
        icon: '💰',
        description: 'Kelola faktur invoice, penutupan SO, buku kas ledger, harga live bird, biaya operasional, dan penggajian',
        getPerms: () => {
            const p = getDefaultPermissions('none');
            const finMod = APP_MODULES.find(m => m.id === 'finance');
            if (finMod) {
                p.finance = 'edit';
                finMod.subModules.forEach(s => { p[s.id] = 'edit'; });
            }
            p.sales_orders = 'viewer';
            p['sales_orders.list'] = 'viewer';
            p['sales_orders.sales_history'] = 'viewer';
            p.logistics = 'viewer';
            p['logistics.delivery_orders'] = 'viewer';
            p.reports = 'viewer';
            p['reports.dashboard'] = 'viewer';
            return p;
        }
    },
    {
        id: 'production_supervisor',
        label: 'Mandor RPA & Produksi',
        icon: '🏭',
        description: 'Input pemotongan live bird harian, mortalitas, approval antrian, dan laporan konversi karkas',
        getPerms: () => {
            const p = getDefaultPermissions('none');
            const prodMod = APP_MODULES.find(m => m.id === 'production');
            if (prodMod) {
                p.production = 'edit';
                prodMod.subModules.forEach(s => { p[s.id] = 'edit'; });
            }
            p.logistics = 'viewer';
            p['logistics.stock'] = 'viewer';
            p.reports = 'viewer';
            p['reports.dashboard'] = 'viewer';
            return p;
        }
    },
    {
        id: 'sales_rep',
        label: 'Staf Penjualan (Sales)',
        icon: '🛒',
        description: 'Buat Sales Order pelanggan, monitoring pemenuhan pesanan, riwayat penjualan, dan tarik SO menjadi Surat Jalan',
        getPerms: () => {
            const p = getDefaultPermissions('none');
            const soMod = APP_MODULES.find(m => m.id === 'sales_orders');
            if (soMod) {
                p.sales_orders = 'edit';
                soMod.subModules.forEach(s => { p[s.id] = 'edit'; });
            }
            p.logistics = 'viewer';
            p['logistics.stock'] = 'viewer';
            p['logistics.delivery_orders'] = 'viewer';
            p.reports = 'viewer';
            p['reports.dashboard'] = 'viewer';
            return p;
        }
    },
    {
        id: 'all_viewer',
        label: 'Semua Modul Viewer',
        icon: '👁️',
        description: 'Akses lihat saja ke seluruh modul dan sub-modul sistem tanpa izin modifikasi',
        getPerms: () => getDefaultPermissions('viewer')
    }
];

const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUserName, userRole }) => {
    const [users, setUsers] = useState<UserAccount[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
    const [inspectingUser, setInspectingUser] = useState<UserAccount | null>(null);

    // Form states
    const [formUsername, setFormUsername] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [accountType, setAccountType] = useState<'superadmin' | 'custom'>('custom');
    const [permissions, setPermissions] = useState<UserPermissions>(getDefaultPermissions('viewer'));
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({ logistics: true, finance: true });
    const [searchQuery, setSearchQuery] = useState('');
    const [formError, setFormError] = useState('');

    const isSuperAdmin = checkIsSuperAdmin(currentUserName, userRole);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const data = await db.getUsers();
            setUsers(data);
        } catch (err: any) {
            console.error('Gagal mengambil daftar pengguna:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isSuperAdmin) {
            fetchUsers();
        }
    }, [isSuperAdmin]);

    const handleOpenCreateModal = () => {
        setEditingUser(null);
        setFormUsername('');
        setFormPassword('');
        setShowPassword(false);
        setAccountType('custom');
        setPermissions(getDefaultPermissions('viewer'));
        setExpandedModules({ logistics: true, finance: true });
        setSearchQuery('');
        setFormError('');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (userItem: UserAccount) => {
        setEditingUser(userItem);
        setFormUsername(userItem.user);
        setFormPassword('');
        setShowPassword(false);
        const parsed = parseUserPermissions(userItem.role);
        setAccountType(parsed.isSuperAdmin ? 'superadmin' : 'custom');
        setPermissions(parsed.permissions);
        setExpandedModules({ logistics: true, finance: true });
        setSearchQuery('');
        setFormError('');
        setIsModalOpen(true);
    };

    const handleApplyPreset = (preset: typeof ROLE_PRESETS[0]) => {
        setAccountType('custom');
        setPermissions(preset.getPerms());
    };

    const handleSetAllPermissions = (level: AccessLevel) => {
        setPermissions(getDefaultPermissions(level));
    };

    const toggleModuleExpand = (modId: string) => {
        setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
    };

    const handleSetModulePermissions = (moduleId: string, level: AccessLevel) => {
        setPermissions(prev => {
            const next = { ...prev, [moduleId]: level };
            const mod = APP_MODULES.find(m => m.id === moduleId);
            if (mod?.subModules) {
                mod.subModules.forEach(sub => {
                    next[sub.id] = level;
                });
            }
            return next;
        });
    };

    const handleSetCategoryPermissions = (moduleId: string, category: string, level: AccessLevel) => {
        setPermissions(prev => {
            const next = { ...prev };
            const mod = APP_MODULES.find(m => m.id === moduleId);
            if (mod?.subModules) {
                mod.subModules.forEach(sub => {
                    if ((sub.category || 'Umum') === category) {
                        next[sub.id] = level;
                    }
                });
                const anyEditable = mod.subModules.some(sub => (next[sub.id] || 'none') === 'edit');
                const anyAccessible = mod.subModules.some(sub => (next[sub.id] || 'none') !== 'none');
                next[moduleId] = anyEditable ? 'edit' : anyAccessible ? 'viewer' : 'none';
            }
            return next;
        });
    };

    const handleSubModulePermissionChange = (moduleId: string, subModuleId: string, level: AccessLevel) => {
        setPermissions(prev => {
            const next = { ...prev, [subModuleId]: level };
            const mod = APP_MODULES.find(m => m.id === moduleId);
            if (mod?.subModules) {
                const anyEditable = mod.subModules.some(sub => (sub.id === subModuleId ? level : (next[sub.id] || 'none')) === 'edit');
                const anyAccessible = mod.subModules.some(sub => (sub.id === subModuleId ? level : (next[sub.id] || 'none')) !== 'none');
                next[moduleId] = anyEditable ? 'edit' : anyAccessible ? 'viewer' : 'none';
            }
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        const cleanUsername = formUsername.trim();
        if (!cleanUsername) {
            setFormError('Username wajib diisi.');
            return;
        }

        if (!editingUser && !formPassword) {
            setFormError('Password wajib diisi untuk akun baru.');
            return;
        }

        setIsLoading(true);
        try {
            const rolePayload = accountType === 'superadmin' ? 'superadmin' : 'staff';
            if (editingUser && editingUser.id) {
                await db.updateUser(
                    editingUser.id,
                    {
                        user: cleanUsername,
                        password: formPassword || undefined,
                        role: rolePayload,
                        permissions: accountType === 'superadmin' ? getDefaultPermissions('edit') : permissions
                    },
                    currentUserName
                );
                alert(`Akun "${cleanUsername}" berhasil diperbarui!`);
            } else {
                await db.addUser(
                    {
                        user: cleanUsername,
                        password: formPassword,
                        role: rolePayload,
                        permissions: accountType === 'superadmin' ? getDefaultPermissions('edit') : permissions
                    },
                    currentUserName
                );
                alert(`Akun "${cleanUsername}" berhasil dibuat!`);
            }
            setIsModalOpen(false);
            await fetchUsers();
        } catch (err: any) {
            setFormError(err.message || 'Gagal menyimpan akun.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteUser = async (userItem: UserAccount) => {
        if (!userItem.id) return;
        if (userItem.user === currentUserName) {
            alert('Anda tidak dapat menghapus akun yang sedang Anda gunakan saat ini.');
            return;
        }
        if (!window.confirm(`Konfirmasi hapus akun "${userItem.user}"?\n\nTindakan ini tidak dapat dibatalkan.`)) {
            return;
        }

        setIsLoading(true);
        try {
            await db.deleteUser(userItem.id, userItem.user, currentUserName);
            alert(`Akun "${userItem.user}" berhasil dihapus.`);
            await fetchUsers();
        } catch (err: any) {
            alert('Gagal menghapus akun: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter modules and sub-modules based on search
    const filteredModules = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return APP_MODULES;

        return APP_MODULES.map(mod => {
            const modMatch = mod.label.toLowerCase().includes(query) || mod.description.toLowerCase().includes(query);
            const matchingSubs = (mod.subModules || []).filter(sub => 
                sub.label.toLowerCase().includes(query) ||
                sub.description.toLowerCase().includes(query) ||
                (sub.category || '').toLowerCase().includes(query) ||
                sub.key.toLowerCase().includes(query)
            );

            if (modMatch || matchingSubs.length > 0) {
                return {
                    ...mod,
                    subModules: modMatch ? mod.subModules : matchingSubs
                };
            }
            return null;
        }).filter(Boolean) as typeof APP_MODULES;
    }, [searchQuery]);

    if (!isSuperAdmin) {
        return (
            <div className="p-8 bg-rose-50 border border-rose-200 rounded-3xl text-center space-y-2">
                <span className="text-2xl">🔒</span>
                <h3 className="text-base font-black text-rose-900 uppercase">Akses Dibatasi</h3>
                <p className="text-xs text-rose-700 font-bold">
                    Menu ini khusus untuk akun Superadmin. Hubungi Super Administrator untuk mengubah hak akses.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-amber-400 text-slate-950 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm">
                            Superadmin Master Control
                        </span>
                        <span className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">Granular Access Control</span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight mt-1.5 text-white">
                        Manajemen Akun & Hak Akses Detail
                    </h2>
                    <p className="text-xs text-slate-300 font-medium mt-1 max-w-2xl leading-relaxed">
                        Atur akses setiap staf hingga ke level sub-modul (contoh: di Logistik dapat diatur akses berbeda antara Stok Fisik, Alokasi, Surat Jalan DO, Retur, Timbangan Tiba, hingga Cetak SJ Manual).
                    </p>
                </div>
                <div className="flex items-center gap-2 relative z-10 shrink-0">
                    <button
                        onClick={handleOpenCreateModal}
                        className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 active:scale-95 whitespace-nowrap"
                    >
                        <PlusIcon className="h-4 w-4" />
                        <span>Buat Akun Baru</span>
                    </button>
                    <button
                        onClick={fetchUsers}
                        className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all"
                        title="Segarkan Data"
                    >
                        <svg className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* User List Table */}
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
                    <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Daftar Akun Pengguna</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            Total {users.length} pengguna terdaftar di sistem
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto no-scrollbar">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-5 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">No</th>
                                <th className="px-5 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Username</th>
                                <th className="px-5 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipe Akun</th>
                                <th className="px-5 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Ringkasan Hak Akses Sub-Modul</th>
                                <th className="px-5 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Dibuat Pada</th>
                                <th className="px-5 py-3.5 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-xs font-bold text-slate-400 italic">
                                        {isLoading ? 'Memuat data pengguna...' : 'Belum ada data pengguna.'}
                                    </td>
                                </tr>
                            ) : (
                                users.map((u, idx) => {
                                    const parsed = parseUserPermissions(u.role);
                                    const isSelf = u.user === currentUserName;

                                    return (
                                        <tr key={u.id || idx} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-5 py-4 whitespace-nowrap text-xs font-bold text-slate-400">
                                                {idx + 1}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xs uppercase border border-indigo-200 shadow-sm">
                                                        {u.user.slice(0, 2)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs font-black text-slate-900 uppercase">{u.user}</span>
                                                            {isSelf && (
                                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase rounded-full border border-emerald-200">
                                                                    Anda
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[9px] text-slate-400 font-medium">ID: #{u.id}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {parsed.isSuperAdmin ? (
                                                    <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-sm">
                                                        ★ Superadmin
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                                                        👤 {parsed.roleName}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                {parsed.isSuperAdmin ? (
                                                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 inline-flex items-center gap-1.5">
                                                        <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
                                                        Akses Penuh (Edit) ke Seluruh Modul & Sub-Modul
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-1.5 max-w-xl">
                                                        {APP_MODULES.map(mod => {
                                                            const subs = mod.subModules || [];
                                                            const editSubs = subs.filter(s => (parsed.permissions[s.id] || parsed.permissions[mod.id] || 'none') === 'edit');
                                                            const viewSubs = subs.filter(s => (parsed.permissions[s.id] || parsed.permissions[mod.id] || 'none') === 'viewer');
                                                            const isNone = editSubs.length === 0 && viewSubs.length === 0;

                                                            if (isNone) return null;

                                                            return (
                                                                <span
                                                                    key={mod.id}
                                                                    className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[9px] font-bold text-slate-800 inline-flex items-center gap-1.5 shadow-2xs"
                                                                    title={`${mod.label}: ${editSubs.length} Edit, ${viewSubs.length} View`}
                                                                >
                                                                    <span className="font-black uppercase">{mod.label.split(' ')[0]}:</span>
                                                                    {editSubs.length > 0 && (
                                                                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[8px] font-black">
                                                                            {editSubs.length} Edit
                                                                        </span>
                                                                    )}
                                                                    {viewSubs.length > 0 && (
                                                                        <span className="px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 text-[8px] font-black">
                                                                            {viewSubs.length} View
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            );
                                                        })}
                                                        <button
                                                            onClick={() => setInspectingUser(u)}
                                                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 transition-all"
                                                        >
                                                            <KeyIcon className="h-3 w-3" />
                                                            Detail Izin
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-[10px] font-bold text-slate-400">
                                                {u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => setInspectingUser(u)}
                                                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                        title="Lihat Detail Hak Akses"
                                                    >
                                                        <KeyIcon className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenEditModal(u)}
                                                        className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                        title="Edit Akun & Izin"
                                                    >
                                                        <EditIcon className="h-4 w-4" />
                                                    </button>
                                                    {!isSelf && (
                                                        <button
                                                            onClick={() => handleDeleteUser(u)}
                                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                            title="Hapus Akun"
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Create / Edit User */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 md:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                            <div>
                                <h3 className="text-base font-black text-slate-900 uppercase">
                                    {editingUser ? `Edit Akun "${editingUser.user}"` : 'Buat Akun Pengguna Baru'}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    Kelola kredensial dan konfigurasi detail akses per sub-modul
                                </p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                            {formError && (
                                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 animate-in fade-in">
                                    {formError}
                                </div>
                            )}

                            {/* Username & Password */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
                                        Username <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formUsername}
                                        onChange={(e) => setFormUsername(e.target.value)}
                                        placeholder="Contoh: staff_logistik / driver_01"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
                                        Password {editingUser ? <span className="text-slate-400 font-normal">(Kosongkan jika tidak diubah)</span> : <span className="text-rose-500">*</span>}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required={!editingUser}
                                            value={formPassword}
                                            onChange={(e) => setFormPassword(e.target.value)}
                                            placeholder={editingUser ? '••••••••' : 'Masukkan password baru'}
                                            className="w-full px-4 py-2.5 pr-11 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Account Type Selector */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-2">
                                    Tipe Akun Pengguna
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setAccountType('custom')}
                                        className={`p-3.5 rounded-2xl border text-left transition-all ${
                                            accountType === 'custom'
                                                ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-sm'
                                                : 'border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-slate-900 uppercase">Akun Kustom / Staf Spesifik</span>
                                            {accountType === 'custom' && <CheckCircleIcon className="h-4 w-4 text-indigo-600" />}
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-medium mt-1">
                                            Atur akses terperinci per sub-modul (Hanya Viewer atau Bisa Edit/Kelola).
                                        </p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setAccountType('superadmin')}
                                        className={`p-3.5 rounded-2xl border text-left transition-all ${
                                            accountType === 'superadmin'
                                                ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-sm'
                                                : 'border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-slate-900 uppercase">Super Administrator</span>
                                            {accountType === 'superadmin' && <CheckCircleIcon className="h-4 w-4 text-amber-600" />}
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-medium mt-1">
                                            Akses penuh ke seluruh modul, termasuk Riwayat Aktivitas dan Pengaturan Akses.
                                        </p>
                                    </button>
                                </div>
                                <div className="mt-2.5 px-3.5 py-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-center gap-2 text-[10px] font-bold text-amber-900">
                                    <span>🔒</span>
                                    <span>
                                        Menu <strong>Riwayat Aktivitas</strong> dan <strong>Pengaturan Akses (Kelola Akun)</strong> dikunci khusus hanya untuk akun <strong>Superadmin</strong>.
                                    </span>
                                </div>
                            </div>

                            {/* Detailed Permissions Accordion (If accountType === 'custom') */}
                            {accountType === 'custom' && (
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    {/* Role Presets Section */}
                                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                                <span>⚡</span> Template Cepat Hak Akses
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-bold">
                                                Klik untuk menerapkan paket akses
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {ROLE_PRESETS.map((preset) => (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    onClick={() => handleApplyPreset(preset)}
                                                    className="px-3 py-1.5 bg-white hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 rounded-xl text-[9px] font-black text-slate-800 transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
                                                    title={preset.description}
                                                >
                                                    <span>{preset.icon}</span>
                                                    <span>{preset.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Sub-module search bar and global actions */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white pt-2">
                                        <div className="relative flex-1 max-w-md">
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Cari sub-modul (contoh: 'opname', 'surat jalan', 'trading', 'retur')..."
                                                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white"
                                            />
                                            <SearchIcon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                            {searchQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSearchQuery('')}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                >
                                                    <XIcon className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleSetAllPermissions('none')}
                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                                            >
                                                Semua Tutup
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleSetAllPermissions('viewer')}
                                                className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                                            >
                                                Semua Viewer
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleSetAllPermissions('edit')}
                                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                                            >
                                                Semua Edit
                                            </button>
                                        </div>
                                    </div>

                                    {/* Detailed Modules Accordion */}
                                    <div className="space-y-3">
                                        {filteredModules.length === 0 ? (
                                            <div className="p-8 text-center text-xs font-bold text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                                                Tidak ditemukan sub-modul yang cocok dengan "{searchQuery}".
                                            </div>
                                        ) : (
                                            filteredModules.map((mod) => {
                                                const subs = mod.subModules || [];
                                                const isExpanded = !!expandedModules[mod.id] || !!searchQuery;
                                                const editCount = subs.filter(s => (permissions[s.id] !== undefined ? permissions[s.id] : (permissions[mod.id] || 'none')) === 'edit').length;
                                                const viewCount = subs.filter(s => (permissions[s.id] !== undefined ? permissions[s.id] : (permissions[mod.id] || 'none')) === 'viewer').length;
                                                const noneCount = subs.length - editCount - viewCount;

                                                // Group sub-modules by category
                                                const categoriesMap = new Map<string, typeof subs>();
                                                subs.forEach(sub => {
                                                    const cat = sub.category || 'Umum';
                                                    if (!categoriesMap.has(cat)) categoriesMap.set(cat, []);
                                                    categoriesMap.get(cat)!.push(sub);
                                                });

                                                return (
                                                    <div key={mod.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm transition-all">
                                                        {/* Module Accordion Header */}
                                                        <div className="p-3.5 bg-slate-50/90 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleModuleExpand(mod.id)}
                                                                className="flex items-center gap-2.5 text-left flex-1"
                                                            >
                                                                <div className={`p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                                                    <ChevronDownIcon className="h-4 w-4" />
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{mod.label}</span>
                                                                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                                            {subs.length} Sub-Modul Detail
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 mt-1 text-[8px] font-bold">
                                                                        {editCount > 0 && <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{editCount} Bisa Edit</span>}
                                                                        {viewCount > 0 && <span className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">{viewCount} Viewer</span>}
                                                                        {noneCount > 0 && <span className="text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{noneCount} Tutup</span>}
                                                                    </div>
                                                                </div>
                                                            </button>

                                                            {/* Module-level bulk buttons */}
                                                            <div className="flex items-center gap-1 shrink-0 self-end md:self-auto">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSetModulePermissions(mod.id, 'none')}
                                                                    className="px-2.5 py-1 bg-slate-200/70 hover:bg-slate-200 text-slate-700 rounded-lg text-[8px] font-black uppercase tracking-wider"
                                                                    title={`Tutup seluruh sub-modul ${mod.label}`}
                                                                >
                                                                    Tutup Semua
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSetModulePermissions(mod.id, 'viewer')}
                                                                    className="px-2.5 py-1 bg-sky-100/80 hover:bg-sky-200 text-sky-800 rounded-lg text-[8px] font-black uppercase tracking-wider"
                                                                    title={`Set semua sub-modul ${mod.label} menjadi Viewer`}
                                                                >
                                                                    Semua Viewer
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSetModulePermissions(mod.id, 'edit')}
                                                                    className="px-2.5 py-1 bg-emerald-100/80 hover:bg-emerald-200 text-emerald-800 rounded-lg text-[8px] font-black uppercase tracking-wider"
                                                                    title={`Set semua sub-modul ${mod.label} menjadi Bisa Edit`}
                                                                >
                                                                    Semua Edit
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Sub-modules categorized list */}
                                                        {isExpanded && (
                                                            <div className="divide-y divide-slate-100 bg-white">
                                                                {Array.from(categoriesMap.entries()).map(([catName, catSubs]) => (
                                                                    <div key={catName} className="p-3 sm:p-4 space-y-2.5">
                                                                        {/* Category Header */}
                                                                        <div className="flex items-center justify-between bg-slate-50/70 px-3 py-1.5 rounded-xl border border-slate-100">
                                                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                                                                {catName}
                                                                            </span>
                                                                            <div className="flex items-center gap-1">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleSetCategoryPermissions(mod.id, catName, 'none')}
                                                                                    className="px-1.5 py-0.5 text-[8px] font-bold text-slate-500 hover:text-slate-800 rounded hover:bg-slate-200/50"
                                                                                >
                                                                                    Tutup
                                                                                </button>
                                                                                <span className="text-slate-300">•</span>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleSetCategoryPermissions(mod.id, catName, 'viewer')}
                                                                                    className="px-1.5 py-0.5 text-[8px] font-bold text-sky-700 hover:bg-sky-50 rounded"
                                                                                >
                                                                                    Viewer
                                                                                </button>
                                                                                <span className="text-slate-300">•</span>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleSetCategoryPermissions(mod.id, catName, 'edit')}
                                                                                    className="px-1.5 py-0.5 text-[8px] font-bold text-emerald-700 hover:bg-emerald-50 rounded"
                                                                                >
                                                                                    Edit
                                                                                </button>
                                                                            </div>
                                                                        </div>

                                                                        {/* Submodules in this category */}
                                                                        <div className="grid grid-cols-1 gap-2 pl-1 sm:pl-2">
                                                                            {catSubs.map((sub) => {
                                                                                const currentLevel = permissions[sub.id] !== undefined ? permissions[sub.id] : (permissions[mod.id] || 'none');

                                                                                return (
                                                                                    <div
                                                                                        key={sub.id}
                                                                                        className="p-3 bg-white border border-slate-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-200 transition-all shadow-2xs"
                                                                                    >
                                                                                        <div className="pr-2 space-y-0.5">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <span className="text-xs font-black text-slate-800 uppercase">
                                                                                                    {sub.label}
                                                                                                </span>
                                                                                                <code className="text-[8px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                                                                                    {sub.id}
                                                                                                </code>
                                                                                            </div>
                                                                                            <p className="text-[10px] text-slate-500 font-medium">
                                                                                                {sub.description}
                                                                                            </p>
                                                                                        </div>

                                                                                        {/* 3-State Segmented Control */}
                                                                                        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl shrink-0 self-end sm:self-auto border border-slate-200/50">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => handleSubModulePermissionChange(mod.id, sub.id, 'none')}
                                                                                                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                                                                                    currentLevel === 'none'
                                                                                                        ? 'bg-rose-600 text-white shadow-sm'
                                                                                                        : 'text-slate-500 hover:text-slate-800'
                                                                                                }`}
                                                                                            >
                                                                                                ❌ Tutup
                                                                                            </button>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => handleSubModulePermissionChange(mod.id, sub.id, 'viewer')}
                                                                                                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                                                                                    currentLevel === 'viewer'
                                                                                                        ? 'bg-sky-600 text-white shadow-sm'
                                                                                                        : 'text-slate-500 hover:text-slate-800'
                                                                                                }`}
                                                                                            >
                                                                                                👁️ Viewer
                                                                                            </button>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => handleSubModulePermissionChange(mod.id, sub.id, 'edit')}
                                                                                                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                                                                                    currentLevel === 'edit'
                                                                                                        ? 'bg-emerald-600 text-white shadow-sm'
                                                                                                        : 'text-slate-500 hover:text-slate-800'
                                                                                                }`}
                                                                                            >
                                                                                                ✏️ Bisa Edit
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Modal Footer Buttons */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/30 active:scale-95 disabled:opacity-50"
                                >
                                    {isLoading ? 'Menyimpan...' : editingUser ? 'Simpan Perubahan' : 'Buat Akun'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Inspect Permissions Modal */}
            {inspectingUser && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 md:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm uppercase shadow-sm">
                                    {inspectingUser.user.slice(0, 2)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-black text-slate-900 uppercase">
                                            Rincian Hak Akses: {inspectingUser.user}
                                        </h3>
                                        <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                                            {parseUserPermissions(inspectingUser.role).roleName}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                        Daftar izin operasional modul dan sub-modul sistem
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setInspectingUser(null)}
                                className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                            {(() => {
                                const parsed = parseUserPermissions(inspectingUser.role);
                                if (parsed.isSuperAdmin) {
                                    return (
                                        <div className="p-8 text-center space-y-3 bg-amber-50/60 border border-amber-200 rounded-3xl">
                                            <span className="text-3xl">👑</span>
                                            <h4 className="text-sm font-black text-amber-900 uppercase">Akses Penuh Super Administrator</h4>
                                            <p className="text-xs text-amber-800 font-medium max-w-md mx-auto">
                                                Akun ini memiliki otoritas penuh (Bisa Edit) ke seluruh modul, sub-modul, master database, dan fitur manajemen akun pengguna.
                                            </p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-4">
                                        {APP_MODULES.map(mod => {
                                            const subs = mod.subModules || [];
                                            return (
                                                <div key={mod.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/40 space-y-3">
                                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                        <span className="text-xs font-black text-slate-900 uppercase">{mod.label}</span>
                                                        <span className="text-[9px] font-bold text-slate-400">{subs.length} Sub-Modul</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {subs.map(sub => {
                                                            const level = parsed.permissions[sub.id] || parsed.permissions[mod.id] || 'none';
                                                            return (
                                                                <div key={sub.id} className="p-2.5 bg-white border border-slate-100 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                                                                    <div className="overflow-hidden">
                                                                        <p className="text-xs font-bold text-slate-800 truncate">{sub.label}</p>
                                                                        <p className="text-[9px] text-slate-400 truncate">{sub.category || 'Umum'}</p>
                                                                    </div>
                                                                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase shrink-0 ${
                                                                        level === 'edit'
                                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                            : level === 'viewer'
                                                                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                                                            : 'bg-slate-100 text-slate-400'
                                                                    }`}>
                                                                        {level === 'edit' ? '✏️ Edit' : level === 'viewer' ? '👁️ View' : '❌ Tutup'}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <button
                                onClick={() => {
                                    const u = inspectingUser;
                                    setInspectingUser(null);
                                    handleOpenEditModal(u);
                                }}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                            >
                                Edit Izin Pengguna Ini
                            </button>
                            <button
                                onClick={() => setInspectingUser(null)}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagementView;
