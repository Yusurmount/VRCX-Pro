import { cva } from 'class-variance-authority';

export { default as Panel } from './Panel.vue';

export const panelVariants = cva('min-w-0 rounded-xl', {
    variants: {
        variant: {
            default: 'border bg-card text-card-foreground shadow-xs',
            muted: 'bg-muted/80 text-foreground',
            outline: 'border border-border bg-background text-foreground',
            subtle: 'border border-border bg-muted/30 text-foreground'
        },
        padding: {
            none: '',
            sm: 'p-2',
            md: 'p-3',
            lg: 'p-4',
            xl: 'p-5'
        }
    },
    defaultVariants: {
        variant: 'default',
        padding: 'md'
    }
});
