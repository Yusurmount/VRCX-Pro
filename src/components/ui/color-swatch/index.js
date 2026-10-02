import { cva } from 'class-variance-authority';

export { default as ColorSwatch } from './ColorSwatch.vue';

export const colorSwatchVariants = cva(
    'shrink-0 cursor-pointer border border-border shadow-xs transition-transform outline-none hover:scale-110 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    {
        variants: {
            size: {
                sm: 'size-4 rounded-sm',
                default: 'size-6 rounded-md'
            }
        },
        defaultVariants: {
            size: 'default'
        }
    }
);
