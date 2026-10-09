import React, { useState, useEffect } from 'react';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
    value: number | string;
    onChange: (value: string) => void;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onChange, className, ...props }) => {
    const [displayValue, setDisplayValue] = useState('');

    const formatNumber = (val: string) => {
        if (!val) return '';
        let numericVal = val.replace(/[^0-9.]/g, '');
        
        const parts = numericVal.split('.');
        if (parts.length > 2) {
            numericVal = parts[0] + '.' + parts.slice(1).join('');
        }

        const formattedParts = numericVal.split('.');
        formattedParts[0] = formattedParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return formattedParts.join('.');
    };

    useEffect(() => {
        if (value === '' || value === undefined || value === null) {
            setDisplayValue('');
        } else {
            const currentNumeric = displayValue.replace(/,/g, '');
            if (currentNumeric !== String(value)) {
                setDisplayValue(formatNumber(String(value)));
            }
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        val = val.replace(/[^0-9.]/g, '');
        
        const parts = val.split('.');
        if (parts.length > 2) {
            val = parts[0] + '.' + parts.slice(1).join('');
        }

        setDisplayValue(formatNumber(val));
        onChange(val);
    };

    return (
        <input
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={handleChange}
            className={className}
            {...props}
        />
    );
};

export default CurrencyInput;
