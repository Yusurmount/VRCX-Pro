import { ref } from 'vue';

// 右侧栏收起为图标竖条后，竖条与面板分离渲染，需通过共享 ref 传递当前激活的标签页
export const activeSidePanelTab = ref('friends');
