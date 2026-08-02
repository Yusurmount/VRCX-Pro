// Web Worker: 手动关系推荐计算（从 manualRelations store 移出，避免阻塞主线程）
// 纯计算逻辑，无 DOM 访问；输入输出均通过 postMessage 结构化克隆传递（支持 Map/Set）。
import { parseLocation } from '../shared/utils/locationParser';
import dayjs from 'dayjs';

/**
 * 计算推荐建议。逻辑与原 store 的 computeSuggestions 保持一致。
 * @param {object} payload
 */
function compute(payload) {
    const {
        eventsByLocation,
        mySessions,
        oldMutualSnapshot,
        myFriendsSet,
        trackedSet,
        displayNames,
        manualRelsList
    } = payload;

    const candidatesSet = new Set([...myFriendsSet, ...trackedSet]);
    const pairStats = new Map();

    for (const [location, sessions] of eventsByLocation.entries()) {
        const parsed = parseLocation(location);
        const creatorId = parsed.userId;

        // 先把会话预过滤为候选用户，避免在双重循环里反复做 candidatesSet 判断
        const candidateSessions = sessions.filter((s) =>
            candidatesSet.has(s.userId)
        );
        const F = candidateSessions.length;
        if (F < 2) continue; // 不足两个候选用户，直接跳过该位置

        const mySess = mySessions.get(location) || [];
        const locPairs = new Map();

        for (let i = 0; i < F; i++) {
            const sessA = candidateSessions[i];

            for (let j = i + 1; j < F; j++) {
                const sessB = candidateSessions[j];
                if (sessA.userId === sessB.userId) continue;

                const overlapStart = Math.max(
                    sessA.leaveAt - sessA.time,
                    sessB.leaveAt - sessB.time
                );
                const overlapEnd = Math.min(sessA.leaveAt, sessB.leaveAt);

                if (overlapEnd > overlapStart) {
                    const [id1, id2] = [sessA.userId, sessB.userId].sort();
                    const key = `${id1}|${id2}`;

                    const isStrictPrivate =
                        parsed.accessType === 'invite' ||
                        parsed.accessType === 'private';
                    let hardMatch = false;
                    if (
                        isStrictPrivate &&
                        (creatorId === id1 || creatorId === id2)
                    ) {
                        hardMatch = true;
                    }

                    let mePresent = false;
                    for (const m of mySess) {
                        const myStart = m.leaveAt - m.time;
                        const myEnd = m.leaveAt;
                        if (
                            Math.min(myEnd, overlapEnd) -
                                Math.max(myStart, overlapStart) >
                            0
                        ) {
                            mePresent = true;
                            break;
                        }
                    }

                    if (!locPairs.has(key)) {
                        locPairs.set(key, {
                            hardMatch,
                            mePresent,
                            accessType: parsed.accessType || 'public',
                            creatorId: creatorId,
                            overlapStart,
                            overlapEnd,
                            aJoin: sessA.leaveAt - sessA.time,
                            bJoin: sessB.leaveAt - sessB.time
                        });
                    } else {
                        const state = locPairs.get(key);
                        state.hardMatch = state.hardMatch || hardMatch;
                        state.mePresent = state.mePresent || mePresent;
                        state.overlapStart = Math.min(
                            state.overlapStart,
                            overlapStart
                        );
                        state.overlapEnd = Math.max(
                            state.overlapEnd,
                            overlapEnd
                        );
                    }
                }
            }
        }

        const instanceWeightMap = {
            invite: 1.0,
            'invite+': 1.0,
            private: 1.0,
            friends: 1.8,
            'friends+': 1.2,
            hidden: 1.2,
            group: 1.0,
            groupPublic: 1.0,
            groupPlus: 1.0,
            public: 0.5
        };

        for (const [key, state] of locPairs.entries()) {
            let stats = pairStats.get(key);
            if (!stats) {
                stats = {
                    count: 0,
                    weightedCount: 0,
                    countMeAbsent: 0,
                    countUnknown: 0,
                    hardMatch: false,
                    hostedByA: false,
                    hostedByB: false,
                    firstMeeting: Infinity,
                    lastMeeting: 0
                };
                pairStats.set(key, stats);
            }
            stats.count++;
            const weight = instanceWeightMap[state.accessType] || 0.5;
            stats.weightedCount += weight;

            if (!state.mePresent) {
                stats.countMeAbsent++;
            } else {
                // Math detection for "Unknown" (snapshot)
                // If they both joined within 3 minutes of each other
                if (Math.abs(state.aJoin - state.bJoin) <= 180000) {
                    let isSnapshot = false;
                    for (const m of mySess) {
                        const myStart = m.leaveAt - m.time;
                        if (
                            Math.abs(state.aJoin - myStart) <= 180000 &&
                            Math.abs(state.bJoin - myStart) <= 180000
                        ) {
                            isSnapshot = true;
                            break;
                        }
                    }
                    if (isSnapshot) {
                        stats.countUnknown++;
                    }
                }
            }

            if (state.hardMatch) stats.hardMatch = true;

            stats.firstMeeting = Math.min(
                stats.firstMeeting,
                state.overlapStart
            );
            stats.lastMeeting = Math.max(stats.lastMeeting, state.overlapEnd);

            const [idA, idB] = key.split('|');
            if (
                state.creatorId === idA &&
                (state.accessType === 'friends' ||
                    state.accessType === 'friends+' ||
                    state.accessType === 'hidden')
            ) {
                stats.hostedByA = true;
            }
            if (
                state.creatorId === idB &&
                (state.accessType === 'friends' ||
                    state.accessType === 'friends+' ||
                    state.accessType === 'hidden')
            ) {
                stats.hostedByB = true;
            }
        }
    }

    const knownFriendsSet = new Set();

    // 直接遍历 oldMutualSnapshot 图结构的边，避免 O(N²) 全候选扫描。
    // 每条边 (friendId, mutualId) 只要双方都是候选用户，就标记为已知好友；
    // 键统一用 min|max 生成，Set 天然去重，等价于原代码的双向判断。
    for (const [friendId, mutualSet] of oldMutualSnapshot.entries()) {
        if (!candidatesSet.has(friendId)) continue;
        if (!mutualSet || mutualSet.size === 0) continue;
        for (const mutualId of mutualSet) {
            if (!candidatesSet.has(mutualId)) continue;
            const [a, b] =
                friendId < mutualId
                    ? [friendId, mutualId]
                    : [mutualId, friendId];
            knownFriendsSet.add(`${a}|${b}`);
        }
    }

    const manualSet = new Set(
        manualRelsList.map((r) => {
            const [a, b] = [r.userIdA, r.userIdB].sort();
            return `${a}|${b}`;
        })
    );

    const result = [];

    for (const [key, stats] of pairStats.entries()) {
        if (knownFriendsSet.has(key)) continue;

        const [idA, idB] = key.split('|');
        const isAdded = manualSet.has(key);

        // User heuristic: If we found > 0 mutual friends for a player, it proves they have "Show Mutual Friends" ON.
        // If BOTH players have the feature ON, and they aren't friends in `knownFriendsSet`, they are definitively NOT friends. Skip.
        const listA = oldMutualSnapshot.get(idA);
        const listB = oldMutualSnapshot.get(idB);
        const hasMutualsA = listA && listA.size > 0;
        const hasMutualsB = listB && listB.size > 0;

        if (hasMutualsA && hasMutualsB) {
            continue;
        }

        const nameA = displayNames.get(idA) || idA;
        const nameB = displayNames.get(idB) || idB;

        let finalScore = 0;
        let displayScore = '';
        let tooltip = '';

        const crossHostMatch = stats.hostedByA && stats.hostedByB;

        const effectiveStartDate = stats.firstMeeting;
        const effectiveEndDate = stats.lastMeeting;
        const daysObservedSpan = Math.max(
            0,
            (effectiveEndDate - effectiveStartDate) / (1000 * 60 * 60 * 24)
        );
        const daysObserved = Math.max(14, daysObservedSpan);
        const startDateStr = dayjs(effectiveStartDate).format('YYYY-MM-DD');
        const endDateStr = dayjs(effectiveEndDate).format('YYYY-MM-DD');

        if (stats.hardMatch) {
            finalScore = 9999;
            displayScore = '私房';
            tooltip = `一票肯定 (硬性关联): 是\n由于双方之一是你们所处 Invite 私密房间的创建人，推测与其存在核心邀请关系。`;
        } else {
            const densityBonus = (stats.weightedCount / daysObserved) * 50;
            const baseScore = stats.weightedCount + densityBonus;

            let multiplierStr = '';
            let multiplier = 1.0;
            let multiplierFormula = '';
            let independentPct = 0;

            const indepRatio =
                stats.count > 0
                    ? (stats.countMeAbsent + stats.countUnknown) / stats.count
                    : 0;
            independentPct = Math.round(indepRatio * 100);

            if (indepRatio <= 0.08) {
                multiplier = 0.55 + (indepRatio / 0.08) * (1.08 - 0.55);
            } else {
                multiplier = 1.0 + indepRatio;
            }
            multiplierStr = `${Math.round(multiplier * 100)}%`;
            multiplierFormula =
                indepRatio <= 0.08
                    ? `惩罚: 0.55 + (${indepRatio.toFixed(3)} / 0.08) * 0.53`
                    : `增幅: 1.0 + ${indepRatio.toFixed(3)}`;

            if (crossHostMatch) {
                multiplier *= 1.2;
                multiplierStr = `${Math.round(multiplier * 100)}%`;
                multiplierFormula += `\n[连带增收: 观测到双向进入对方开启的房间，附加 1.2x 互派加成]`;
            }

            finalScore = Math.round(baseScore * multiplier);

            // 过滤逻辑：
            // 1. 如果是尚未添加的关系，只保留 5 分及以上的 (过滤掉低分噪音)
            // 2. 如果是已经添加的关系，保留 1 分及以上的 (确保已添加列表能显示分数)
            if (isAdded) {
                if (finalScore < 1) continue;
            } else {
                if (finalScore < 5) continue;
            }

            displayScore = `${finalScore}`;

            tooltip =
                `最终得分: ${finalScore}\n` +
                `计算式: ${baseScore.toFixed(1)} (基数) × ${multiplierStr} (权重)\n` +
                `─────\n` +
                `基数构成: ${stats.weightedCount.toFixed(1)} (实例加权分) + ${densityBonus.toFixed(1)} (短期密度分)\n` +
                `有效相遇: 实录 ${stats.count} 次\n` +
                `活跃窗口: ${Math.round(daysObservedSpan)} 天跨度 (${startDateStr} 至 ${endDateStr})\n\n` +
                `脱离玩家独立轨迹检出: \n` +
                `  > 异步共处 (我不在场): ${stats.countMeAbsent} 次\n` +
                `  > 事前共处 (快照未知): ${stats.countUnknown} 次\n` +
                `  * 综合独立率 = ${independentPct}%\n\n` +
                `独立权重影响: ${multiplierStr} \n[公式: ${multiplierFormula}]`;
        }

        result.push({
            userIdA: idA,
            userIdB: idB,
            nameA,
            nameB,
            score: finalScore,
            displayScore,
            tooltip,
            key,
            isAdded
        });
    }

    result.sort((a, b) => b.score - a.score);
    return result;
}

self.onmessage = (e) => {
    try {
        const result = compute(e.data);
        self.postMessage({ result });
    } catch (err) {
        self.postMessage({ error: String(err && err.stack ? err.stack : err) });
    }
};
