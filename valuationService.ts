import { CHICKEN_PARTS } from './constants';
import type { Invoice, StockItem } from './types';

export const getAveragePrices = (invoices: Invoice[]) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const priceAggregator: { [key: string]: { sumPrices: number, count: number } } = {};
    
    invoices.forEach(inv => {
        const invDate = new Date(inv.date);
        if (invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear) {
            // Check if items exists (it should based on types, but safety first)
            const items = inv.items || [];
            items.forEach(item => {
                const normName = item.name.trim().toUpperCase();
                const price = Number(item.price) || 0;
                if (price > 0) {
                    if (!priceAggregator[normName]) priceAggregator[normName] = { sumPrices: 0, count: 0 };
                    priceAggregator[normName].sumPrices += price;
                    priceAggregator[normName].count += 1;
                }
            });
        }
    });

    const averagePrices: { [key: string]: number } = {};
    CHICKEN_PARTS.forEach(part => {
        const normName = part.trim().toUpperCase();
        const data = priceAggregator[normName];
        averagePrices[normName] = (data && data.count > 0) ? data.sumPrices / data.count : 22000;
    });

    return averagePrices;
};

export const calculateStockValuation = (invoices: Invoice[], stock: StockItem[]) => {
    const currentMonthAvgPrices = getAveragePrices(invoices);

    let totalEndValue = 0;
    const currentStockMap = new Map<string, number>(stock.map(s => [s.name.trim().toUpperCase(), s.quantity] as [string, number]));

    CHICKEN_PARTS.forEach(partName => {
        const normName = partName.trim().toUpperCase();
        const currentQty = currentStockMap.get(normName) || 0;
        const avgPrice = currentMonthAvgPrices[normName] || 22000;
        const endingValue = currentQty * avgPrice;
        totalEndValue += endingValue;
    });

    return totalEndValue;
};
