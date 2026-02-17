import { ParsedPanResult } from './ocr.types';

export function parsePanText(lines: string[]): ParsedPanResult {
    let panNumber = '';
    let name = '';
    let dob = '';
    let fatherName = '';

    const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]/;
    const dobRegex = /\d{2}\/\d{2}\/\d{4}/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 1. PAN Number
        if (!panNumber) {
            const match = line.match(panRegex);
            if (match) {
                panNumber = match[0].toUpperCase();
            }
        }

        // 2. Date of Birth
        if (!dob) {
            const match = line.match(dobRegex);
            if (match) {
                dob = match[0];
            }
        }

        // 3. Name and Father's Name
        // Usually, on a PAN card, Name is below "Govt of India" and Father's Name is below Name.
        // We'll use some common markers or positional logic.
        if (line.toUpperCase().includes('NAME') && !line.toUpperCase().includes('FATHER')) {
            // If the line contains "NAME", the actual name might be the NEXT line
            if (i + 1 < lines.length && !lines[i + 1].toUpperCase().includes('FATHER')) {
                name = name || lines[i + 1].trim();
            }
        }
    }

    // Fallback positional logic if not found by keywords
    // Typically: 
    // Line 0: INCOME TAX DEPARTMENT
    // Line 1: GOVT. OF INDIA
    // Line 2: NAME
    // Line 3: FATHER'S NAME
    // Line 4: DOB

    if (!name && lines.length > 2) {
        // Basic check to avoid header lines
        const headerSkip = lines.slice(0, 3).findIndex(l => l.toUpperCase().includes('INDIA') || l.toUpperCase().includes('INCOME'));
        const startIdx = headerSkip !== -1 ? headerSkip + 1 : 2;
        name = lines[startIdx] || '';
        fatherName = lines[startIdx + 1] || '';
    }

    // Final cleanup: avoid common Noise
    const noise = ['GOVERNMENT', 'INDIA', 'INCOME', 'TAX', 'DEPARTMENT', 'CARD', 'PERMANENT', 'ACCOUNT'];
    if (noise.some(n => name.toUpperCase().includes(n))) name = '';
    if (noise.some(n => fatherName.toUpperCase().includes(n))) fatherName = '';

    return {
        panNumber,
        name: name || null,
        dob: dob || null,
        fatherName: fatherName || null
    };
}
