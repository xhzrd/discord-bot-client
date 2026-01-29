type Schema<T> = {
    [key: string]: T;
};

type safe_any = Promise<void> | void | string | number | object | undefined | null;

interface Route {
	path: string,
	type: 'POST' | 'GET' | 'DELETE' | 'PUT' | 'PATCH',
	run : (...args: any) => safe_any
}

export type {
	Route, safe_any, Schema
};

