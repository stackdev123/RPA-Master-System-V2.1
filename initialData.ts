
import { ProductionRecord } from './types';
import { CHICKEN_PARTS } from './constants';

// Helper to create a record easily
const createRecord = (
    idSuffix: string,
    dateStr: string,
    truckNumber: number,
    coopName: string,
    driver: string,
    initialEkor: number,
    initialKg: number,
    mortality: number,
    items: { [key: string]: number }
): ProductionRecord => {
    const [day, month, year] = dateStr.split('/').map(Number);
    // Note: Month in JS Date is 0-indexed
    const date = new Date(year, month - 1, day, 8, 0, 0); 
    
    // Ensure all parts exist with 0 if not specified
    const fullItems: { [key: string]: number } = {};
    CHICKEN_PARTS.forEach(part => {
        fullItems[part] = items[part] || 0;
    });

    return {
        id: `INIT-${idSuffix}`,
        date: date,
        truckNumber,
        coopName,
        driver,
        driverName: driver,
        licensePlate: `Mobil ${truckNumber}`, // Generic based on PDF
        plateNumber: `Mobil ${truckNumber}`,
        initialEkor,
        initialKg,
        mortality,
        mortalityKg: 0, // Added to fix missing required field
        failedChickenCount: mortality,
        successChickenCount: initialEkor - mortality,
        estimatedChickenCount: initialEkor,
        pricePerKg: 21000, // Estimated average based on market
        items: fullItems
    };
};

