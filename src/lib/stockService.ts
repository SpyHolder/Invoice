import { api } from './api';

export async function processSOConfirmation(soId: string) {
    return await api.post<any>(`/stock/process-so/${soId}`, {});
}

export async function restoreStockForSO(soId: string) {
    return await api.post<any>(`/stock/restore-so/${soId}`, {});
}

export async function getBacklogItems() {
    return await api.get<any[]>('/stock/backlog');
}

export async function markBacklogItemsOrdered(_itemIds: string[]): Promise<boolean> {
    return true;
}

export async function increaseStockForPO(poId: string) {
    return await api.post<any>(`/stock/increase-po/${poId}`, {});
}

export async function checkPhysicalStockForDO(doItems: any[]) {
    return await api.post<any>('/stock/check-do', { items: doItems });
}
