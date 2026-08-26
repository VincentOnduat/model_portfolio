import type { TableHTMLAttributes } from 'react';

/**
 * Wraps a `<table>` in a horizontally-scrolling container so wide tables
 * (many columns of account/order data) don't overflow the page on narrow
 * viewports - previously every page rendered a bare `<table>` with no such
 * wrapper. Header/row/cell styling stays inline at call sites, since it was
 * already consistent enough not to need its own primitives.
 */
export function Table({ className = '', ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${className}`} {...rest} />
    </div>
  );
}
