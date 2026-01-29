import { Button, Input } from '@headlessui/react';
import { Component, createRef, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Check, ChevronDown } from 'react-feather';
import { merge } from '../../util/class-merge';

type DeepKeys<T, _P extends string = ''> = T extends object
	? {
		[K in keyof T]: K extends string
			? `${_P}${K}` | DeepKeys<T[K], `${_P}${K}.`>
			: never;
	}[keyof T]
	: never;

type DeepValue<T, K extends any> = K extends `${infer P}.${infer R}`
	? P extends keyof T
		? DeepValue<T[P], R>
		: never
	: K extends keyof T
	? T[K]
	: never;

export type DropdownItemField = {
	key: string | number
	text: string
	icon: ReactNode
	itemClassName?: string
};

export type BlockingAsyncCompatiable 	   = Promise<void>   | void;
export type BlockingAsyncStringCompatiable = Promise<string> | string;
export type BlockingAsyncNumberCompatiable = Promise<number> | number;
export type TypesCompatiable = 
	BlockingAsyncCompatiable 	   | 
	BlockingAsyncStringCompatiable | 
	BlockingAsyncNumberCompatiable;

interface ComplexDropdownComponentProps {
	fields: DropdownItemField[],
	onSelect?: (field: DropdownItemField) => BlockingAsyncCompatiable
	onSelectClose?: boolean
	className?: string
	setValue?: string
	asInput?: boolean
	onInputChange?: (value: string) => TypesCompatiable
	debounceDelay?: number
}

function getSimilarity(a: string, b: string): number {
    const length = Math.max(a.length, b.length);
    if (length === 0) return 1;

    let matches = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] === b[i]) matches++;
    }

    return matches / length;
}

function matchCasing(input: string, suggestion: string): string {
    let result = '';
    let i = 0;

    for (; i < input.length && i < suggestion.length; i++) {
        const inputChar = input[i];
        const suggestionChar = suggestion[i];

        if (inputChar.toLowerCase() === suggestionChar.toLowerCase()) {
            result += inputChar === inputChar.toUpperCase()
                ? suggestionChar.toUpperCase()
                : suggestionChar.toLowerCase();
        } else {
            // If they don't match, just take suggestion as-is
            result += suggestionChar;
        }
    }

    // Add the rest of the suggestion untouched
    result += suggestion.slice(i);
    return result;
}

export class DropdownComponent extends Component<ComplexDropdownComponentProps> {
	state = {
		selected: this.props.setValue ? 
			this.props.fields.findIndex(i => i.key == this.props.setValue) :
		null as number | null,
		isOpen: false,
		inputValue: this.props.setValue ? 
			this.props.fields.find(i => i.key == this.props.setValue)?.text : 
		null as string | null,
	};

	DropdownButton: RefObject<HTMLDivElement | null> = createRef();
	DropdownList: RefObject<HTMLDivElement | null> = createRef();
	DropdownInput: RefObject<HTMLInputElement | null> = createRef();

	Debouncer: number = -1;
	LastDebouncedValue: string = '';

	constructor(props: ComplexDropdownComponentProps) {
		super(props);
	}

	setTypedState<K extends DeepKeys<typeof this.state>>(key: K, value: Partial<DeepValue<typeof this.state, K>>) {
		this.setState((prevState) => {
			const keys = (typeof key == 'string' ? key : '').split('.') as string[];
			let newState: any = structuredClone(prevState);

			let current: any = newState;
			for (let i = 0; i < keys.length - 1; i++) {
				current[keys[i]] = { ...current[keys[i]] };
				current = current[keys[i]];
			}
			current[keys[keys.length - 1]] = value;

			return newState;
		});
	}

	handleTextInput(value: string) {
		if (value.trim().replace(/\s+/g, '').length <= 0) {
			this.setTypedState('inputValue', null);
			this.setTypedState('isOpen', false);

			return;
		}
		
		this.setTypedState('inputValue', value);
		!this.state.isOpen && this.setTypedState('isOpen', true); 

		this.props.onInputChange ? (() => {
			clearInterval(this.Debouncer);
			this.Debouncer = setTimeout(() => {
				const tvalue = value.trim();
				if (tvalue == this.LastDebouncedValue) return;

				this.LastDebouncedValue = tvalue;
				this.props.onInputChange?.(tvalue);
			}, this.props.debounceDelay || 200); // 200ms as default debouncing delay for the input
		})() : null;

		return;
	}

	handleKeyUp(kbd: KeyboardEvent<HTMLInputElement>) {
		const key = kbd.key.toLowerCase();
		const input = kbd.currentTarget.value.toLowerCase();
		if (!input) return;

		this.DropdownInput.current?.focus();
	
		const fields = this.props.fields;
	
		// 1. Try exact match
		const exact_field = fields.find(field =>
			field.text.toLowerCase() === input
		);
		const exact_index = fields.findIndex(field =>
			field.text.toLowerCase() === input
		);
	
		if (exact_index !== -1) {
			this.setTypedState('selected', exact_index);
			if (key == 'enter') {
				this.setTypedState('inputValue', exact_field?.text as string);
				this.setTypedState('isOpen', false);
			}
			return;
		}
	
		// 2. Try fuzzy matching (80%+ similarity)
		const fuzzy_matches = fields
			.map((field, index) => ({
				index,
				similarity: getSimilarity(input, field.text.toLowerCase())
			}))
			.filter(match => match.similarity >= 0.6);
	
		if (fuzzy_matches.length === 1) {
			this.setTypedState('selected', fuzzy_matches[0].index);
			if (key == 'enter') {
				this.setTypedState('inputValue', this.props.fields[fuzzy_matches[0].index].text as string);
			}
		}
	}

