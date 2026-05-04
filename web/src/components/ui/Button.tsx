import { type ButtonHTMLAttributes, forwardRef } from 'react';

/**
 * Marketing-surface Button primitive.
 *
 * Mirrors the mobile app's IconButton/Pressable visual rhythm but
 * specialized for the web landing — pill-shaped, three variants
 * (primary coral CTA, outline ghost-CTA, no-chrome ghost), two
 * sizes. Server-render-friendly: no client-side state. Hover and
 * focus styles come from Tailwind utilities, no JS needed.
 *
 * Variant choice is informed by BRAND.md's color discipline —
 * `colors.brand` is reserved for buy-moment/action surfaces, so
 * `primary` uses it for marketing CTAs (Découvrir Mony Pro,
 * Télécharger l'app) while `outline` and `ghost` cover navigation
 * and secondary CTAs that shouldn't compete with the primary
 * action.
 */
type ButtonVariant = 'primary' | 'outline' | 'ghost';
type ButtonSize = 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-brand-text hover:bg-brand-pressed active:bg-brand-pressed',
  outline:
    'border border-border-strong text-text-primary hover:bg-surface-elevated',
  ghost: 'text-text-primary hover:bg-surface-elevated',
};

const sizeClasses: Record<ButtonSize, string> = {
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-8 py-3.5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  function Button(
    { variant = 'primary', size = 'md', className = '', children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