export const INITIAL_PRODUCTION_DATA: ProductionRecord[] = [
    // Page 1: 18/10/2025 - EKI3
    createRecord('1', '18/10/2025', 1, 'EKI3', 'EGI', 1728, 4096, 0, {
        'KRK': 650, 'SAYAP A': 295, 'SAYAP R': 30, 'PALA': 225, 'CEKER': 110,
        'HATI AMPELA': 207, 'P.PENTUNG': 395, 'BLD': 1010, 'BLP ATAS': 380,
        'KULIT': 115, 'TLP i': 65, 'USUS': 110
    }),
    createRecord('2', '18/10/2025', 2, 'EKI3', 'UYAT', 1728, 4038, 0, {
        'KRK': 650, 'SAYAP A': 255, 'SAYAP R': 35, 'PALA': 210, 'CEKER': 95,
        'HATI AMPELA': 207, 'P.PENTUNG': 210, 'P.UTUH': 245, 'BLD': 975,
        'BLP LEBAR': 30, 'BLP ATAS': 195, 'BLP.K LEBAR': 85, 'KULIT': 115,
        'USUS': 100, 'TLP i': 35, 'TLP L': 75
    }),

    // Page 1: 19/10/2025 - YK
    createRecord('3', '19/10/2025', 2, 'YK', 'DADAN', 1728, 4090.6, 0, {
        'KRK': 675, 'SAYAP A': 265, 'SAYAP R': 40, 'PALA': 200, 'CEKER': 100,
        'HATI AMPELA': 206.16, 'P.UTUH': 715, 'BLD': 770, 'BLD.K': 200,
        'BLP LEBAR': 60, 'BLP.K LEBAR': 50, 'KULIT': 60, 'TLP L': 20, 'USUS': 95
    }),

    // Page 2: 21/10/2025 - ANJAWANI
    createRecord('4', '21/10/2025', 1, 'ANJAWANI', 'DADAN', 1768, 4167.5, 10, {
        'KRK': 675, 'SAYAP A': 260, 'SAYAP R': 35, 'PALA': 195, 'CEKER': 110,
        'HATI AMPELA': 211.56, 'P.PENTUNG': 490, 'BLD': 1020, 'BLP LEBAR': 10,
        'BLP ATAS': 355, 'KULIT': 110, 'TLP i': 50, 'TLP L': 55, 'USUS': 75
    }),
    
    // Page 2: 22/10/2025 - CPI 1
    createRecord('5', '22/10/2025', 1, 'CPI 1', 'EGI', 1628, 4055.7, 4, {
        'KRK': 670, 'SAYAP A': 280, 'SAYAP R': 35, 'PALA': 200, 'CEKER': 105,
        'HATI AMPELA': 195.6, 'P.PENTUNG': 410, 'BLD': 1010, 'BLP LEBAR': 5,
        'BLP ATAS': 370, 'KULIT': 120, 'USUS': 80, 'TLP i': 60
    }),

    // Page 3: 23/10/2025 - WIWIN WINART
    createRecord('6', '23/10/2025', 1, 'WIWIN WINART', 'EGI', 1628, 4090.3, 11, {
        'KRK': 615, 'SAYAP A': 245, 'SAYAP R': 35, 'PALA': 200, 'CEKER': 110,
        'HATI AMPELA': 195.12, 'P.PENTUNG': 405, 'BLD': 970, 'BLP ATAS': 345,
        'KULIT': 105, 'TLP i': 50, 'TLP L': 35, 'USUS': 75
    }),

    // Page 3: 24/10/2025 - ABDUL
    createRecord('7', '24/10/2025', 1, 'ABDUL', 'UCOK', 1628, 4344.8, 0, {
        'KRK': 655, 'SAYAP A': 295, 'SAYAP R': 20, 'PALA': 195, 'CEKER': 125,
        'HATI AMPELA': 192.24, 'P.PENTUNG': 440, 'BLD': 1030, 'BLP LEBAR': 5,
        'BLP ATAS': 395, 'KULIT': 95, 'USUS': 95, 'TLP i': 70
    }),

    // Page 4: 26/10/2025 - CIANJUR FARM
    createRecord('8', '26/10/2025', 1, 'CIANJUR FARM', 'UYAT', 1628, 4221.05, 1, {
        'KRK': 685, 'SAYAP A': 265, 'SAYAP R': 55, 'PALA': 215, 'CEKER': 110,
        'HATI AMPELA': 195, 'P.PENTUNG': 420, 'BLD': 1040, 'BLD.K': 60,
        'BLP LEBAR': 5, 'BLP ATAS': 335, 'KULIT': 90, 'USUS': 75, 'TLP i': 50, 'TLP L': 5
    }),

    // Page 5: 29/10/2025 - ANJAWANI
    createRecord('9', '29/10/2025', 1, 'ANJAWANI', 'AGIS', 1720, 4003.2, 1, {
        'KRK': 665, 'SAYAP A': 290, 'SAYAP R': 40, 'PALA': 200, 'CEKER': 120,
        'HATI AMPELA': 206.04, 'P.PENTUNG': 415, 'BLD': 1080, 'BLP ATAS': 390,
        'KULIT': 105, 'USUS': 120, 'TLP i': 45, 'AYAM TB': 199
    }),

    // Page 6: 31/10/2025 - INTERTAMA
    createRecord('10', '31/10/2025', 1, 'INTERTAMA', 'DADAN', 1451, 4000, 14, {
        'KRK': 630, 'SAYAP A': 260, 'SAYAP R': 35, 'PALA': 190, 'CEKER': 105,
        'HATI AMPELA': 172.44, 'P.PENTUNG': 330, 'BLD': 1015, 'BLP LEBAR': 5,
        'BLP ATAS': 380, 'KULIT': 110, 'USUS': 60, 'TLP i': 65, 'TLP L': 15
    }),

    // Page 8: 04/11/2025 - QL AGROFOOD
    createRecord('11', '04/11/2025', 2, 'QL AGROFOOD', 'AGUS', 1570, 4356.7, 12, {
        'KRK': 670, 'SAYAP A': 260, 'SAYAP R': 20, 'PALA': 215, 'CEKER': 90,
        'HATI AMPELA': 188.4, 'P.PENTUNG': 360, 'BLD': 1060, 'BLD.K': 50,
        'BLP LEBAR': 5, 'BLP ATAS': 360, 'KULIT': 120, 'USUS': 70, 'TLP i': 70,
        'AYAM TB': 133.2
    }),

    // Page 11: 09/11/2025 - INTERTAMA
    createRecord('12', '09/11/2025', 1, 'INTERTAMA', 'UCOK', 1470, 4130.6, 11, {
        'KRK': 650, 'SAYAP A': 255, 'SAYAP R': 15, 'PALA': 190, 'CEKER': 130,
        'HATI AMPELA': 176.4, 'P.PENTUNG': 370, 'P.ATAS': 120, 'BLD': 1045,
        'BLP ATAS': 330, 'KULIT': 125, 'USUS': 110
    }),

    // Page 12: 11/11/2025 - JAPFA
    createRecord('13', '11/11/2025', 1, 'JAPFA', 'AGUS', 1531, 3999.9, 0, {
        'KRK': 685, 'SAYAP A': 265, 'SAYAP R': 45, 'PALA': 190, 'CEKER': 110,
        'HATI AMPELA': 195, 'P.PENTUNG': 390, 'BLD': 970, 'BLP ATAS': 365,
        'KULIT': 105, 'USUS': 65, 'TLP i': 90
    }),
    
    // Page 13: 12/11/2025 - SARI
    createRecord('14', '12/11/2025', 2, 'SARI', 'UGING', 1525, 4294.3, 0, {
        'KRK': 735, 'SAYAP A': 295, 'SAYAP R': 15, 'PALA': 255, 'CEKER': 145,
        'HATI AMPELA': 183, 'P.PENTUNG': 440, 'BLD': 950, 'BLP LEBAR': 5,
        'BLP ATAS': 460, 'KULIT': 125, 'USUS': 75, 'TLP i': 75
    }),

    // Page 15: 15/11/2025 - ANJAWANI
    createRecord('15', '15/11/2025', 2, 'ANJAWANI', 'ADAM', 1619, 4000.9, 0, {
        'KRK': 705, 'SAYAP A': 145, 'SAYAP R': 20, 'PALA': 195, 'CEKER': 75,
        'HATI AMPELA': 185.52, 'P.PENTUNG': 150, 'P.UTUH': 15, 'BLD': 750,
        'BLD.K': 270, 'BLP LEBAR': 195, 'BLP ATAS': 135, 'BLP.K LEBAR': 195,
        'KULIT': 120, 'USUS': 70, 'TLP i': 120, 'TLP L': 185
    }),
    
    // Page 17: 18/11/2025 - ANJAWANI
    createRecord('16', '18/11/2025', 3, 'ANJAWANI', 'EGI', 1830, 4185.2, 0, {
         'KRK': 680, 'SAYAP A': 270, 'SAYAP R': 5, 'PALA': 200, 'CEKER': 110,
         'HATI AMPELA': 216.24, 'P.PENTUNG': 155, 'BLD': 730, 'BLD.K': 190,
         'BLP LEBAR': 375, 'BLP ATAS': 85, 'BLP.K LEBAR': 80, 'KULIT': 130,
         'USUS': 50, 'TLP i': 15, 'TLP L': 150
    }),

    // Page 17: 19/11/2025 - RABAS ATAS
    createRecord('17', '19/11/2025', 4, 'RABAS ATAS', 'UGING', 1484, 4003, 5, {
        'KRK': 680, 'SAYAP A': 235, 'SAYAP R': 30, 'PALA': 180, 'CEKER': 120,
        'HATI AMPELA': 177.6, 'BLD': 975, 'BLP LEBAR': 540, 'KULIT': 115,
        'USUS': 70, 'TLP L': 200
    })
];
