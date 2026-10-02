<template>
    <div class="flex w-12 shrink-0 flex-col items-center gap-1 border-l border-sidebar-border bg-sidebar py-2">
        <TooltipWrapper side="left" :content="t('side_panel.search_placeholder')">
            <Button
                class="rounded-full"
                variant="ghost"
                size="icon-sm"
                :ariaLabel="t('side_panel.search_placeholder')"
                @click="handleSearch">
                <Search />
            </Button>
        </TooltipWrapper>
        <TooltipWrapper side="left" :content="t('side_panel.friends')">
            <Button
                class="rounded-full"
                variant="ghost"
                size="icon-sm"
                :ariaLabel="t('side_panel.friends')"
                @click="handleTab('friends')">
                <Users />
            </Button>
        </TooltipWrapper>
        <TooltipWrapper v-if="hasGroupsTab" side="left" :content="t('side_panel.groups')">
            <Button
                class="rounded-full"
                variant="ghost"
                size="icon-sm"
                :ariaLabel="t('side_panel.groups')"
                @click="handleTab('groups')">
                <UsersRound />
            </Button>
        </TooltipWrapper>
        <TooltipWrapper
            v-if="notificationLayout !== 'table'"
            side="left"
            :content="t('side_panel.notification_center.title')">
            <Button
                class="rounded-full relative"
                variant="ghost"
                size="icon-sm"
                :ariaLabel="t('side_panel.notification_center.title')"
                @click="handleNotifications">
                <Bell />
                <span
                    v-if="hasUnseenNotifications"
                    class="absolute top-1 right-1.25 size-1.5 rounded-full bg-red-500" />
            </Button>
        </TooltipWrapper>
    </div>
</template>

<script setup>
    import { computed } from 'vue';
    import { storeToRefs } from 'pinia';
    import { Bell, Search, Users, UsersRound } from 'lucide-vue-next';
    import { useI18n } from 'vue-i18n';

    import { Button } from '@/components/ui/button';
    import { TooltipWrapper } from '@/components/ui/tooltip';

    import {
        useAppearanceSettingsStore,
        useGroupStore,
        useNotificationStore,
        useNotificationsSettingsStore
    } from '../../stores';
    import { useQuickSearchStore } from '../../stores/quickSearch';

    import { activeSidePanelTab } from './sidePanelUiState';

    const { t } = useI18n();

    const { setSidePanelCollapsed } = useAppearanceSettingsStore();
    const { groupInstances } = storeToRefs(useGroupStore());
    const { isNotificationCenterOpen, hasUnseenNotifications } = storeToRefs(useNotificationStore());
    const { notificationLayout } = storeToRefs(useNotificationsSettingsStore());
    const quickSearchStore = useQuickSearchStore();

    const hasGroupsTab = computed(() => groupInstances.value.length > 0);

    const expand = () => setSidePanelCollapsed(false);

    /**
     * @param tab
     */
    function handleTab(tab) {
        activeSidePanelTab.value = tab;
        expand();
    }

    /**
     *
     */
    function handleSearch() {
        quickSearchStore.open();
    }

    /**
     *
     */
    function handleNotifications() {
        isNotificationCenterOpen.value = true;
    }
</script>
