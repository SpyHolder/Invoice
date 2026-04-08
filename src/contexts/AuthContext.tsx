import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

interface User {
    id: string;
    email: string;
    full_name?: string;
    company_name?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string, fullName: string, companyName: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check active session on load
        const checkSession = async () => {
            const token = localStorage.getItem('invoice_ppc_token');
            if (token) {
                try {
                    const res = await api.get<any>('/auth/me');
                    const profile = res.user;
                    setUser({
                        id: profile.id,
                        email: profile.email,
                        full_name: profile.full_name,
                        company_name: profile.company_name
                    });
                } catch (error) {
                    console.error('Error checking session:', error);
                    localStorage.removeItem('invoice_ppc_token');
                }
            }
            setLoading(false);
        };

        checkSession();
    }, []);

    const signIn = async (email: string, password: string) => {
        try {
            const res = await api.post<{token: string, user: any}>('/auth/login', { email, password });
            localStorage.setItem('invoice_ppc_token', res.token);
            setUser({
                id: res.user.id,
                email: res.user.email,
                full_name: res.user.full_name,
                company_name: res.user.company_name
            });
            return { error: null };
        } catch (error: any) {
             return { error: new Error(error.message || 'Login failed') };
        }
    };

    const signUp = async (email: string, password: string, fullName: string, companyName: string) => {
        try {
            await api.post('/auth/register', { email, password, fullName, companyName });
            return { error: null };
        } catch (error: any) {
            return { error: new Error(error.message || 'Registration failed') };
        }
    };

    const signOut = async () => {
        localStorage.removeItem('invoice_ppc_token');
        setUser(null);
    };

    const value = {
        user,
        loading,
        signIn,
        signUp,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
