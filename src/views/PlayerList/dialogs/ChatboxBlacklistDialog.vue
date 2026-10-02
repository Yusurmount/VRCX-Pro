<template>
    <Dialog v-model:open="chatboxBlacklistDialog.visible">
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{{ t('dialog.chatbox_blacklist.header') }}</DialogTitle>
            </DialogHeader>
            <div v-if="chatboxBlacklistDialog.visible">
                <h2>{{ t('dialog.chatbox_blacklist.keyword_blacklist') }}</h2>
                <InputGroupAction
                    class="mt-1.5"
                    v-for="(item, index) in chatboxBlacklist"
                    :key="index"
                    v-model="chatboxBlacklist[index]"
                    size="sm"
                    @change="saveChatboxBlacklist">
                    <template #actions>
                        <Button
                            variant="outline"
                            @click="
                                chatboxBlacklist.splice(index, 1);
                                saveChatboxBlacklist();
                            ">
                        </Button>
                    </template>
                </InputGroupAction>
                <Button size="sm" variant="outline" style="margin-top: 6px" @click="chatboxBlacklist.push('')">
                    {{ t('dialog.chatbox_blacklist.add_item') }}
                </Button>
                <br />
                <h2>{{ t('dialog.chatbox_blacklist.user_blacklist') }}</h2>
                <Badge
                    v-for="user in chatboxUserBlacklist"
                    :key="user[0]"
                    variant="outline"
                    style="margin-right: 6px; margin-top: 6px">
                    <span>{{ user[1] }}</span>
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        class="ml-2 size-4 p-0 text-current"
                        @click="deleteChatboxUserBlacklist(user[0])">
                        <X class="size-3" />
                    </Button>
                </Badge>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { InputGroupAction } from '@/components/ui/input-group';
    import { X } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { Badge } from '../../../components/ui/badge';
    import { usePhotonStore } from '../../../stores';

    const { t } = useI18n();

    const photonStore = usePhotonStore();
    const { chatboxUserBlacklist, chatboxBlacklist } = storeToRefs(photonStore);
    const { saveChatboxBlacklist } = photonStore;

    defineProps({
        chatboxBlacklistDialog: {
            type: Object,
            required: true
        }
    });

    const emit = defineEmits(['deleteChatboxUserBlacklist']);

    /**
     *
     * @param userId
     */
    function deleteChatboxUserBlacklist(userId) {
        emit('deleteChatboxUserBlacklist', userId);
    }
</script>
