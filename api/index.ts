import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { readdirSync } from 'fs';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { join } from 'path';
import type { Route } from './exports/routes';
import './ws-server'; // boot live server in parallel

export const DB_SERVER_LINK = process.env.DB_SERVER_LINK || 'http://localhost:4000';
export const app = 
	new Elysia()
	.use(cors({
		origin: '*'
	}));

const production: boolean = process.env.IS_PRODUCTION == 'true' ? true : false;
app.onRequest(async ({ error, request }) => {
	// Check if authorization header matches the expected token in production
	if (
		production &&
		!request.url.endsWith('/') &&
		request.headers.get('Authorization') !== `Bearer-Meta ${process.env.STATIC_TEMP_AUTH_TOKEN}`
	)
		return error(
			'Unauthorized',
			{
				status: StatusCodes.UNAUTHORIZED,
				reason: 'You need an authorization token before continuing with any request through this API. If you think this is a mistake, please contact the administrator of this server.',
				message: ReasonPhrases.UNAUTHORIZED,
			}
		);
});

const routes_directory: string = join(__dirname, '/routes/');
console.clear();

for (const entity of readdirSync(routes_directory, { recursive: true })) {
    if (!entity) continue;

    const stringified_entity: string = entity.toString();
    if (!stringified_entity.endsWith('.ts')) continue;

    const entity_module: Route | undefined = (await import(join(routes_directory, stringified_entity))).default;
    if (!entity_module) continue;

    const { path, type, run } = entity_module;

    switch (type) {
        case 'GET':
			app.get(path, run);

            console.log(`[${new Date().toISOString()}] > ADDED [${type}] > ROUTE >`, path);
            break;

        case 'POST':
			app.post(path, run);

            console.log(`[${new Date().toISOString()}] > ADDED [${type}] > ROUTE >`, path);
            break;

		case 'PUT':
			app.put(path, run);

			console.log(`[${new Date().toISOString()}] > ADDED [${type}] > ROUTE >`, path);
			break;

		case 'PATCH':
			app.patch(path, run);

			console.log(`[${new Date().toISOString()}] > ADDED [${type}] > ROUTE >`, path);
			break;

        case 'DELETE':
				app.delete(path, run);

            console.log(`[${new Date().toISOString()}] > ADDED [${type}] > ROUTE >`, path);
            break;

        default:
            console.warn(`Unknown route type: ${type}`);
            break;
    }
}

export default app;