	private isCtrlBackspace = false;
	handleKeyDown = (kbd: KeyboardEvent<HTMLInputElement>) => {
		this.isCtrlBackspace = kbd.key === 'Backspace' ? kbd.ctrlKey || kbd.metaKey : false;
	};

	handleInput = (e: FormEvent<HTMLInputElement>) => {
		const value = e.currentTarget.value;
	
		// Skip clearing logic if ctrl+backspace was pressed
		if (this.isCtrlBackspace) {
			// Get cursor position
			const input = e.currentTarget;
			const cursor = input.selectionStart || 0;
	
			// Get the part before cursor (what ctrl+backspace would nuke)
			const left_side = value.slice(0, cursor);
			const words = left_side.trim().split(/\s+/);
	
			// Simulate post-deletion value
			let predicted = value;
	
			if (words.length > 0) {
				const last_word = words[words.length - 1];
				predicted = value.slice(0, cursor - last_word.length) + value.slice(cursor);
			}
	
			if (predicted.trim().length <= 1) {
				this.setTypedState('selected', null);
				this.setTypedState('inputValue', null);
			}
			
			this.isCtrlBackspace = false;
		}
	
		if (value.length <= 1) {
			this.setTypedState('selected', null);
			this.setTypedState('inputValue', null);
		}
	};
	
	render() {
		const field = this.state.selected != null ? this.props.fields[this.state.selected] : null;

		return (
			<div className={merge(
				'relative',
				this.props.className,
			)}>
				<div ref={this.DropdownButton} className={merge(
					'inline-flex gap-2 bg-white',
					'items-center justify-between gap-2 p-2 px-4 rounded-lg z-20',
					'border border-neutral-300 w-full flex-1 cursor-pointer'
				)} onClick={() => !this.props.asInput && this.setTypedState('isOpen', !this.state.isOpen)}>
					{
						this.props.asInput ? <span className='inline-flex select-none items-center w-[80%] h-max gap-2 transition-all'>
						<>
							{ field ? field.icon : null }
							<span className='relative inline-flex items-center min-w-max w-full h-max'>
								<Input className='bg-transparent text-transparent p-0.5 opacity-0 outline-none border-none w-full max-w-full select-none font-medium'/>
								<Input
									placeholder='Start typing to get the options.'
									onBlur={() => field?.text && this.setTypedState('inputValue', field?.text)} 
									onKeyUp={(kbd) => this.handleKeyUp(kbd)} onChange={(e) =>
										this.handleTextInput(e.currentTarget.value)
									} 
									onKeyDown={(kbd) => this.handleKeyDown(kbd)}
									onInput={(input) => this.handleInput(input)}									
									value={this.state.inputValue || field?.text || ''} 
									ref={this.DropdownInput} 
									className='absolute z-10 bg-transparent text-gray-800 p-0.5 outline-none border-none w-full max-w-full select-none font-medium'
								/>
								<Input value={
									field?.text.toLowerCase().startsWith((this.state.inputValue || '').toLowerCase()) ?
										matchCasing(this.state.inputValue || '', field?.text || '') || ''
									: ''
								} className='absolute pointer-events-none bg-transparent text-neutral-500 p-0.5 outline-none border-none w-full max-w-full select-none font-medium'/>
							</span>
						</>
						</span> : <span className='inline-flex select-none items-center w-max h-max gap-2 transition-all'>
						{
							field ? <>
								{ field.icon }
								<p className='select-none font-medium'>{ field.text }</p>
							</> : <p className='opacity-50 font-medium'>None</p>
						}
					</span>
					}
					<ChevronDown className={merge(
						'opacity-80 transition-all ease-in duration-200',
						this.state.isOpen ? 'rotate-180' : ''
					)} size={18}/>
				</div>

				<div ref={this.DropdownList} className={merge(
					'flex flex-col gap-2 absolute top-12 p-1 pr-2',
					'w-full flex-1 bg-[rgb(253,253,253)] transition-all duration-300 ease-in-out',
					'border rounded-lg overflow-y-auto origin-top',
					this.state.isOpen 
						? 'translate-y-0 border-neutral-200 opacity-100 scale-y-100 max-h-[50vh] pointer-events-auto z-10'
						: '-translate-y-12 opacity-0 scale-y-0 max-h-0 pointer-events-none z-0'
				)}>
					{
						( !this.props.asInput ?
							this.props.fields :
							this.state.inputValue ?
								this.state.inputValue.length > 0 ? this.props.fields.filter(field => 
									field.text.toLowerCase().startsWith((this.state.inputValue as string)
										.toLowerCase()
									)
								)
							: []
							: []
						).map((field, id) => {
							const fid = this.props.fields.findIndex(i => i.key == field.key);

							return (
								<Button onClick={() => {
									this.setTypedState('selected', fid);
									this.props.onSelectClose ? this.setTypedState('isOpen', !this.state.isOpen) : null;
									
									this.props.onSelect?.(field);
									this.setTypedState('inputValue', field.text);
								}} className={merge(
									'inline-flex gap-2 items-center justify-between min-w-full min-h-10',
									'p-2 px-3 rounded-lg transition-all ease-in',

									this.state.selected == fid ? field.itemClassName : 'hover:bg-black/5'
								)} key={id}>
									<span className='inline-flex gap-2 items-center'>
										{ field.icon }
										<p className='select-none font-medium'>{ field.text }</p>
									</span>
									<Check size={24} className={merge(
										this.state.selected == fid ? 'opacity-100' : 'opacity-0',
										field.itemClassName,
										'p-1 rounded-lg transition-all ease-in duration-150'
									)}/>
								</Button>
							)
						})
					}
				</div>
			</div>
		);
	}
}