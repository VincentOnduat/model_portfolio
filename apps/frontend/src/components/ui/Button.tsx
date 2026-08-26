import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'success';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 disabled:hover:bg-brand-500',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:hover:bg-white',
  danger: 'border border-red-300 text-red-600 hover:bg-red-50 disabled:hover:bg-white',
  success: 'bg-green-600 text-white hover:bg-green-700 disabled:hover:bg-green-600',
};

type Size = 'sm' | 'md';

const SIZE_CLASS: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner in place of the label and disables the button. */
  isLoading?: boolean;
  /** Label shown (with the spinner) while isLoading is true. Defaults to children. */
  loadingLabel?: string;
}

/**
 * Shared button component - consolidates the primary/secondary/danger button
 * styles that used to be hand-rolled (with drifting padding/colors) in every
 * page. `isLoading` standardizes in-flight feedback across mutations that
 * previously only disabled the button with no visual indication. Forwards
 * its ref so it can be used as the auto-focused button in ConfirmDialog.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', isLoading = false, loadingLabel, disabled, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    >
      {isLoading && <Spinner className="h-4 w-4" />}
      {isLoading ? (loadingLabel ?? children) : children}
    </button>
  );
});
