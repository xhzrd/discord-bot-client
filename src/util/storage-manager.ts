class LocalStorageManager {
    static set_item(key: string, value: unknown): void {
        try {
            const data = JSON.stringify(value);
            localStorage.setItem(key, data);
            window.dispatchEvent(new CustomEvent('localStorageUpdated', {
                detail: {
                    action: 'set',
                    key,
                    value
                }
            }));
        } catch (err) {
            console.error('Failed to set item in localStorage:', err);
        }
    }

    static get_item<T = unknown>(key: string): T | null {
        try {
            const data = localStorage.getItem(key);
            if (data === null) return null;
            return JSON.parse(data) as T;
        } catch (err) {
            console.error('Failed to get item from localStorage:', err);
            return null;
        }
    }

    static remove_item(key: string): void {
        try {
            localStorage.removeItem(key);
            window.dispatchEvent(new CustomEvent('localStorageUpdated', {
                detail: {
                    action: 'remove',
                    key
                }
            }));
        } catch (err) {
            console.error('Failed to remove item from localStorage:', err);
        }
    }

    static clear(): void {
        try {
            localStorage.clear();
            window.dispatchEvent(new CustomEvent('localStorageUpdated', {
                detail: {
                    action: 'clear'
                }
            }));
        } catch (err) {
            console.error('Failed to clear localStorage:', err);
        }
    }

    static has_key(key: string): boolean {
        return localStorage.getItem(key) !== null;
    }
}

export { LocalStorageManager };
