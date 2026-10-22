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
        <div className="min-h-screen w-full bg-slate-50 flex flex-col justify-center items-center px-4 py-12 selection:bg-red-100 selection:text-red-900">
            <div className="w-full max-w-[420px]">
                {/* Centered Clean Login Card */}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.08)] p-8 sm:p-10">
                    {/* Brand Logo & Company Name */}
                    <div className="flex flex-col items-center text-center mb-7">
                        <img
                            src="/logo trial.png"
                            alt="Logo PT Mitra Karya Chicken"
                            className="h-16 w-auto mb-3 object-contain"
                        />
                        <p className="text-sm font-semibold text-slate-900 tracking-tight">
                            PT Mitra Karya Chicken
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            RPA Master System
                        </p>
                    </div>

                    {/* Heading */}
                    <div className="mb-6 text-center">
                        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
                            Masuk ke Akun
                        </h1>
                        <p className="mt-1.5 text-sm text-slate-500">
                            Silakan masukkan kredensial Anda untuk melanjutkan.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                        {/* Seamless Stacked Input Fields */}
                        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 overflow-hidden transition-all duration-200">
                            {/* Username Field */}
                            <div
                                onClick={() => usernameInputRef.current?.focus()}
                                className={`relative px-4 pt-3.5 pb-3 transition-colors cursor-text border-b border-slate-200/80 ${
                                    focusedField === 'username'
                                        ? 'bg-white'
                                        : 'hover:bg-slate-50/90'
                                }`}
                            >
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
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <div className="pt-1">
                            <button
                                ref={submitBtnRef}
                                type="submit"
                                onKeyDown={handleSubmitKeyDown}
                                className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-red-600 focus:bg-red-600 focus:outline-none focus:ring-4 focus:ring-red-500/15 transition-all duration-200 shadow-sm active:scale-[0.99] whitespace-nowrap"
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
                    </form>
                </div>

                {/* Copyright */}
                <p className="mt-6 text-center text-xs text-slate-400">
                    &copy; 2026 PT Mitra Karya Chicken. All rights reserved.
                </p>
            </div>
        </div>
    );
};

export default Login;
