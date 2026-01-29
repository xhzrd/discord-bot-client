import glite from 'geoip-lite';
import os from 'os';
import type { Route } from '../exports/routes';

import { fetch } from 'bun';

const get_public_ip: () => Promise<{
	ip: string
} | null> = async () => {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
		return {
			ip: (data as {
				ip: string
			}).ip
		};
    } catch (error) {
        console.error('Error getting public IP:', error);
		return null;
    }
};

export default {
	path: '/',
	type: 'GET',
	run: async () => {
		// Get all memory usage stats
		const memoryStats = process.memoryUsage();
		
		// Convert bytes to MB
		const used_MB = (memoryStats.heapUsed / 1024 / 1024).toFixed(2);
		const total_MB = (memoryStats.heapTotal / 1024 / 1024).toFixed(2);
		const rss_MB = (memoryStats.rss / 1024 / 1024).toFixed(2);  // Total memory used by the process
		
		const interfaces = os.networkInterfaces();
		let local_ip = 'Unknown';

		for (const interfaceName in interfaces) {
			if (!interfaces || !interfaces[interfaceName]) continue;
			for (let i = 0; i < interfaces[interfaceName].length; i++) {
				const iface = interfaces[interfaceName][i] as {
					family: string
					address: string
					internal: boolean
				};
				if (iface.family.toLowerCase().includes('ipv4') && !iface.internal) {
					local_ip = iface.address;
					break;
				}
			}
		}

		const public_ip = await get_public_ip();

		const geo = glite.lookup(public_ip?.ip || '');
		const loc = geo ? geo.country.toLowerCase() : 'unknown';

		// Return stats
		return {
			status: 200,
			message: 'OK',

			version: 'v0.0.0b',

			fmwk: 'elysiajs-bun',
			runtime: 'bun',

			local_ip: local_ip,
			location: loc,

			heap: `${used_MB} MB / ${total_MB} MB`,
			rss: `${rss_MB} MB`  // Total memory used by the process
		};
	},
} as Route;