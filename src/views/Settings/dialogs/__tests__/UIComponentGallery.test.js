import { describe, expect, test } from 'vitest';
import { h } from 'vue';
import { mount } from '@vue/test-utils';

import { i18n } from '@/plugins/i18n';
import { TooltipProvider } from '@/components/ui/tooltip';

import UIComponentGallery from '../UIComponentGallery.vue';

// embla-carousel (Carousel) measures slides with IntersectionObserver, which
// jsdom does not implement. WebView2 provides it at runtime.
globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
        return [];
    }
};

/**
 * Hosts the gallery the same way App.vue does: every reka-ui tooltip based
 * component in the showcase expects a TooltipProvider ancestor.
 *
 * @returns {import('vue').Component}
 */
function galleryHost() {
    return {
        name: 'GalleryHost',
        setup() {
            return () => h(TooltipProvider, null, () => h(UIComponentGallery));
        }
    };
}

describe('UIComponentGallery', () => {
    test('mounts every showcased component section without runtime errors', () => {
        const wrapper = mount(galleryHost(), {
            global: {
                plugins: [i18n]
            }
        });

        const headings = wrapper
            .findAll('section > h3')
            .map((node) => node.text());

        expect(headings).toEqual([
            'Button',
            'Badge',
            'Alert',
            'Card',
            'Input',
            'Checkbox & Switch',
            'Progress',
            'Skeleton',
            'Spinner',
            'Toggle',
            'Radio Group',
            'Tabs',
            'KBD (Keyboard)',
            'AlertDialog',
            'Avatar',
            'Breadcrumb',
            'ButtonGroup',
            'Calendar',
            'Carousel',
            'Collapsible',
            'Command',
            'ContextMenu',
            'DataTable',
            'Dialog',
            'DropdownMenu',
            'Empty',
            'Field',
            'Form',
            'HoverCard',
            'InputGroup',
            'InputOTP',
            'Item',
            'Label',
            'NativeSelect',
            'NumberField',
            'Pagination',
            'Popover',
            'RangeCalendar',
            'Resizable',
            'ScrollArea',
            'Select',
            'Sheet',
            'Sidebar',
            'Slider',
            'Sonner',
            'Table',
            'TagsInput',
            'ToggleGroup',
            'Tooltip',
            'Tree',
            'VirtualCombobox'
        ]);

        wrapper.unmount();
    });
});
