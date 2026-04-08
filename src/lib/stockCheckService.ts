import { api } from './api';

export async function checkStockAndCreatePO(soId: string, soNumber: string) {
    // The backend signature for this is checkStockAndCreatePO(soId, soNumber, vendorId)
    // and returns { checked, poCreated, poNumber, shortfallItems }
    return await api.post<any>(`/stock/check-so/${soId}`, { soNumber });
}
