export class CookiesManager {
    // Set cookie with any value (string, number, object) — objects get JSON.stringified
    static set_cookie(name: string, value: any, days = 7): void {
        let cookie_value: string
        if (typeof value === 'object') {
            try {
                cookie_value = JSON.stringify(value)
            } catch {
                throw new Error('Failed to stringify cookie value')
            }
        } else {
            cookie_value = String(value)
        }
        const expires = new Date(Date.now() + days * 864e5).toUTCString()
        document.cookie = `${name}=${encodeURIComponent(cookie_value)}; expires=${expires}; path=/`
    }

    // Get cookie and try to parse JSON, fallback to string
    static get_cookie<T = any>(name: string): T | string | null {
        const cookies = document.cookie.split('; ')
        for (const cookie of cookies) {
            const [key, val] = cookie.split('=')
            if (key === name) {
                const decoded = decodeURIComponent(val)
                try {
                    return JSON.parse(decoded) as T
                } catch {
                    return decoded
                }
            }
        }
        return null
    }

    static delete_cookie(name: string): void {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    }

	static clear_all_cookies(): void {
		const cookies = document.cookie.split('; ')
		for (const cookie of cookies) {
			const [name] = cookie.split('=')
			document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
		}
	}
}