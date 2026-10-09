import React, { useState, useRef, useEffect } from 'react';
import { EyeIcon, EyeOffIcon } from './icons';

interface LoginProps {
    onLogin: (username: string, password: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [focusedField, setFocusedField] = useState<'username' | 'password' | null>('username');

    const usernameInputRef = useRef<HTMLInputElement>(null);
    const passwordInputRef = useRef<HTMLInputElement>(null);
    const submitBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        usernameInputRef.current?.focus();
    }, []);

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!username.trim()) {
            setError('Mohon masukkan username terlebih dahulu.');
            usernameInputRef.current?.focus();
            return;
        }
        if (!password) {
            setError('Mohon masukkan password terlebih dahulu.');
            passwordInputRef.current?.focus();
            return;
        }
        onLogin(username.trim(), password);
    };

    const handleUsernameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            passwordInputRef.current?.focus();
        }
    };

    const handlePasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            usernameInputRef.current?.focus();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            submitBtnRef.current?.focus();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleSubmitKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            passwordInputRef.current?.focus();
        }
    };

    return (
        <div className="min-h-screen w-full bg-white flex flex-col lg:flex-row selection:bg-red-100 selection:text-red-900">
            {/* Left Showcase Panel (Desktop) */}
            <div className="hidden lg:flex lg:w-[46%] xl:w-[50%] bg-slate-950 text-white p-12 xl:p-16 flex-col justify-between relative overflow-hidden">
                {/* Subtle architectural grid & ambient glow */}
                <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage:
                            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
                        backgroundSize: '48px 48px',
                    }}
                />
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-32 -right-20 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Top Brand Header */}
                <div className="relative z-10 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-white/95 p-1.5 flex items-center justify-center shadow-lg">
                        <img
                            src="/logo trial.png"
                            alt="Logo PT Mitra Karya Foodindo"
                            className="h-full w-auto object-contain"
                        />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white tracking-tight">
                            PT Mitra Karya Foodindo
                        </p>
                        <p className="text-xs text-slate-400">
                            RPA Master System
                        </p>
                    </div>
                </div>

                {/* Center Editorial Message */}
                <div className="relative z-10 max-w-md my-auto py-12">
                    <h1 className="text-3xl xl:text-4xl font-semibold tracking-tight text-white leading-[1.2]">
                        Sistem Manajemen Produksi, Inventaris & Distribusi Terpadu.
                    </h1>
                    <p className="mt-4 text-sm text-slate-400 leading-relaxed">
                        Kelola alur pemotongan, stok gudang real-time, surat jalan, hingga penagihan faktur dalam satu ruang kerja yang cepat dan terintegrasi.
                    </p>

                    <div className="mt-10 pt-8 border-t border-white/10 grid grid-cols-3 gap-6 text-left">
                        <div>
                            <p className="text-xs text-slate-400">Sinkronisasi</p>
                            <p className="mt-1 text-sm font-semibold text-white">Real-Time Cloud</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Mode Kerja</p>
                            <p className="mt-1 text-sm font-semibold text-white">Multi-Tab Workspace</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Proteksi Data</p>
                            <p className="mt-1 text-sm font-semibold text-white">Anti-Duplikasi</p>
                        </div>
                    </div>
                </div>

                {/* Bottom Copyright */}
                <div className="relative z-10 flex items-center justify-between text-xs text-slate-500">
                    <span>&copy; 2026 PT Mitra Karya Foodindo</span>
                    <span>Enterprise Portal</span>
                </div>
            </div>

            {/* Right Login Form Panel */}
            <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24 bg-white">
                <div className="w-full max-w-[400px] mx-auto">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex flex-col items-center text-center mb-8">
                        <img
                            src="/logo trial.png"
                            alt="Logo PT Mitra Karya Foodindo"
                            className="h-20 w-auto mb-3 drop-shadow-sm"
                        />
                        <p className="text-xs text-slate-500 font-medium">
                            PT Mitra Karya Foodindo · RPA Master System
                        </p>
                    </div>

                    {/* Heading */}
                    <div className="mb-8 text-center lg:text-left">
                        <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
                            Masuk ke Akun
                        </h2>
                        <p className="mt-2 text-sm text-slate-500">
                            Silakan masukkan kredensial Anda untuk melanjutkan.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                        {/* Seamless Stacked / Unified Input Fields */}
                        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 overflow-hidden transition-all duration-200 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.04)]">
                            {/* Username Field */}
                            <div
                                onClick={() => usernameInputRef.current?.focus()}
                                className={`relative px-4 pt-3.5 pb-3 transition-colors cursor-text border-b border-slate-200/80 ${
                                    focusedField === 'username'
                                        ? 'bg-white'
                                        : 'hover:bg-slate-50/90'
                                }`}
                            >
                                <div
                                    className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-200 ${
                                        focusedField === 'username' ? 'bg-red-600' : 'bg-transparent'
                                    }`}
                                />
                                <label
                                    htmlFor="username"
                                    className={`block text-[11px] font-semibold transition-colors ${
                                        focusedField === 'username' ? 'text-red-600' : 'text-slate-500'
                                    }`}
                                >
                                    Username
                                </label>
                                <input
                                    ref={usernameInputRef}
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    autoComplete="username"
                                    placeholder="Ketik username Anda..."
                                    value={username}
                                    onFocus={() => setFocusedField('username')}
                                    onBlur={() => setFocusedField((prev) => (prev === 'username' ? null : prev))}
                                    onKeyDown={handleUsernameKeyDown}
                                    onChange={(e) => {
                                        setUsername(e.target.value);
                                        if (error) setError('');
                                    }}
                                    className="mt-1 block w-full bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none text-sm font-medium"
                                />
                            </div>

                            {/* Password Field */}
                            <div
                                onClick={() => passwordInputRef.current?.focus()}
                                className={`relative px-4 pt-3.5 pb-3 transition-colors cursor-text ${
                                    focusedField === 'password'
                                        ? 'bg-white'
                                        : 'hover:bg-slate-50/90'
                                }`}
                            >
                                <div
                                    className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-200 ${
                                        focusedField === 'password' ? 'bg-red-600' : 'bg-transparent'
                                    }`}
                                />
                                <div className="flex items-center justify-between">
                                    <label
                                        htmlFor="password"
                                        className={`block text-[11px] font-semibold transition-colors ${
                                            focusedField === 'password' ? 'text-red-600' : 'text-slate-500'
                                        }`}
                                    >
                                        Password
                                    </label>
                                </div>
                                <div className="mt-1 flex items-center gap-2">
                                    <input
                                        ref={passwordInputRef}
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        autoComplete="current-password"
                                        placeholder="Masukkan password..."
                                        value={password}
                                        onFocus={() => setFocusedField('password')}
                                        onBlur={() => setFocusedField((prev) => (prev === 'password' ? null : prev))}
                                        onKeyDown={handlePasswordKeyDown}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            if (error) setError('');
                                        }}
                                        className="block w-full bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none text-sm font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowPassword(!showPassword);
                                            passwordInputRef.current?.focus();
                                        }}
                                        className="p-1 -mr-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors focus:outline-none"
                                        tabIndex={-1}
                                        title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                                    >
                                        {showPassword ? (
                                            <EyeOffIcon className="h-4 w-4" />
                                        ) : (
                                            <EyeIcon className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50/80 text-red-600 text-xs font-medium py-3 px-4 rounded-xl border border-red-100 flex items-center gap-2.5 animate-fade-in">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-600 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <div className="pt-1">
                            <button
                                ref={submitBtnRef}
                                type="submit"
                                onKeyDown={handleSubmitKeyDown}
                                className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-red-600 focus:bg-red-600 focus:outline-none focus:ring-4 focus:ring-red-500/15 transition-all duration-200 shadow-sm active:scale-[0.99]"
                            >
                                <span>Masuk ke Sistem</span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                                    />
                                </svg>
                            </button>
                        </div>

                        {/* Subtle Keyboard Navigation Guide */}
                        
                    </form>

                    {/* Mobile Copyright */}
                    <p className="lg:hidden mt-12 text-center text-xs text-slate-400">
                        &copy; 2026 PT Mitra Karya Foodindo. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
