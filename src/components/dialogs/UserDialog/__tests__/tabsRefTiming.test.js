import { describe, expect, test } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui';

// 回归测试：TabsUnderline（unmount-on-hide）切入的 tab 内容经 reka-ui Presence
// 延迟多个渲染 tick 才挂载，tab ref 期间为 null——切 tab 回调若只 await 一次
// nextTick 就摸 ref，加载调用会被可选链吞掉（UserDialog 群组/世界标签曾因此一直无数据）
const Child = defineComponent({
    setup(_, { expose }) {
        expose({ load: () => {} });
        return () => null;
    }
});

const Harness = defineComponent({
    components: { Child, TabsRoot, TabsList, TabsTrigger, TabsContent },
    setup(_, { expose }) {
        const activeTab = ref('Info');
        const childRef = ref(null);
        expose({ activeTab, childRef });
        return { activeTab, childRef };
    },
    template: `
        <TabsRoot :model-value="activeTab" unmount-on-hide>
            <TabsList>
                <TabsTrigger value="Info">Info</TabsTrigger>
                <TabsTrigger value="Groups">Groups</TabsTrigger>
            </TabsList>
            <TabsContent value="Info"><div>info</div></TabsContent>
            <TabsContent value="Groups"><Child ref="childRef" /></TabsContent>
        </TabsRoot>
    `
});

describe('reka-ui tab ref mount timing (unmount-on-hide)', () => {
    test('tab ref is still unavailable after a single nextTick', async () => {
        const wrapper = mount(Harness);
        await nextTick();
        wrapper.vm.activeTab = 'Groups';
        await nextTick();
        expect(wrapper.vm.childRef).toBeNull();
    });

    test('tab ref becomes available within a few ticks', async () => {
        const wrapper = mount(Harness);
        await nextTick();
        wrapper.vm.activeTab = 'Groups';
        let available = false;
        for (let i = 0; i < 10; i++) {
            await nextTick();
            if (wrapper.vm.childRef) {
                available = true;
                break;
            }
        }
        expect(available).toBe(true);
    });
});
