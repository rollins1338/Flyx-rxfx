'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type DateRange = {
    startDate: Date | null;
    endDate: Date | null;
    period: 'day' | 'week' | 'month' | 'year' | 'custom';
};

interface AdminContextType {
    dateRange: DateRange;
    setDateRange: (range: DateRange) => void;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
    const [dateRange, setDateRange] = useState<DateRange>({
        startDate: null,
        endDate: null,
        period: 'week'
    });
    const [isLoading, setIsLoading] = useState(false);

    return (
        <AdminContext.Provider value={{ dateRange, setDateRange, isLoading, setIsLoading }}>
            {children}
        </AdminContext.Provider>
    );
}

export function useAdmin() {
    const context = useContext(AdminContext);
    if (context === undefined) {
        throw new Error('useAdmin must be used within an AdminProvider');
    }
    return context;
}
