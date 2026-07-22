/**
 * Storage Manager with IndexedDB Fallback
 * Handles localStorage with automatic fallback to IndexedDB for large data
 */

const STORAGE_DB_NAME = 'feasibility_storage';
const STORAGE_DB_VERSION = 1;
const STORAGE_STORE_NAME = 'data';

class StorageManager {
    constructor() {
        this.db = null;
        this.useIndexedDB = false;
        this.localStorageLimit = 5 * 1024 * 1024; // 5MB warning threshold
        this._init();
    }

    async _init() {
        // Check if IndexedDB is available (typeof-guarded: supabaseClient.js now imports
        // this module statically, so it must not crash when loaded in a non-browser test
        // environment where `window` itself is undefined, not just `indexedDB`).
        if (typeof window !== 'undefined' && 'indexedDB' in window) {
            try {
                this.db = await this._openDB();
                this.useIndexedDB = true;
                console.log('✅ IndexedDB initialized for large data storage');
            } catch (e) {
                console.warn('IndexedDB initialization failed, using localStorage only:', e);
            }
        }
    }

    _openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(STORAGE_DB_NAME, STORAGE_DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORAGE_STORE_NAME)) {
                    db.createObjectStore(STORAGE_STORE_NAME);
                }
            };
        });
    }

    /**
     * Get data size in bytes
     */
    _getSize(data) {
        return new Blob([typeof data === 'string' ? data : JSON.stringify(data)]).size;
    }

    /**
     * Check if data exceeds localStorage limit
     */
    _shouldUseIndexedDB(data) {
        const size = this._getSize(data);
        return size > this.localStorageLimit;
    }

    /**
     * Save data (auto-selects storage method)
     */
    async setItem(key, value) {
        const dataString = typeof value === 'string' ? value : JSON.stringify(value);
        const size = this._getSize(dataString);
        const sizeInMB = size / (1024 * 1024);

        // Warn if approaching limit
        if (sizeInMB > 4) {
            console.warn(`[Storage] Data size: ${sizeInMB.toFixed(2)}MB - Consider using IndexedDB`);
        }

        try {
            // Try localStorage first (faster for small data)
            if (!this._shouldUseIndexedDB(dataString)) {
                localStorage.setItem(key, dataString);
                // Also store in IndexedDB as backup
                if (this.db) {
                    await this._saveToIndexedDB(key, dataString);
                }
                return { success: true, method: 'localStorage', size: sizeInMB };
            } else {
                // Use IndexedDB for large data
                if (this.db) {
                    await this._saveToIndexedDB(key, dataString);
                    // Try to save a reference in localStorage
                    try {
                        localStorage.setItem(`${key}_ref`, 'indexeddb');
                    } catch (e) {
                        // localStorage might be full
                    }
                    return { success: true, method: 'indexedDB', size: sizeInMB };
                } else {
                    // Fallback: try localStorage anyway (might fail)
                    localStorage.setItem(key, dataString);
                    return { success: true, method: 'localStorage', size: sizeInMB, warning: 'Large data in localStorage' };
                }
            }
        } catch (e) {
            // localStorage quota exceeded - use IndexedDB
            if (e.name === 'QuotaExceededError' && this.db) {
                console.warn('localStorage quota exceeded, switching to IndexedDB');
                await this._saveToIndexedDB(key, dataString);
                return { success: true, method: 'indexedDB', size: sizeInMB, fallback: true };
            }
            throw e;
        }
    }

    /**
     * Get data (checks both storages)
     */
    async getItem(key) {
        // Check if reference exists in localStorage
        const ref = localStorage.getItem(`${key}_ref`);
        
        if (ref === 'indexeddb' && this.db) {
            // Data is in IndexedDB
            return await this._loadFromIndexedDB(key);
        }

        // Try localStorage first
        const localData = localStorage.getItem(key);
        if (localData !== null) {
            return localData;
        }

        // Fallback to IndexedDB
        if (this.db) {
            const indexedData = await this._loadFromIndexedDB(key);
            if (indexedData !== null) {
                return indexedData;
            }
        }

        return null;
    }

    /**
     * Remove data from both storages
     */
    async removeItem(key) {
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}_ref`);
        if (this.db) {
            await this._deleteFromIndexedDB(key);
        }
    }

    /**
     * Clear all data
     */
    async clear() {
        localStorage.clear();
        if (this.db) {
            const transaction = this.db.transaction([STORAGE_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORAGE_STORE_NAME);
            await store.clear();
        }
    }

    /**
     * Get storage usage info
     */
    async getStorageInfo() {
        let localStorageSize = 0;
        let indexedDBSize = 0;

        // Calculate localStorage size
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                localStorageSize += this._getSize(localStorage.getItem(key));
            }
        }

        // Calculate IndexedDB size (approximate)
        if (this.db) {
            const transaction = this.db.transaction([STORAGE_STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORAGE_STORE_NAME);
            const request = store.getAll();
            await new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    request.result.forEach(item => {
                        indexedDBSize += this._getSize(JSON.stringify(item));
                    });
                    resolve();
                };
                request.onerror = () => reject(request.error);
            });
        }

        return {
            localStorage: {
                used: localStorageSize,
                usedMB: (localStorageSize / (1024 * 1024)).toFixed(2),
                limit: '5-10MB (browser dependent)'
            },
            indexedDB: {
                used: indexedDBSize,
                usedMB: (indexedDBSize / (1024 * 1024)).toFixed(2),
                limit: '50% of disk space (browser dependent)'
            },
            total: {
                used: localStorageSize + indexedDBSize,
                usedMB: ((localStorageSize + indexedDBSize) / (1024 * 1024)).toFixed(2)
            }
        };
    }

    // IndexedDB helpers
    async _saveToIndexedDB(key, value) {
        const transaction = this.db.transaction([STORAGE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORAGE_STORE_NAME);
        return new Promise((resolve, reject) => {
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async _loadFromIndexedDB(key) {
        const transaction = this.db.transaction([STORAGE_STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORAGE_STORE_NAME);
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async _deleteFromIndexedDB(key) {
        const transaction = this.db.transaction([STORAGE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORAGE_STORE_NAME);
        return new Promise((resolve, reject) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Export singleton
export const storageManager = new StorageManager();
