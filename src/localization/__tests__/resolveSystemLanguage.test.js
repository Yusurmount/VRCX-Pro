import { describe, expect, test } from 'vitest';

import { resolveSystemLanguage } from '../index';
import { languageCodes } from '../locales';

describe('resolveSystemLanguage', () => {
    describe('returns null for invalid input', () => {
        test('empty string', () => {
            expect(resolveSystemLanguage('', languageCodes)).toBeNull();
        });

        test('null', () => {
            expect(resolveSystemLanguage(null, languageCodes)).toBeNull();
        });

        test('undefined', () => {
            expect(resolveSystemLanguage(undefined, languageCodes)).toBeNull();
        });

        test('unsupported language', () => {
            expect(resolveSystemLanguage('de-DE', languageCodes)).toBeNull();
        });
    });

    describe('exact match', () => {
        test('zh-CN matches zh-CN', () => {
            expect(resolveSystemLanguage('zh-CN', languageCodes)).toBe('zh-CN');
        });

        test('zh-TW matches zh-TW', () => {
            expect(resolveSystemLanguage('zh-TW', languageCodes)).toBe('zh-TW');
        });

        test('en matches en', () => {
            expect(resolveSystemLanguage('en', languageCodes)).toBe('en');
        });
    });

    describe('prefix match', () => {
        test('en-US matches en', () => {
            expect(resolveSystemLanguage('en-US', languageCodes)).toBe('en');
        });

        test('removed language ja-JP returns null', () => {
            expect(resolveSystemLanguage('ja-JP', languageCodes)).toBeNull();
        });

        test('removed language ko-KR returns null', () => {
            expect(resolveSystemLanguage('ko-KR', languageCodes)).toBeNull();
        });

        test('removed language fr-FR returns null', () => {
            expect(resolveSystemLanguage('fr-FR', languageCodes)).toBeNull();
        });
    });

    describe('Chinese region-aware mapping', () => {
        test('zh-HK maps to zh-TW (traditional)', () => {
            expect(resolveSystemLanguage('zh-HK', languageCodes)).toBe('zh-TW');
        });

        test('zh-MO maps to zh-TW (traditional)', () => {
            expect(resolveSystemLanguage('zh-MO', languageCodes)).toBe('zh-TW');
        });

        test('zh-SG maps to zh-CN (simplified)', () => {
            expect(resolveSystemLanguage('zh-SG', languageCodes)).toBe('zh-CN');
        });

        test('bare zh maps to zh-CN', () => {
            expect(resolveSystemLanguage('zh', languageCodes)).toBe('zh-CN');
        });

        test('zh-Hant maps to zh-TW (traditional script tag)', () => {
            expect(resolveSystemLanguage('zh-Hant', languageCodes)).toBe(
                'zh-TW'
            );
        });

        test('zh-Hans maps to zh-CN (simplified script tag)', () => {
            expect(resolveSystemLanguage('zh-Hans', languageCodes)).toBe(
                'zh-CN'
            );
        });

        test('zh-Hant-HK maps to zh-TW (script + region)', () => {
            expect(resolveSystemLanguage('zh-Hant-HK', languageCodes)).toBe(
                'zh-TW'
            );
        });

        test('zh-Hans-CN maps to zh-CN (script + region)', () => {
            expect(resolveSystemLanguage('zh-Hans-CN', languageCodes)).toBe(
                'zh-CN'
            );
        });

        test('zh-Hant-MO maps to zh-TW (script + traditional region)', () => {
            expect(resolveSystemLanguage('zh-Hant-MO', languageCodes)).toBe(
                'zh-TW'
            );
        });
    });
});
