const fs = require('fs');
let code = fs.readFileSync('constants.ts', 'utf8');

code = code.replace(/export const INITIAL_STOCK_OCT_18: \{ \[key: string\]: number \} = \{[\s\S]*?\};/m, 
`export const INITIAL_STOCK_OCT_18: { [key: string]: number } = {
    'KRK': 0,
    'SAYAP A': 0,
    'SAYAP R': 0,
    'PALA': 0,
    'CEKER': 0,
    'HATI AMPELA': 0,
    'P.PENTUNG': 0,
    'P.UTUH': 0,
    'P.ATAS': 0,
    'BLD': 0,
    'BLD.K': 0,
    'BLP LEBAR': 0,
    'BLP ATAS': 0,
    'BLP.K LEBAR': 0,
    'BLPK ATAS': 0,
    'KULIT': 0,
    'USUS': 0,
    'TLP I': 0,
    'TLP L': 0,
    'KARKAS': 0,
    'AYAM PC': 0,
    'AYAM TB': 0,
    'TUNGGIR': 0
};`);

code = code.replace(/export const INITIAL_VALUATION_OCT_18 = \d+;/, 'export const INITIAL_VALUATION_OCT_18 = 0;');

fs.writeFileSync('constants.ts', code);
