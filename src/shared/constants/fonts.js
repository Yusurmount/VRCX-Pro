const APP_FONT_DEFAULT_KEY = 'inter';
const APP_CJK_FONT_PACK_DEFAULT_KEY = 'noto';

// 精简后的西文字体配置：仅保留默认 Inter（本地内置 @fontsource-variable/inter）
const APP_FONT_CONFIG = Object.freeze({
    inter: {
        cssName: "'Inter Variable'",
        link: null
    }
});

const APP_FONT_FAMILIES = Object.freeze(Object.keys(APP_FONT_CONFIG));

// CJK 字体包精简为仅内置 Noto（简体/繁体）：JP/KR 字体包已随多余语言支持一并移除
const APP_CJK_FONT_PACK_CONFIG = Object.freeze({
    noto: {
        cssName: Object.freeze({
            sc: "'Noto Sans SC Variable'",
            tc: "'Noto Sans TC Variable'"
        }),
        link: null
    }
});

const APP_CJK_FONT_PACKS = Object.freeze(Object.keys(APP_CJK_FONT_PACK_CONFIG));

export {
    APP_FONT_CONFIG,
    APP_FONT_DEFAULT_KEY,
    APP_FONT_FAMILIES,
    APP_CJK_FONT_PACK_CONFIG,
    APP_CJK_FONT_PACK_DEFAULT_KEY,
    APP_CJK_FONT_PACKS
};
