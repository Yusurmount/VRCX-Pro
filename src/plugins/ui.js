import {
    applyAppCjkFontPack,
    applyAppFontFamily,
    changeAppThemeStyle,
    changeHtmlLangAttribute,
    getThemeMode,
    initThemeColor,
    refreshCustomCss
} from '../shared/utils/base/ui';
import {
    APP_CJK_FONT_PACK_DEFAULT_KEY,
    APP_FONT_DEFAULT_KEY
} from '../shared/constants';
import { i18n, loadLocalizedStrings } from './i18n';

import configRepository from '../services/config';

export async function initUi() {
    try {
        // 语言、主题、主题色、自定义 CSS 相互独立，并行初始化
        const [language, themeModePromise, themeColorPromise, customCssPromise] =
            [
                configRepository.getString('VRCX_appLanguage', 'en'),
                getThemeMode(configRepository),
                initThemeColor(),
                refreshCustomCss()
            ];

        const resolvedLanguage = await language;
        // @ts-ignore
        i18n.locale = resolvedLanguage;
        await loadLocalizedStrings(resolvedLanguage);
        changeHtmlLangAttribute(resolvedLanguage);

        const { initThemeMode } = await themeModePromise;
        changeAppThemeStyle(initThemeMode);
        await themeColorPromise;
        await customCssPromise;
    } catch (error) {
        console.error('Error initializing locale and theme:', error);
    }
}

export async function initUiForVrOverlay() {
    try {
        const [language, fontFamily, customFontFamily, cjkFontPack] =
            await Promise.all([
                configRepository.getString('VRCX_appLanguage', 'en'),
                configRepository.getString(
                    'VRCX_fontFamily',
                    APP_FONT_DEFAULT_KEY
                ),
                configRepository.getString('VRCX_customFontFamily', ''),
                configRepository.getString(
                    'VRCX_cjkFontPack',
                    APP_CJK_FONT_PACK_DEFAULT_KEY
                )
            ]);

        // @ts-ignore
        i18n.locale = language;
        await loadLocalizedStrings(language);
        changeHtmlLangAttribute(language);
        applyAppFontFamily(fontFamily, customFontFamily);
        applyAppCjkFontPack(cjkFontPack);
    } catch (error) {
        console.error('Error initializing VR locale and fonts:', error);
    }
}
