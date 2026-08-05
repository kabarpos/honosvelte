export type ToastVariant = "success" | "error" | "info" | "warning";

export type Toast = {
	id: number;
	message: string;
	variant: ToastVariant;
	duration: number;
};

let toasts = $state<Toast[]>([]);
let nextId = 0;

export function toast(
	message: string,
	opts?: { variant?: ToastVariant; duration?: number },
): number {
	const id = nextId++;
	const item: Toast = {
		id,
		message,
		variant: opts?.variant ?? "info",
		duration: opts?.duration ?? 4000,
	};
	toasts = [...toasts, item];
	if (item.duration > 0) {
		setTimeout(() => dismiss(id), item.duration);
	}
	return id;
}

export function dismiss(id: number): void {
	toasts = toasts.filter((t) => t.id !== id);
}

export function clearToasts(): void {
	toasts = [];
}

export { toasts };
