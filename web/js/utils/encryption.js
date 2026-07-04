/**
 * Encryption Utility for Sensitive Data
 * Uses Web Crypto API (built-in, no dependencies)
 * Encrypts sensitive financial data before storing in localStorage
 */

class EncryptionService {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
        this.ivLength = 12; // 96 bits for GCM
        this._cryptoKey = null;
    }

    /**
     * Generate or retrieve encryption key
     * Uses a deterministic key derived from user's session (if available)
     * Falls back to a device-specific key stored in sessionStorage
     */
    async getKey() {
        if (this._cryptoKey) return this._cryptoKey;

        try {
            // Try to get existing key from sessionStorage
            const keyData = sessionStorage.getItem('_enc_key');
            if (keyData) {
                const keyBuffer = Uint8Array.from(JSON.parse(keyData));
                this._cryptoKey = await crypto.subtle.importKey(
                    'raw',
                    keyBuffer,
                    { name: this.algorithm },
                    false,
                    ['encrypt', 'decrypt']
                );
                return this._cryptoKey;
            }

            // Generate new key
            const key = await crypto.subtle.generateKey(
                {
                    name: this.algorithm,
                    length: this.keyLength
                },
                true, // extractable
                ['encrypt', 'decrypt']
            );

            // Export and store in sessionStorage (cleared on tab close)
            const exported = await crypto.subtle.exportKey('raw', key);
            sessionStorage.setItem('_enc_key', JSON.stringify(Array.from(new Uint8Array(exported))));

            this._cryptoKey = key;
            return key;
        } catch (e) {
            console.error('Encryption key generation failed:', e);
            // Fallback: return null to disable encryption gracefully
            return null;
        }
    }

    /**
     * Encrypt sensitive data
     * @param {string} plaintext - Data to encrypt
     * @returns {Promise<string>} Base64-encoded encrypted data with IV
     */
    async encrypt(plaintext) {
        if (!plaintext) return plaintext;

        try {
            const key = await this.getKey();
            if (!key) {
                if (typeof console !== 'undefined' && console.debug) console.debug('Encryption disabled, storing plaintext');
                return plaintext;
            }

            const encoder = new TextEncoder();
            const data = encoder.encode(plaintext);

            // Generate random IV
            const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));

            // Encrypt
            const encrypted = await crypto.subtle.encrypt(
                {
                    name: this.algorithm,
                    iv: iv
                },
                key,
                data
            );

            // Combine IV + encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);

            // Convert to base64 for storage
            return btoa(String.fromCharCode(...combined));
        } catch (e) {
            console.error('Encryption failed:', e);
            // Graceful fallback: return plaintext
            return plaintext;
        }
    }

    /**
     * Decrypt sensitive data
     * @param {string} ciphertext - Base64-encoded encrypted data with IV
     * @returns {Promise<string>} Decrypted plaintext
     */
    async decrypt(ciphertext) {
        if (!ciphertext) return ciphertext;

        // Check if data is encrypted (base64 format)
        try {
            const key = await this.getKey();
            if (!key) {
                // If encryption is disabled, return as-is
                return ciphertext;
            }

            // Decode base64
            const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

            // Extract IV and encrypted data
            const iv = combined.slice(0, this.ivLength);
            const encrypted = combined.slice(this.ivLength);

            // Decrypt
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: this.algorithm,
                    iv: iv
                },
                key,
                encrypted
            );

            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (e) {
            // If decryption fails, likely plaintext (legacy data or encryption disabled). Silent fallback.
            if (typeof console !== 'undefined' && console.debug) {
                console.debug('Decryption skipped, using plaintext (legacy/unencrypted):', e?.name ?? 'OperationError');
            }
            return ciphertext;
        }
    }

    /**
     * Encrypt sensitive fields in an object
     * Only encrypts fields marked as sensitive
     */
    async encryptSensitiveFields(obj, sensitiveFields = []) {
        if (!obj || typeof obj !== 'object') return obj;

        const encrypted = JSON.parse(JSON.stringify(obj)); // Deep clone

        for (const field of sensitiveFields) {
            const keys = field.split('.');
            let target = encrypted;
            let parent = null;
            let lastKey = keys[keys.length - 1];

            // Navigate to the field
            for (let i = 0; i < keys.length - 1; i++) {
                if (!target[keys[i]]) return encrypted; // Field doesn't exist
                parent = target;
                target = target[keys[i]];
            }

            // Encrypt the value
            if (target[lastKey] !== undefined && target[lastKey] !== null) {
                if (typeof target[lastKey] === 'object') {
                    // Encrypt JSON stringified object
                    target[lastKey] = await this.encrypt(JSON.stringify(target[lastKey]));
                } else {
                    target[lastKey] = await this.encrypt(String(target[lastKey]));
                }
            }
        }

        return encrypted;
    }

    /**
     * Decrypt sensitive fields in an object
     */
    async decryptSensitiveFields(obj, sensitiveFields = []) {
        if (!obj || typeof obj !== 'object') return obj;

        const decrypted = JSON.parse(JSON.stringify(obj)); // Deep clone

        for (const field of sensitiveFields) {
            const keys = field.split('.');
            let target = decrypted;
            let lastKey = keys[keys.length - 1];

            // Navigate to the field
            for (let i = 0; i < keys.length - 1; i++) {
                if (!target[keys[i]]) return decrypted; // Field doesn't exist
                target = target[keys[i]];
            }

            // Decrypt the value (only strings can be encrypted payloads —
            // arrays/objects here mean the field was saved plaintext; leave untouched)
            if (typeof target[lastKey] === 'string') {
                try {
                    const decryptedValue = await this.decrypt(target[lastKey]);
                    // Try to parse as JSON, fallback to string
                    try {
                        target[lastKey] = JSON.parse(decryptedValue);
                    } catch {
                        target[lastKey] = decryptedValue;
                    }
                } catch (e) {
                    console.warn(`Failed to decrypt field ${field}:`, e);
                }
            }
        }

        return decrypted;
    }
}

// Export singleton instance
export const encryptionService = new EncryptionService();

// Sensitive fields that should be encrypted
export const SENSITIVE_FIELDS = [
    'financing.sources.bankLoan.amount',
    'financing.sources.bankLoan.interestRate',
    'financing.sources.equity.amount',
    'financing.sources.investors.amount',
    'revenue.streams', // Revenue data
    'hr.positions', // Salary data
    'assumptions.discountRate',
    'assumptions.taxRate'
];
