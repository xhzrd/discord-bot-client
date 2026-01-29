type classable = string | undefined | null;
type yielded_classable = classable | classable[];
type arrow_class = () => classable;

const utility_groups: [RegExp, string][] = [
    [/^flex-(row|col)$/, 'flex'],
    // [/^flex$/, 'flex'],
    // [/^border(?:-\w+)?$/, 'border'],
	[/^text-(white|black|red-\d+|green-\d+|blue-\d+|yellow-\d+|gray-\d+|slate-\d+|zinc-\d+|neutral-\d+|stone-\d+|amber-\d+|orange-\d+|lime-\d+|emerald-\d+|teal-\d+|cyan-\d+|sky-\d+|indigo-\d+|violet-\d+|purple-\d+|fuchsia-\d+|pink-\d+|rose-\d+)$/, 'text-color'],
	[/^text-(left|center|right|justify)$/, 'text-align'],
	[/^text-(xs|sm|base|lg|xl|\d+xl)$/, 'text-size'],
	[/^text-[a-z-]+$/, 'text-misc'],    [/^bg-(.+)$/, 'bg'],
    [/^justify-(.+)$/, 'justify'],
    [/^rounded-(.+)$/, 'rounded'],
    [/^items-(.+)$/, 'items'],
    [/^content-(.+)$/, 'content'],
    [/^self-(.+)$/, 'self'],
    [/^place-(items|content|self)-(.+)$/, 'place'],
    [/^placeholder-(.+)$/, 'placeholder'],
];

function get_group_id(cls: string): string | null {
    for (const [regex, id] of utility_groups) {
        if (regex.test(cls)) return id;
    }
    return null;
}

function split_prefix_and_base(cls: string): { prefix: string, base: string } {
    const parts = cls.split(':');
    let base = parts.pop()!;
    const prefix = parts.join(':');
    return { prefix, base };
}

export function merge(...args: (yielded_classable | arrow_class)[]) {
    const raw = args
		.flat()
        .filter(Boolean)
        .map(arg =>
            typeof arg === 'function'
                ? arg()?.replace(/\s+/g, ' ').trim()
                : arg?.replace(/\s+/g, ' ').trim()
        )
        .join(' ')
        .trim();

    const classes = raw.split(/\s+/);
    const map = new Map<string, string>(); // key: `${prefix}|${group}`, value: class
    const passthrough: string[] = [];

    for (const cls of classes) {
        const { prefix, base } = split_prefix_and_base(cls);
        const group = get_group_id(base);

        if (group) {
            const key = `${prefix}|${group}`;
            map.set(key, `${prefix ? prefix + ':' : ''}${base}`);
        } else {
            passthrough.push(cls);
        }
    }

    return [...map.values(), ...passthrough].join(' ').trim();
}

export const ParentResponsiveSizeClass = merge(
	'w-full md:w-[97vw] lg:w-[98vw]',
	'flex flex-col gap-2 mx-auto'
);