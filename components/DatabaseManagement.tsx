import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, EditIcon, XIcon } from './icons';
import type { Coop, Customer, MasterItem, UserPermissions } from '../types';
import { sortChickenParts, getSubModulePermission, canEditSubModule, checkIsSuperAdmin } from '../constants';

import DatabaseBackup from './DatabaseBackup';
import UserManagementView from './UserManagementView';
type View = 'coops' | 'plates' | 'customers' | 'items' | 'backup' | 'users';

interface DatabaseManagementProps {
    coops: Coop[];
    licensePlates: string[];
    customers: Customer[];
    masterItems: MasterItem[];
    customerDebts: { [key: string]: number };
    onAdd: (type: 'coops' | 'licensePlates' | 'customers' | 'items', data: any) => Promise<void>;
    onDelete: (type: 'coops' | 'licensePlates' | 'customers' | 'items', identifier: string) => Promise<void>;
    onUpdateCustomer?: (oldName: string, newName: string, newAddress: string) => Promise<void>;
    currentUserName?: string;
    userRole?: string;
    userPermissions?: UserPermissions;
    isSuperAdmin?: boolean;
    activeSubView?: View;
    onChangeSubView?: (view: View) => void;
}

const DatabaseManagement: React.FC<DatabaseManagementProps> = ({ 
    coops, 
    licensePlates, 
    customers, 
    masterItems, 
    customerDebts, 
    onAdd, 
    onDelete, 
    onUpdateCustomer, 
    currentUserName = '', 
    userRole = '',
    userPermissions,
    isSuperAdmin: isSuperAdminProp,
    activeSubView,
    onChangeSubView
}) => {
    const isSuperAdmin = isSuperAdminProp !== undefined
        ? isSuperAdminProp
        : checkIsSuperAdmin(currentUserName, userRole);

    const tabs: { id: View; label: string }[] = [
        { id: 'coops', label: 'Nama Kandang' },
        { id: 'plates', label: 'Plat Nomor' },
        { id: 'customers', label: 'Customer' },
        { id: 'items', label: 'Nama Item' },
        { id: 'backup', label: 'Backup Database' },
        ...(isSuperAdmin ? [{ id: 'users' as View, label: 'Pengaturan Akses & Akun' }] : [])
    ].filter(t => {
        if (t.id === 'users') return isSuperAdmin;
        if (isSuperAdmin) return true;
        return getSubModulePermission(userPermissions, 'database', t.id, isSuperAdmin) !== 'none';
    });

    const [internalView, setInternalView] = useState<View>(() => {
        return tabs[0]?.id || 'coops';
    });

    const activeView = activeSubView || internalView;
    const setActiveView = (v: View) => {
        if (onChangeSubView) onChangeSubView(v);
        setInternalView(v);
    };

    useEffect(() => {
        if (!isSuperAdmin && activeView === 'users') {
            setActiveView(tabs[0]?.id || 'coops');
        } else if (tabs.length > 0 && !tabs.some(t => t.id === activeView)) {
            setActiveView(tabs[0].id);
        }
    }, [isSuperAdmin, activeView, tabs]);

    const [newCoop, setNewCoop] = useState({ name: '', address: '' });
    const [newPlate, setNewPlate] = useState('');
    const [newCustomer, setNewCustomer] = useState({ name: '', address: '' });
    const [newItem, setNewItem] = useState('');

    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [editCustomerForm, setEditCustomerForm] = useState({ name: '', address: '' });

    const handleAddCoop = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newCoop.name.trim();
        if (trimmedName && !coops.some(c => c.name.toUpperCase() === trimmedName.toUpperCase())) {
            const updatedCoop = { ...newCoop, name: trimmedName.toUpperCase() };
            try {
                await onAdd('coops', updatedCoop);
                setNewCoop({ name: '', address: '' });
            } catch (e: any) {
                alert('Gagal: ' + e.message);
            }
        } else {
            alert('Nama kandang tidak boleh kosong atau sudah ada.');
        }
    };

    const handleDeleteCoop = async (name: string) => {
        if (window.confirm(`Yakin ingin menghapus kandang "${name}"?`)) {
            try {
                await onDelete('coops', name);
            } catch (e: any) {
                alert('Gagal: ' + e.message);
            }
        }
    };

    const handleAddPlate = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedPlate = newPlate.trim().toUpperCase();
        if (trimmedPlate && !licensePlates.some(p => p.toUpperCase() === trimmedPlate)) {
            try {
                await onAdd('licensePlates', trimmedPlate);
                setNewPlate('');
            } catch (e: any) {
                alert('Gagal: ' + e.message);
            }
        } else {
            alert('Plat nomor tidak boleh kosong atau sudah ada.');
        }
    };

    const handleDeletePlate = async (plate: string) => {
        if (window.confirm(`Yakin ingin menghapus plat nomor "${plate}"?`)) {
            try {
                await onDelete('licensePlates', plate);
            } catch (e: any) {
                alert('Gagal: ' + e.message);
            }
        }
    };

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newCustomer.name.trim();
        if (trimmedName && !customers.some(c => c.name.toUpperCase() === trimmedName.toUpperCase())) {
            const updatedCustomer = { ...newCustomer, name: trimmedName.toUpperCase() };
            try {
                await onAdd('customers', updatedCustomer);
                setNewCustomer({ name: '', address: '' });
            } catch (e: any) {
                alert('Gagal: ' + e.message);
            }
        } else {
            alert('Nama customer tidak boleh kosong atau sudah ada.');
        }
    };

    const handleDeleteCustomer = async (name: string) => {
        if (window.confirm(`Yakin ingin menghapus customer "${name}"?`)) {
            try {
                await onDelete('customers', name);
            } catch (e: any) {
                alert('Gagal: ' + e.message);
            }
        }
    };

    const handleEditCustomer = (customer: Customer) => {
        setEditingCustomer(customer);
        setEditCustomerForm({ name: customer.name, address: customer.address || '' });
    };

    const handleUpdateCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCustomer || !onUpdateCustomer) return;

        const trimmedName = editCustomerForm.name.trim().toUpperCase();
        if (!trimmedName) {
            alert('Nama customer tidak boleh kosong.');
            return;
        }

        // Check if name changed and if new name already exists
        if (trimmedName !== editingCustomer.name.toUpperCase() && customers.some(c => c.name.toUpperCase() === trimmedName)) {
            alert('Nama customer sudah ada.');
            return;
        }

        if (window.confirm(`Update customer "${editingCustomer.name}" menjadi "${trimmedName}"? Perubahan ini akan mengupdate semua data SJ, Invoice, dan Ledger terkait.`)) {
            try {
                await onUpdateCustomer(editingCustomer.name, trimmedName, editCustomerForm.address);
                setEditingCustomer(null);
            } catch (e: any) {
                alert('Gagal update: ' + e.message);
            }
        }
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedItem = newItem.trim().toUpperCase();
        if (trimmedItem && !masterItems.some(i => i.name.toUpperCase() === trimmedItem)) {
            try {
                await onAdd('items', { name: trimmedItem });
                setNewItem('');
            } catch (e: any) {
                alert('Gagal: ' + e.message);
            }
        } else {
            alert('Nama item tidak boleh kosong atau sudah ada.');
        }
    };

    const handleDeleteItem = async (name: string) => {
        if (window.confirm(`Yakin ingin menghapus item "${name}"? Perhatian: Ini mungkin mempengaruhi tampilan stok produk.`)) {
            try {
                await onDelete('items', name);
            } catch (e: any) {
                alert('Gagal: ' + e.message);
            }
        }
    };


    const renderContent = () => {
        const canEditCurrent = canEditSubModule(userPermissions, 'database', activeView, isSuperAdmin);
        switch (activeView) {
            case 'coops':
                return (
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        {canEditCurrent && (
                            <form onSubmit={handleAddCoop} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <input type="text" value={newCoop.name} onChange={(e) => setNewCoop({ ...newCoop, name: e.target.value })} placeholder="Nama Kandang Baru..." className="md:col-span-1 block w-full px-3 py-2 border border-gray-300 rounded-md" required />
                                <input type="text" value={newCoop.address} onChange={(e) => setNewCoop({ ...newCoop, address: e.target.value })} placeholder="Alamat Kandang..." className="md:col-span-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                                <button type="submit" className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                                    <PlusIcon /> Tambah Kandang
                                </button>
                            </form>
                        )}
                        <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto border rounded-md p-2">
                            {coops.map(coop => (
                                <li key={coop.name} className="py-2 px-2 flex justify-between items-center hover:bg-gray-50">
                                    <div>
                                        <p className="text-gray-900 font-medium uppercase">{coop.name}</p>
                                        <p className="text-gray-500 text-sm">{coop.address}</p>
                                    </div>
                                    {canEditCurrent && (
                                        <button onClick={() => handleDeleteCoop(coop.name)} className="text-red-500 hover:text-red-700 p-1"><TrashIcon /></button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            case 'plates':
                return (
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        {canEditCurrent && (
                            <form onSubmit={handleAddPlate} className="flex gap-2 mb-4">
                                <input type="text" value={newPlate} onChange={(e) => setNewPlate(e.target.value)} placeholder="Tambah Plat Nomor baru..." className="flex-grow block w-full px-3 py-2 border border-gray-300 rounded-md" required />
                                <button type="submit" className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                                    <PlusIcon /> Tambah
                                </button>
                            </form>
                        )}
                        <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto border rounded-md p-2">
                            {licensePlates.map(plate => (
                                <li key={plate} className="py-2 px-2 flex justify-between items-center hover:bg-gray-50">
                                    <span className="text-gray-700 uppercase">{plate}</span>
                                    {canEditCurrent && (
                                        <button onClick={() => handleDeletePlate(plate)} className="text-red-500 hover:text-red-700 p-1"><TrashIcon /></button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            case 'customers':
                return (
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        {canEditCurrent && (
                            <form onSubmit={handleAddCustomer} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <input type="text" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="Nama Customer Baru..." className="md:col-span-1 block w-full px-3 py-2 border border-gray-300 rounded-md" required />
                                <input type="text" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} placeholder="Alamat Customer..." className="md:col-span-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                                <button type="submit" className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                                    <PlusIcon /> Tambah Customer
                                </button>
                            </form>
                        )}
                        <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto border rounded-md p-2">
                            {customers.map(customer => {
                                const debt = customerDebts[customer.name] || 0;
                                return (
                                    <li key={customer.name} className="py-3 px-2 flex justify-between items-center hover:bg-gray-50">
                                        <div>
                                            <p className="text-gray-900 font-medium uppercase">{customer.name}</p>
                                            <p className="text-gray-500 text-sm">{customer.address}</p>
                                            {debt > 0 && (
                                                <p className="text-red-600 text-sm font-semibold mt-1">
                                                    Hutang: {debt.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
                                                </p>
                                            )}
                                        </div>
                                        {canEditCurrent && (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleEditCustomer(customer)} className="text-blue-500 hover:text-blue-700 p-1"><EditIcon /></button>
                                                <button onClick={() => handleDeleteCustomer(customer.name)} className="text-red-500 hover:text-red-700 p-1"><TrashIcon /></button>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>

                        {editingCustomer && canEditCurrent && (
                            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                                <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl border border-slate-100">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Edit Customer</h3>
                                        <button onClick={() => setEditingCustomer(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                            <XIcon className="w-5 h-5 text-slate-400" />
                                        </button>
                                    </div>
                                    <form onSubmit={handleUpdateCustomer} className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nama Customer</label>
                                            <input
                                                type="text"
                                                value={editCustomerForm.name}
                                                onChange={(e) => setEditCustomerForm({ ...editCustomerForm, name: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Alamat</label>
                                            <textarea
                                                value={editCustomerForm.address}
                                                onChange={(e) => setEditCustomerForm({ ...editCustomerForm, address: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 min-h-[100px]"
                                            />
                                        </div>
                                        <div className="pt-2 flex gap-3">
                                            <button type="button" onClick={() => setEditingCustomer(null)} className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all">Batal</button>
                                            <button type="submit" className="flex-[2] py-3.5 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">Simpan Perubahan</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'items':
                return (
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        {canEditCurrent && (
                            <form onSubmit={handleAddItem} className="flex gap-2 mb-4">
                                <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Tambah Nama Item Baru (Contoh: KARKAS)..." className="flex-grow block w-full px-3 py-2 border border-gray-300 rounded-md" required />
                                <button type="submit" className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                                    <PlusIcon /> Tambah Item
                                </button>
                            </form>
                        )}
                        <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto border rounded-md p-2">
                            {masterItems.map(item => (
                                <li key={item.name} className="py-2 px-2 flex justify-between items-center hover:bg-gray-50">
                                    <span className="text-gray-700 font-medium uppercase">{item.name}</span>
                                    {canEditCurrent && (
                                        <button onClick={() => handleDeleteItem(item.name)} className="text-red-500 hover:text-red-700 p-1"><TrashIcon /></button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            case 'backup':
                return <DatabaseBackup />;
            case 'users':
                return isSuperAdmin ? <UserManagementView currentUserName={currentUserName} userRole={userRole} /> : null;
        }
    }

    const activeTabLabel = tabs.find(t => t.id === activeView)?.label || 'Manajemen Basis Data';

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        <span>Basis Data</span>
                        <span>/</span>
                        <span className="text-slate-700">{activeTabLabel}</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tight">{activeTabLabel}</h2>
                </div>
                {isSuperAdmin && activeView !== 'users' && (
                    <button
                        onClick={() => setActiveView('users')}
                        className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm hover:bg-slate-800 active:scale-95 transition-all self-start sm:self-auto flex items-center gap-2"
                    >
                        <span>Buat Akun & Atur Hak Akses</span>
                    </button>
                )}
            </div>
            {renderContent()}
        </div>
    );
};
export default DatabaseManagement;