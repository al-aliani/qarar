const fs = require('fs');
const path = require('path');

const cssDir = path.join(__dirname, 'web', 'css');

const colorMap = [
    { regex: /rgba?\(\s*34\s*,\s*197\s*,\s*94\s*,\s*([0-9.]+)\s*\)/g, replacement: 'color-mix(in srgb, var(--c-success) calc($1 * 100%), transparent)' },
    { regex: /rgba?\(\s*239\s*,\s*68\s*,\s*68\s*,\s*([0-9.]+)\s*\)/g, replacement: 'color-mix(in srgb, var(--c-danger) calc($1 * 100%), transparent)' },
    { regex: /rgba?\(\s*59\s*,\s*130\s*,\s*246\s*,\s*([0-9.]+)\s*\)/g, replacement: 'color-mix(in srgb, var(--c-accent-blue) calc($1 * 100%), transparent)' },
    { regex: /rgba?\(\s*251\s*,\s*191\s*,\s*36\s*,\s*([0-9.]+)\s*\)/g, replacement: 'color-mix(in srgb, var(--c-warning) calc($1 * 100%), transparent)' },
    { regex: /rgba?\(\s*249\s*,\s*115\s*,\s*22\s*,\s*([0-9.]+)\s*\)/g, replacement: 'color-mix(in srgb, var(--c-warning) calc($1 * 100%), transparent)' },
    
    // Hex colors
    { regex: /#22c55e/gi, replacement: 'var(--c-success)' },
    { regex: /#ef4444/gi, replacement: 'var(--c-danger)' },
    { regex: /#f87171/gi, replacement: 'var(--c-danger)' },
    { regex: /#3b82f6/gi, replacement: 'var(--c-accent-blue)' },
    { regex: /#fbbf24/gi, replacement: 'var(--c-warning)' },
    { regex: /#f97316/gi, replacement: 'var(--c-warning)' },
    { regex: /#d4af37/gi, replacement: 'var(--c-gold-deco)' },
    { regex: /#6b7280/gi, replacement: 'var(--c-text-muted)' }
];

function processFile(filePath) {
    if (!filePath.endsWith('.css') || filePath.includes('variables.css')) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    for (const mapping of colorMap) {
        content = content.replace(mapping.regex, mapping.replacement);
    }
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated:', path.basename(filePath));
    }
}

fs.readdirSync(cssDir).forEach(file => {
    processFile(path.join(cssDir, file));
});
