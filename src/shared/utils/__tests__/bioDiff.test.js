import { describe, test, expect } from 'vitest';
import { buildBioVersions, computeLineDiff } from '../bioDiff';

describe('shared/utils/bioDiff', () => {
    describe('buildBioVersions', () => {
        test('returns empty array with no records and no current bio', () => {
            expect(buildBioVersions([], '')).toEqual([]);
            expect(buildBioVersions([], null)).toEqual([]);
        });

        test('returns current bio alone when there are no records', () => {
            const versions = buildBioVersions([], 'live bio');
            expect(versions).toEqual([
                { bio: 'live bio', createdAt: null, isCurrent: true }
            ]);
        });

        test('rebuilds chain from a single DESC record', () => {
            const versions = buildBioVersions(
                [{ previousBio: 'old', bio: 'new', createdAt: 'T1' }],
                'new'
            );
            expect(versions).toEqual([
                { bio: 'old', createdAt: 'T1', isCurrent: false },
                { bio: 'new', createdAt: 'T1', isCurrent: false }
            ]);
        });

        test('rebuilds multi-record chain from DESC input in chronological order', () => {
            // DB returns newest first
            const records = [
                { previousBio: 'b', bio: 'c', createdAt: 'T2' },
                { previousBio: 'a', bio: 'b', createdAt: 'T1' }
            ];
            const versions = buildBioVersions(records, 'c');
            expect(versions).toEqual([
                { bio: 'a', createdAt: 'T1', isCurrent: false },
                { bio: 'b', createdAt: 'T1', isCurrent: false },
                { bio: 'c', createdAt: 'T2', isCurrent: false }
            ]);
        });

        test('deduplicates consecutive identical texts and treats null as empty', () => {
            const records = [
                { previousBio: 'same', bio: 'same', createdAt: 'T2' },
                { previousBio: null, bio: 'same', createdAt: 'T1' }
            ];
            const versions = buildBioVersions(records, 'same');
            expect(versions).toEqual([
                { bio: '', createdAt: 'T1', isCurrent: false },
                { bio: 'same', createdAt: 'T1', isCurrent: false }
            ]);
        });

        test('appends differing live bio as current version', () => {
            const records = [
                { previousBio: 'a', bio: 'b', createdAt: 'T1' }
            ];
            const versions = buildBioVersions(records, 'c');
            expect(versions[versions.length - 1]).toEqual({
                bio: 'c',
                createdAt: null,
                isCurrent: true
            });
        });

        test('does not append current bio when it equals the last version', () => {
            const records = [
                { previousBio: 'a', bio: 'b', createdAt: 'T1' }
            ];
            const versions = buildBioVersions(records, 'b');
            expect(versions).toHaveLength(2);
            expect(versions.every((v) => !v.isCurrent)).toBe(true);
        });
    });

    describe('computeLineDiff', () => {
        test('returns empty ops for two empty strings', () => {
            expect(computeLineDiff('', '')).toEqual([]);
        });

        test('returns equal ops with both line numbers for identical text', () => {
            expect(computeLineDiff('a\nb', 'a\nb')).toEqual([
                { type: 'equal', text: 'a', oldLine: 1, newLine: 1 },
                { type: 'equal', text: 'b', oldLine: 2, newLine: 2 }
            ]);
        });

        test('returns pure additions when old side is empty', () => {
            expect(computeLineDiff('', 'a\nb')).toEqual([
                { type: 'add', text: 'a', oldLine: null, newLine: 1 },
                { type: 'add', text: 'b', oldLine: null, newLine: 2 }
            ]);
        });

        test('returns pure deletions when new side is empty', () => {
            expect(computeLineDiff('a\nb', '')).toEqual([
                { type: 'del', text: 'a', oldLine: 1, newLine: null },
                { type: 'del', text: 'b', oldLine: 2, newLine: null }
            ]);
        });

        test('marks changed lines with correct numbers and order', () => {
            expect(computeLineDiff('l1\nl2\nl3', 'l1\nlX\nl3')).toEqual([
                { type: 'equal', text: 'l1', oldLine: 1, newLine: 1 },
                { type: 'del', text: 'l2', oldLine: 2, newLine: null },
                { type: 'add', text: 'lX', oldLine: null, newLine: 2 },
                { type: 'equal', text: 'l3', oldLine: 3, newLine: 3 }
            ]);
        });

        test('normalizes CRLF line endings', () => {
            expect(computeLineDiff('a\r\nb', 'a\nb')).toEqual([
                { type: 'equal', text: 'a', oldLine: 1, newLine: 1 },
                { type: 'equal', text: 'b', oldLine: 2, newLine: 2 }
            ]);
        });

        test('handles multi-line insertions', () => {
            expect(computeLineDiff('a\nd', 'a\nb\nc\nd')).toEqual([
                { type: 'equal', text: 'a', oldLine: 1, newLine: 1 },
                { type: 'add', text: 'b', oldLine: null, newLine: 2 },
                { type: 'add', text: 'c', oldLine: null, newLine: 3 },
                { type: 'equal', text: 'd', oldLine: 2, newLine: 4 }
            ]);
        });
    });
});
