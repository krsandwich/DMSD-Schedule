import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark' | 'gray';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
  secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  ghost: 'text-gray-600 hover:bg-gray-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  dark: 'bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-500',
  gray: 'bg-gray-300 text-gray-800 hover:bg-gray-400 disabled:bg-gray-100 disabled:text-gray-400',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
