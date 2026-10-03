# UI 组件库与样式规范

VRCX-Pro 的业务 UI 以 `src/components/ui/` 为组件库。页面和业务组件负责组合与状态，不负责重新实现基础控件的视觉语言。

## 基本原则

1. 已有组件、变体或组合能满足需求时，优先复用，不新增局部样式化原生控件。
2. 重复出现的视觉模式先进入 `src/components/ui/`，再用于业务组件。
3. 组件使用 `class-variance-authority` 表达变体，使用 `data-slot` 暴露稳定测试和样式钩子。
4. 业务组件可以传布局类（宽度、间距、响应式轨道），但不能重新定义按钮、输入框、面板和色块的基础外观。
5. 用户可见文字必须来自 Vue I18n。
6. 用户可见文案中的产品名统一写 **VRCX-Pro**（三语 locale、硬编码弹窗/toast/对话框标题、导出报告均适用）。保留 `VRCX` 原样的例外：协议与标识（`VRCX-ID` 请求头、Sentry DSN）、文件/路径名（`VRCX.png`、`VRCX.desktop`、`%AppData%\VRCX`）、配置键与表前缀（`VRCX_*`）；README/docs 中指向上游项目的链接与对照说明也不改。

## 常用组合

### 表面与信息区块

重复的对话框、侧栏和信息区块使用 `Panel`：

```vue
<Panel variant="muted">
    <div class="text-xs text-muted-foreground">Section content</div>
</Panel>
```

可用变体：

| 变体 | 用途 |
| --- | --- |
| `default` | 标准卡片表面，带边框、底色和轻阴影 |
| `muted` | 对话框内分组、信息区块和高密度面板 |
| `outline` | 需要清晰边界但不强调层级的内容 |
| `subtle` | 浅色提示区、配置块和次级表面 |

内边距使用 `padding="none | sm | md | lg | xl"`，不要在业务组件中重复书写 `rounded-xl bg-muted/80 p-3`。

### 表单输入

- 普通文本、数字、密码：`InputGroupField`
- 多行输入：`InputGroupTextareaField`
- 搜索：`InputGroupSearch`
- 选择器：`Select` / `NativeSelect`
- 布尔设置：`Switch` / `Checkbox`
- 数值滑动：`Slider`
- 颜色值：`ColorInput`
- 颜色快捷选择：`ColorSwatch`
- 卡片式单选：`RadioCard`

`ColorInput` 统一 `input[type="color"]` 的边框、焦点环、禁用态和色块显示：

```vue
<ColorInput v-model="accentColor" label="Accent color" />
```

`ColorSwatch` 负责可选色块、选中环和无障碍状态：

```vue
<ColorSwatch
    v-for="color in presets"
    :key="color"
    :color="color"
    :selected="selectedColor === color"
    @select="selectedColor = $event" />
```

`RadioCard` 统一卡片式单选：整卡是 `label`，点击任意位置即选中；选中边框由全局单选组件的 `data-state`（`has-[[data-state=checked]]`）驱动，业务组件只传 `id` / `value` / 文案：

```vue
<RadioGroup v-model="mode" class="grid gap-2">
    <RadioCard id="mode-a" value="a" :title="t('...')" :description="t('...')" />
</RadioGroup>
```

### 按钮

- 主操作：`variant="default"`
- 次操作：`variant="outline"` / `variant="secondary"`
- 图标和列表操作：`variant="ghost"` + `size="icon-sm"`
- 文本链接：`variant="link"`
- 危险操作：`variant="destructive"`

图标按钮必须有可访问名称（`aria-label`、`ariaLabel` 或等价文本）。列表行优先使用 `Button` 的 ghost/outline 变体，或 `Item` 组合，不再手写 `hover:bg-accent` 加自定义边框。

### 列表、反馈与覆盖层

- 重复项：`Item`、`ItemMedia`、`ItemContent`、`ItemActions`
- 空态：`Empty` / `DataTableEmpty`
- 加载：`Spinner` / `Skeleton`
- 提示：`Alert`
- 对话框：`Dialog` / `AlertDialog`
- 抽屉与弹层：`Sheet` / `Popover` / `Tooltip`

## 允许保留局部 CSS 的场景

以下内容可以保留在业务组件或专用组件中：

- 动画关键帧、过渡和 `prefers-reduced-motion` 处理；
- 虚拟化列表的行定位、动态网格和拖拽命中区域；
- 平台窗口装饰（例如 macOS 标题栏）；
- 文件上传隐藏控件和第三方编辑器适配；
- 图表画布、图片查看器、日历等专用交互。

即使属于例外，也应只处理组件库无法表达的行为，不要把基础颜色、圆角、边框、焦点环或字体重新写一遍。

## 扩展组件库

新增组件时按以下顺序执行：

1. 在 `src/components/ui/<name>/` 创建组件和 `index.js`。
2. 若存在多尺寸、多状态或多视觉变体，使用 `cva` 定义变体。
3. 使用 `Primitive` 或对应 Reka UI 根组件承载原生语义。
4. 提供稳定的 `data-slot`。
5. 业务组件只传布局和内容，不复制基础视觉类。
6. 添加组件级 Vitest，覆盖默认状态、选中/禁用状态和事件。
7. 更新本文档、[KNOWLEDGE_BASE.md](KNOWLEDGE_BASE.md) 与相关测试说明。

## 验证

UI 变更至少执行：

```powershell
npx oxfmt --check <changed-files>
npx vitest run <component-tests>
npx vite build src
```

涉及交互、响应式布局或视觉层级时，还要做实际页面检查：

- 浅色和暗色主题；
- 桌面宽度和窄窗口；
- 文本不溢出、不遮挡相邻控件；
- 焦点态、禁用态和选中态可见。

完整 Tauri 环境不可用时，可以搭建临时组件预览页验证新增基础组件；预览文件不得留在仓库。
