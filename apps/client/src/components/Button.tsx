import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

/** `.btn` variants from DESIGN_SPEC §0 Components. Coloured fills use dark text (`.dark`). */
export type ButtonVariant = 'default' | 'primary' | 'success' | 'info' | 'danger';

const FILL: Record<ButtonVariant, string | undefined> = {
  default: undefined,
  primary: '#FFD166',
  success: '#5ACB91',
  info: '#4C9AFF',
  danger: '#3A2230',
};
const DARK_TEXT: Record<ButtonVariant, boolean> = { default: false, primary: true, success: true, info: true, danger: false };

export function buttonClass(variant: ButtonVariant = 'default', extra?: string): string {
  return ['btn', DARK_TEXT[variant] ? 'dark' : '', extra ?? ''].filter(Boolean).join(' ');
}

export function buttonStyle(variant: ButtonVariant = 'default', style?: CSSProperties): CSSProperties {
  const fill = FILL[variant];
  return fill ? { background: fill, ...style } : { ...style };
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', className, style, type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, className)} style={buttonStyle(variant, style)} {...rest} />;
});

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
}

/** A `.btn` that navigates (react-router Link). */
export function ButtonLink({ variant = 'default', className, style, ...rest }: ButtonLinkProps): JSX.Element {
  return <Link className={buttonClass(variant, className)} style={buttonStyle(variant, style)} {...rest} />;
}
