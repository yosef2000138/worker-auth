export const isEmail = (value: string) => /\S+@\S+\.\S+/.test(value);
export const isStrongPassword = (value: string) => value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value);
export const isPhone = (value: string) => /^\+?[1-9]\d{7,14}$/.test(value);
