/**
 * yyscbghelper v1.0.1
 * 核心特性：
 * 1. PVP/PVE 一速与多套独立不冲突拆分引擎 + 交互式御魂方案自选工作台（速生生/速生暴/速命生/速抵生/速攻暴等 1~6号位详情）
 * 2. 御魂“胚子”权威定义与深度统计评估模块（四腿满条、双速胚子、速度跳数、输出/辅助有效收益条数、首领高分件筛选）
 * 3. PVE/PVP 常用核心输出面板计算引擎（以 SSR雪御前、SSR平将门[攻击架势 & 防守架势7倍防御线] 为核心，覆盖天照/须佐/阿修罗/SP大蛇/烬天玉藻前）
 * 4. 账号资源、式神收集与臻藏/外观全景仪表盘
 * 5. 保留并强化 JSON 缓存下载导出（原始JSON & yuhun_ocr2.0）+ 多账号横向可视化对比与导入导出
 */
(function () {
    'use strict';

    console.log('%c[yyscbghelper v1.0.1] 插件已加载', 'color: #6366f1; font-weight: bold; font-size: 14px;');

    const API_EQUIP_DETAIL = 'api/get_equip_detail';
    const COMPARE_STORAGE_KEY = 'cbghelper_compare_accounts_v2';
    const DECIMAL_PLACES = 2;
    const RAW_DECIMAL_PLACES = 5;

    // ==================== 1. 御魂套装与属性常量定义 ====================
    const SUIT_CATEGORIES = {
        '暴击伤害': { bonusAttr: '暴击伤害', bonusVal: 20, suits: ['无刀取'] },
        '暴击': { bonusAttr: '暴击', bonusVal: 15, suits: ['针女', '三味', '网切', '伤魂鸟', '破势', '镇墓兽', '青女房', '海月火玉'] },
        '攻击加成': { bonusAttr: '攻击加成', bonusVal: 15, suits: ['蝠翼', '轮入道', '狰', '鸣屋', '心眼', '阴摩罗', '狂骨', '兵主部', '贝吹坊', '隐念', '片叶之苇'] },
        '防御加成': { bonusAttr: '防御加成', bonusVal: 30, suits: ['珍珠', '魅妖', '雪幽魂', '招财猫', '反枕', '日女巳时', '木魅', '出世螺', '奉海图'] },
        '生命加成': { bonusAttr: '生命加成', bonusVal: 15, suits: ['地藏像', '涅槃之火', '被服', '镜姬', '钟灵', '薙魂', '树妖', '涂佛', '恶楼', '钓瓶火'] },
        '效果抵抗': { bonusAttr: '效果抵抗', bonusVal: 15, suits: ['骰子鬼', '返魂香', '魍魉之匣', '幽谷响', '共潜', '元兴寺'] },
        '效果命中': { bonusAttr: '效果命中', bonusVal: 15, suits: ['蚌精', '火灵', '飞缘魔', '遗念火', '应声虫'] },
        '首领御魂': { bonusAttr: '首领固有', bonusVal: 8, suits: ['土蜘蛛', '胧车', '荒骷髅', '地震鲶', '蜃气楼', '鬼灵歌伎', '夜荒魂'] }
    };

    const SUIT_TO_BONUS = {};
    Object.entries(SUIT_CATEGORIES).forEach(([cat, info]) => {
        info.suits.forEach(s => {
            SUIT_TO_BONUS[s] = { category: cat, attr: info.bonusAttr, val: info.bonusVal };
        });
    });

    const PRIORITY_SPEED_SUITS = [
        '散件', '招财猫', '火灵', '蚌精', '共潜', '遗念火',
        '木魅', '返魂香', '薙魂', '日女巳时', '魅妖', '雪幽魂',
        '钟灵', '轮入道', '海月火玉', '狂骨', '破势', '伤魂鸟', '隐念'
    ];

    const RATTR_KEY_MAP = {
        attackAdditionRate: { name: '攻击加成', base: 3, isPercent: true },
        attackAdditionVal: { name: '攻击', base: 27, isPercent: false },
        critPowerAdditionVal: { name: '暴击伤害', base: 4, isPercent: true },
        critRateAdditionVal: { name: '暴击', base: 3, isPercent: true },
        debuffEnhance: { name: '效果命中', base: 4, isPercent: true },
        debuffResist: { name: '效果抵抗', base: 4, isPercent: true },
        defenseAdditionRate: { name: '防御加成', base: 3, isPercent: true },
        defenseAdditionVal: { name: '防御', base: 5, isPercent: false },
        maxHpAdditionRate: { name: '生命加成', base: 3, isPercent: true },
        maxHpAdditionVal: { name: '生命', base: 114, isPercent: false },
        speedAdditionVal: { name: '速度', base: 3, isPercent: false }
    };

    const ALL_ATTR_NAMES = ['攻击', '攻击加成', '防御', '防御加成', '暴击', '暴击伤害', '生命', '生命加成', '效果命中', '效果抵抗', '速度'];
    const PERCENT_ATTR_NAMES = new Set(['攻击加成', '防御加成', '暴击', '暴击伤害', '生命加成', '效果命中', '效果抵抗']);

    // ==================== 2. 常用核心输出式神六星满级觉醒基础面板库 ====================
    // 若账号内已拥有对应 6星40级觉醒式神，会自动优先读取账号内实装基础属性；否则使用官方标准觉醒六星满级白值
    const SHIKIGAMI_PRESETS = {
        xueyuqian: {
            key: 'xueyuqian',
            heroId: 591,
            name: '雪御前',
            role: 'PVE/PVP 多段全能主C',
            tag: '九周年核心 · 12段刀光雪爆',
            baseAtk: 4074,
            baseDef: 462,
            baseHp: 12532,
            baseSpd: 115,
            baseCrit: 11,
            baseCdmg: 160, // 觉醒后暴击伤害 150% + 10% = 160%
            desc: '觉醒自带+10%爆伤（初始160%爆伤），三技能9段刀光+3次雪爆共12段伤害，单次大招可触发2次鬼灵歌伎，二技能龙胆蓝璃在场本体免伤。',
            defaultSchemes: [
                { id: 'xyq_haige_128', label: '海月火玉+鬼灵歌伎 (超星≥128)', suit4: '海月火玉', suit2: '鬼灵歌伎', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.4, songHits: 2 },
                { id: 'xyq_haige_0', label: '海月火玉+鬼灵歌伎 (极限不限速)', suit4: '海月火玉', suit2: '鬼灵歌伎', minSpd: 0, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.4, songHits: 2 },
                { id: 'xyq_yinge_128', label: '隐念+鬼灵歌伎 (长线/神罚超星)', suit4: '隐念', suit2: '鬼灵歌伎', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.4, songHits: 2 },
                { id: 'xyq_kuangge_158', label: '狂骨+鬼灵歌伎 (魂土高速≥158)', suit4: '狂骨', suit2: '鬼灵歌伎', minSpd: 158, pos2: ['速度', '攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.64, songHits: 2 },
                { id: 'xyq_haihuang_128', label: '海月火玉+荒骷髅 (超星≥128)', suit4: '海月火玉', suit2: '荒骷髅', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.54, songHits: 0 },
                { id: 'xyq_kuanghuang_128', label: '狂骨+荒骷髅 (超星≥128)', suit4: '狂骨', suit2: '荒骷髅', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.804, songHits: 0 }
            ]
        },
        pingjiangmen: {
            key: 'pingjiangmen',
            heroId: 592,
            name: '平将门',
            role: 'PVP/PVE 攻防双架势大C',
            tag: '双形态战神 · 700%攻防线轮转',
            baseAtk: 4074,
            baseDef: 515,
            baseHp: 10803,
            baseSpd: 116,
            baseCrit: 11,
            baseCdmg: 160, // 初始爆伤160%
            desc: '初始爆伤160%。开局若初始攻击 > 防御×700%（7倍）进入【攻击架势】（3段AOE+18%总伤真伤追击）；若初始攻击 ≤ 防御×700%进入【防守架势】（受击回血500%防御，受70%攻击上限约束，队友共享70%恢复）。',
            defaultSchemes: [
                { id: 'pjm_def_shang', label: '【防守架势】伤魂鸟+二件套 (斗技肉平 攻≤7倍防)', suit4: '伤魂鸟', suit2: '不限', minSpd: 0, pos2: ['攻击加成', '防御加成', '速度'], pos4: ['防御加成', '攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'pjm_def', minDef: 1150, mult: 1.0 },
                { id: 'pjm_def_po', label: '【防守架势】破势/狂骨/海月 (高伤肉平 攻≤7倍防)', suit4: '破势', suit2: '不限', minSpd: 0, pos2: ['攻击加成', '防御加成'], pos4: ['防御加成', '攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'pjm_def', minDef: 1150, mult: 1.4 },
                { id: 'pjm_atk_kuanghuang', label: '【攻击架势】狂骨+荒骷髅 (PVE超星≥128 攻>7倍防)', suit4: '狂骨', suit2: '荒骷髅', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'pjm_atk', mult: 1.804 },
                { id: 'pjm_atk_haihuang', label: '【攻击架势】海月火玉+荒骷髅 (PVE超星≥128 攻>7倍防)', suit4: '海月火玉', suit2: '荒骷髅', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'pjm_atk', mult: 1.54 },
                { id: 'pjm_atk_po', label: '【攻击架势】破势+荒骷髅/暴击 (道馆一枪流 极限)', suit4: '破势', suit2: '不限', minSpd: 0, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'pjm_atk', mult: 1.4 },
                { id: 'pjm_atk_yinhuang', label: '【攻击架势】隐念+荒骷髅 (长线超星≥128)', suit4: '隐念', suit2: '荒骷髅', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'pjm_atk', mult: 1.54 }
            ]
        },
        tianzhao: {
            key: 'tianzhao',
            heroId: 556,
            name: '天照',
            role: 'PVE 速刷/复制核心大C',
            tag: '天晖拉条复制 · 160%初始爆伤',
            baseAtk: 3886,
            baseDef: 504,
            baseHp: 11393,
            baseSpd: 119,
            baseCrit: 12,
            baseCdmg: 160,
            desc: '初始速度119、暴击12%、爆伤160%，三技能3段群体+3段单体并赋予攻击最高队友天晖（复制技能系数70%且击杀拉条）。',
            defaultSchemes: [
                { id: 'tz_haihuang_128', label: '海月火玉+荒骷髅 (超星≥128)', suit4: '海月火玉', suit2: '荒骷髅', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.54 },
                { id: 'tz_kuanghuang_128', label: '狂骨+荒骷髅 (超星≥128)', suit4: '狂骨', suit2: '荒骷髅', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.804 },
                { id: 'tz_yinhuang_128', label: '隐念+荒骷髅 (神罚/魂王超星)', suit4: '隐念', suit2: '荒骷髅', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.54 },
                { id: 'tz_haige_128', label: '海月火玉+鬼灵歌伎 (超星≥128)', suit4: '海月火玉', suit2: '鬼灵歌伎', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.4, songHits: 1 }
            ]
        },
        xuzuozhinan: {
            key: 'xuzuozhinan',
            heroId: 389,
            name: '须佐之男',
            role: 'PVE 单体处决 / PVP 天威神剑',
            tag: '4154顶级白值 · 6段单体雷枪',
            baseAtk: 4154,
            baseDef: 494,
            baseHp: 11735,
            baseSpd: 112,
            baseCrit: 12,
            baseCdmg: 150,
            desc: '全游顶级基础攻击4154、初始暴击12%，三技能6段高系数单体伤害，PVE收尾与PVP斗技双开花。',
            defaultSchemes: [
                { id: 'xz_kuangge_128', label: '狂骨+鬼灵歌伎 (超星≥128)', suit4: '狂骨', suit2: '鬼灵歌伎', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.64, songHits: 1 },
                { id: 'xz_kuanghuang_128', label: '狂骨+荒骷髅 (超星≥128)', suit4: '狂骨', suit2: '荒骷髅', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.804 },
                { id: 'xz_haige_128', label: '海月火玉+鬼灵歌伎 (超星≥128)', suit4: '海月火玉', suit2: '鬼灵歌伎', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.4, songHits: 1 }
            ]
        },
        axiuLuo: {
            key: 'axiuLuo',
            heroId: 364,
            name: '阿修罗',
            role: 'PVE 高速挖土 / 魂土神罚先驱',
            tag: '4127高攻 · 119高速',
            baseAtk: 4127,
            baseDef: 396,
            baseHp: 10918,
            baseSpd: 119,
            baseCrit: 10,
            baseCdmg: 150,
            desc: '基础攻击4127、基础速度119，出手动画极快，常用于魂土158+高速狂荒或超星海荒/破荒。',
            defaultSchemes: [
                { id: 'axl_kuanghuang_158', label: '狂骨+荒骷髅 (魂土高速≥158)', suit4: '狂骨', suit2: '荒骷髅', minSpd: 158, pos2: ['速度', '攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.804 },
                { id: 'axl_kuanghuang_128', label: '狂骨+荒骷髅 (超星≥128)', suit4: '狂骨', suit2: '荒骷髅', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.804 },
                { id: 'axl_haihuang_132', label: '海月火玉+荒骷髅 (神罚二速≥132)', suit4: '海月火玉', suit2: '荒骷髅', minSpd: 132, pos2: ['攻击加成', '速度'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.54 }
            ]
        },
        spDashe: {
            key: 'spDashe',
            heroId: 383,
            name: '神堕八岐大蛇',
            role: 'PVE/PVP 篡位核爆群攻',
            tag: '4153高攻 · 破荒/伤魂鸟',
            baseAtk: 4153,
            baseDef: 437,
            baseHp: 13216,
            baseSpd: 118,
            baseCrit: 10,
            baseCdmg: 150,
            desc: '基础攻击4153、基础速度118，单段高倍率群攻，适配破势荒骷髅、狂骨荒骷髅及伤魂鸟。',
            defaultSchemes: [
                { id: 'spds_pohuang_128', label: '破势+荒骷髅 (超星≥128)', suit4: '破势', suit2: '荒骷髅', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.54 },
                { id: 'spds_shang_0', label: '伤魂鸟+荒骷髅/暴击 (极限输出)', suit4: '伤魂鸟', suit2: '不限', minSpd: 0, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.0 }
            ]
        },
        spJintian: {
            key: 'spJintian',
            heroId: 339,
            name: '烬天玉藻前',
            role: 'PVE 经典多段收尾',
            tag: '偷取攻击 · 9段狂歌/针歌',
            baseAtk: 3511,
            baseDef: 388,
            baseHp: 12532,
            baseSpd: 115,
            baseCrit: 12,
            baseCdmg: 150,
            desc: '初始暴击12%，被动偷取全队与敌方攻击力，9段伤害稳定触发鬼灵歌伎。',
            defaultSchemes: [
                { id: 'spjt_kuangge_128', label: '狂骨+鬼灵歌伎 (超星≥128)', suit4: '狂骨', suit2: '鬼灵歌伎', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.64, songHits: 2 },
                { id: 'spjt_zhenge_128', label: '针女+鬼灵歌伎 (超星≥128)', suit4: '针女', suit2: '鬼灵歌伎', minSpd: 128, pos2: ['攻击加成'], pos4: ['攻击加成'], pos6: ['暴击', '暴击伤害'], mode: 'atk_cdmg', mult: 1.3, songHits: 2 }
            ]
        }
    };

    // ==================== 3. 预设主属性方案（御魂界面自选方案） ====================
    const SPEED_SCHEME_PRESETS = [
        { id: 'spd_xx', name: '⚡ 速XX (极限一速)', pos2: '速度', pos4: '不限', pos6: '不限', twoPiece: '不限', fullCrit: false, desc: '不限4/6号位主属性，追求全号理论极限最高速度（适合面灵气/阎魔抢一速）' },
        { id: 'spd_hp_hp', name: '🛡️ 速生生 (通用辅助)', pos2: '速度', pos4: '生命加成', pos6: '生命加成', twoPiece: '不限', fullCrit: false, desc: '2速度 + 4生命加成 + 6生命加成，适合千姬、白藏主、因幡、鬼吞、一目连等主流先手辅助' },
        { id: 'spd_hp_crit', name: '💎 速生暴/爆 (护盾/治疗)', pos2: '速度', pos4: '生命加成', pos6: '暴击/爆伤', twoPiece: '不限', fullCrit: false, desc: '2速度 + 4生命加成 + 6暴击/暴击伤害，适合蚌精匣子、鲸汐千姬、桃花妖、高速护盾式神' },
        { id: 'spd_hp_crit_full', name: '🌟 速生暴 (满暴盾奶)', pos2: '速度', pos4: '生命加成', pos6: '暴击/爆伤', twoPiece: '不限', fullCrit: true, desc: '2速度 + 4生命加成 + 6暴击/爆伤 且 御魂暴击加成≥89%（配合基础暴击满暴）' },
        { id: 'spd_hit_hp', name: '🎯 速命生 (生存控制)', pos2: '速度', pos4: '效果命中', pos6: '生命加成', twoPiece: '不限', fullCrit: false, desc: '2速度 + 4效果命中 + 6生命加成，适合帝释天、伊邪那美、星熊童子、言灵、禅镜等先手控制' },
        { id: 'spd_hit_x', name: '🎯 速命X (极限命中速)', pos2: '速度', pos4: '效果命中', pos6: '不限', twoPiece: '不限', fullCrit: false, desc: '2速度 + 4效果命中 + 6不限，适合阎魔、孟婆等追求极限速度与命中的先手控制' },
        { id: 'spd_res_hp', name: '🔰 速抵生 (高抗驱散)', pos2: '速度', pos4: '效果抵抗', pos6: '生命加成', twoPiece: '不限', fullCrit: false, desc: '2速度 + 4效果抵抗 + 6生命加成，适合共潜数珠、返魂香驴妈、云外镜、稻荷神等后手核心' },
        { id: 'spd_res_x', name: '🔰 速抵X (极限抵抗速)', pos2: '速度', pos4: '效果抵抗', pos6: '不限', twoPiece: '不限', fullCrit: false, desc: '2速度 + 4效果抵抗 + 6不限，追求四号位抵抗下的最高速度' },
        { id: 'spd_atk_crit', name: '🗡️ 速攻暴/爆 (高速输出)', pos2: '速度', pos4: '攻击加成', pos6: '暴击/爆伤', twoPiece: '不限', fullCrit: false, desc: '2速度 + 4攻击加成 + 6暴击/暴击伤害，适合骁浪荒川之主、高速须佐、高速妖刀姬等' },
        { id: 'spd_def_hp', name: '🧱 速防生 / 速防防', pos2: '速度', pos4: '防御加成', pos6: '生命/防御', twoPiece: '不限', fullCrit: false, desc: '2速度 + 4防御加成 + 6生命加成或防御加成，适合高防辅助与入内雀体系' }
    ];

    // C(6,4) = 15 种四件套位置组合
    const COMBINATIONS_6_4 = [
        [1, 2, 3, 4], [1, 2, 3, 5], [1, 2, 3, 6],
        [1, 2, 4, 5], [1, 2, 4, 6], [1, 2, 5, 6],
        [1, 3, 4, 5], [1, 3, 4, 6], [1, 3, 5, 6],
        [1, 4, 5, 6], [2, 3, 4, 5], [2, 3, 4, 6],
        [2, 3, 5, 6], [2, 4, 5, 6], [3, 4, 5, 6]
    ];

    // ==================== 4. 全局运行时状态 ====================
    const AppState = {
        ready: false,
        latest: null,
        acctHighlight: null,
        equipMeta: null,
        parsedMitamaList: [],
        mitamaByPos: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
        availableSuits: [],
        summary: null,
        embryoStats: null,
        outputSummary: null,
        resourceSummary: null,
        speedCache: new Map(),
        outputCache: new Map(),
        // UI 交互状态
        activeMainTab: 'tab-pvp-speed', // 'tab-pvp-speed' | 'tab-output-panel' | 'tab-embryo' | 'tab-resources' | 'tab-all'
        schemeSelector: {
            presetId: 'spd_hp_hp',
            suitName: '招财猫',
            pos2Main: '速度',
            pos4Main: '生命加成',
            pos6Main: '生命加成',
            twoPiece: '不限',
            fullCrit: false,
            activeSetIdx: 0 // 0=第1套(一速), 1=第2套(独立二速), 2=第3套(独立三速)
        },
        independentStrategyId: 'pvp_standard',
        outputSelector: {
            heroKey: 'xueyuqian',
            suit4: '海月火玉',
            suit2: '鬼灵歌伎',
            minSpd: 128,
            mode: 'atk_cdmg', // 'atk_cdmg' | 'pjm_def' | 'pjm_atk'
            minDef: 1150,
            selectedCardKey: 'xueyuqian:0'
        },
        embryoFilter: 'dual_speed' // 'dual_speed' | 'full_speed_6' | 'output_8plus' | 'support_8plus' | 'boss_high' | 'crit_dmg_6'
    };

    // ==================== 5. 颜色与格式化工具函数 ====================
    function getColorConfig() {
        if (window.YysHelperColorConfig && window.YysHelperColorConfig.loadColorConfig) {
            return window.YysHelperColorConfig.loadColorConfig();
        }
        return { speedColorConfig: [], suitSpeedColorConfig: [] };
    }

    function getSingleSpeedColor(val) {
        const cfg = getColorConfig().speedColorConfig || [];
        for (const tier of cfg) {
            const max = tier.max === null || tier.max === undefined ? Infinity : tier.max;
            if (val >= tier.min && val < max) return tier.color;
        }
        if (cfg.length > 0 && val >= cfg[0].min) return cfg[0].color || '#DC2626';
        return cfg[cfg.length - 1]?.color || '#64748B';
    }

    function getSuitSpeedColor(val) {
        const cfg = getColorConfig().suitSpeedColorConfig || [];
        for (const tier of cfg) {
            const max = tier.max === null || tier.max === undefined ? Infinity : tier.max;
            if (val >= tier.min && val < max) return tier.color;
        }
        if (cfg.length > 0 && val >= cfg[0].min) return cfg[0].color || '#DC2626';
        return cfg[cfg.length - 1]?.color || '#64748B';
    }

    function formatWan(num) {
        const n = Number(num) || 0;
        if (n >= 10000) return (n / 10000).toFixed(2).replace(/\.00$/, '') + 'w';
        return n.toLocaleString('zh-CN');
    }

    function escapeHtml(str) {
        return String(str ?? '').replace(/[<>&"']/g, c => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // ==================== 6. 御魂底层解析与有效收益计算 ====================
    function decodeRattr(rattr, formatString = true) {
        const sums = {};
        const rolls = {};
        if (Array.isArray(rattr)) {
            for (const item of rattr) {
                if (!Array.isArray(item) || item.length < 2) continue;
                const [rawKey, weight] = item;
                const meta = RATTR_KEY_MAP[rawKey];
                if (!meta) continue;
                const attrName = meta.name;
                const w = parseFloat(weight) || 0;
                sums[attrName] = (sums[attrName] || 0) + w * meta.base;
                rolls[attrName] = (rolls[attrName] || 0) + 1;
            }
        }
        const formattedAttrs = Object.keys(sums).sort().map(attrName => {
            let val = sums[attrName];
            if (formatString) {
                val = val.toFixed(RAW_DECIMAL_PLACES);
                if (PERCENT_ATTR_NAMES.has(attrName)) val += '%';
            }
            return [attrName, val];
        });
        return { sums, rolls, formattedAttrs };
    }

    function parseSingleMitama(uuid, rawMitama) {
        const {
            attrs = [],
            level = 0,
            qua = 6,
            rattr = [],
            name = '未知',
            pos = 1,
            single_attr = []
        } = rawMitama || {};

        const mainAttrName = attrs[0] ? attrs[0][0] : '攻击';
        const mainAttrVal = attrs[0] ? parseFloat(attrs[0][1]) || 0 : 0;

        const { sums, rolls } = decodeRattr(rattr, false);

        // 如果 rattr 为空但 attrs 有副属性（兼容外部导入的简化数据）
        if ((!rattr || rattr.length === 0) && attrs.length > 1) {
            for (let i = 1; i < attrs.length; i++) {
                const [k, v] = attrs[i];
                if (k && sums[k] === undefined) {
                    sums[k] = parseFloat(v) || 0;
                    const baseStep = k === '速度' || k === '暴击' || k === '攻击加成' || k === '防御加成' || k === '生命加成' ? 2.7 : 3.6;
                    rolls[k] = Math.max(1, Math.round(sums[k] / baseStep));
                }
            }
        }

        const subStats = {};
        ALL_ATTR_NAMES.forEach(a => {
            subStats[a] = sums[a] || 0;
        });

        let singleAttr = null;
        if (Array.isArray(single_attr) && single_attr.length >= 2) {
            singleAttr = {
                name: single_attr[0],
                val: parseFloat(single_attr[1]) || 0
            };
        }

        const totalSubstats = { ...subStats };
        if (singleAttr && totalSubstats[singleAttr.name] !== undefined) {
            totalSubstats[singleAttr.name] += singleAttr.val;
        }

        const totalRolls = Array.isArray(rattr) && rattr.length > 0
            ? rattr.length
            : Object.values(rolls).reduce((a, b) => a + b, 0);

        const upgradeCount = Math.floor((Number(level) || 0) / 3);
        const initialLegs = Math.max(0, Math.min(4, totalRolls - upgradeCount));

        const speedRolls = rolls['速度'] || (subStats['速度'] > 0 ? 1 : 0);
        const subSpeed = subStats['速度'] || 0;
        const mainSpeed = (Number(pos) === 2 && mainAttrName === '速度') ? mainAttrVal : 0;
        const totalSpeed = mainSpeed + subSpeed;

        // 输出有效收益条数（暴击 + 暴击伤害 + 攻击加成 + 速度）
        const outputRolls = (rolls['暴击'] || 0) + (rolls['暴击伤害'] || 0) + (rolls['攻击加成'] || 0) + (rolls['速度'] || 0);
        // 攻防输出有效条数（平将门防守架势等：暴击 + 暴击伤害 + 攻击加成 + 防御加成）
        const defOutputRolls = (rolls['暴击'] || 0) + (rolls['暴击伤害'] || 0) + (rolls['攻击加成'] || 0) + (rolls['防御加成'] || 0);
        // 辅助有效条数（速度 + 效果命中 + 效果抵抗 + 生命加成 + 防御加成）
        const supportRolls = (rolls['速度'] || 0) + (rolls['效果命中'] || 0) + (rolls['效果抵抗'] || 0) + (rolls['生命加成'] || 0) + (rolls['防御加成'] || 0);

        // 首领御魂等效加分（固有8%约等于2.8条副属性收益）
        const isBoss = SUIT_CATEGORIES['首领御魂'].suits.includes(name);
        const bossBonusScore = (isBoss && singleAttr) ? 2.8 : 0;
        const bossOutputScore = outputRolls + (isBoss && singleAttr && ['暴击', '攻击加成', '暴击伤害', '速度'].includes(singleAttr.name) ? 3 : 0);

        // 用于输出面板搜索的快速启发式权重分
        const outputHeuristic = (totalSubstats['暴击'] * 1.8) + (totalSubstats['暴击伤害'] * 1.35) + (totalSubstats['攻击加成'] * 1.15);
        const defHeuristic = (totalSubstats['暴击'] * 1.8) + (totalSubstats['暴击伤害'] * 1.35) + (totalSubstats['防御加成'] * 1.2) + (totalSubstats['攻击加成'] * 1.0);

        return {
            uuid: String(uuid || rawMitama.uuid || Math.random()),
            name,
            pos: Number(pos) || 1,
            qua: Number(qua) || 6,
            level: Number(level) || 0,
            mainAttr: { name: mainAttrName, val: mainAttrVal },
            singleAttr,
            isBoss,
            subStats,
            totalSubstats,
            rolls,
            totalRolls,
            initialLegs,
            speedRolls,
            subSpeed,
            mainSpeed,
            totalSpeed,
            outputRolls,
            defOutputRolls,
            supportRolls,
            bossBonusScore,
            bossOutputScore,
            outputHeuristic,
            defHeuristic,
            raw: rawMitama
        };
    }

    // 兼容原插件对 CBG 原生御魂/式神对象的属性增强（不破坏 CBG 原页面展示）
    function enhanceRawMitama(mitama) {
        if (!mitama || !Array.isArray(mitama.rattr) || !Array.isArray(mitama.attrs)) return mitama;
        const { formattedAttrs } = decodeRattr(mitama.rattr, true);
        mitama.attrs = [mitama.attrs[0], ...formattedAttrs];
        return mitama;
    }

    function sumHeroEquipAttr(equipUuids, inventory, attrName) {
        let total = 0;
        for (const id of (equipUuids || [])) {
            const m = inventory[id];
            if (!m) continue;
            for (const [k, v] of (m.attrs || [])) {
                if (k === attrName) total += parseFloat(v) || 0;
            }
            if (Array.isArray(m.single_attr) && m.single_attr.length >= 2 && m.single_attr[0] === attrName) {
                total += parseFloat(m.single_attr[1]) || 0;
            }
        }
        return total;
    }

    function enhanceRawHero(hero, inventory) {
        if (!hero || !hero.attrs) return hero;
        const { attrs, equips = [] } = hero;
        Object.keys(attrs).forEach(attrName => {
            if (attrName === '速度' && parseFloat(attrs[attrName].add_val) > 0) {
                attrs[attrName].add_val = (hero.heroId === 255 && hero.awake === 1) ? 10 : 0;
                attrs[attrName].add_val += sumHeroEquipAttr(equips, inventory, '速度');
                attrs[attrName].add_val = attrs[attrName].add_val.toFixed(RAW_DECIMAL_PLACES);
            }
            if (attrName === '暴击' && parseFloat(attrs[attrName].add_val) > 0) {
                const critSuits = SUIT_CATEGORIES['暴击'].suits;
                attrs[attrName].add_val = sumHeroEquipAttr(equips, inventory, '暴击');
                const suitCounts = {};
                for (const id of equips) {
                    const mName = inventory[id]?.name;
                    if (mName) suitCounts[mName] = (suitCounts[mName] || 0) + 1;
                }
                Object.keys(suitCounts).forEach(sName => {
                    if (suitCounts[sName] >= 2 && critSuits.includes(sName)) {
                        attrs[attrName].add_val += suitCounts[sName] === 6 ? 30 : 15;
                    }
                });
                attrs[attrName].add_val = attrs[attrName].add_val.toFixed(2) + '%';
            }
        });
        return hero;
    }

    // 导出 yuhun_ocr2.0 格式御魂数据
    function convertToYuhunOcrFormat(mitama) {
        const {
            attrs = [], level = 15, qua = 6, rattr = [], uuid = '', name = '', pos = 1, single_attr = []
        } = mitama;
        const createdTime = parseInt(String(uuid).substring(0, 8), 16) || 0;
        const record = {
            '固有属性': single_attr.length ? single_attr[0] : null,
            '生成时间': createdTime,
            '御魂等级': level,
            '御魂星级': qua,
            '御魂ID': uuid,
            '御魂类型': name,
            '位置': pos
        };
        ALL_ATTR_NAMES.forEach(a => { record[a] = 0; });
        const { formattedAttrs } = decodeRattr(rattr, false);
        for (const [k, v] of [attrs[0], ...formattedAttrs]) {
            if (!k) continue;
            let num = parseFloat(v) || 0;
            if (PERCENT_ATTR_NAMES.has(k)) num = num / 100;
            record[k] = (record[k] || 0) + num;
        }
        if (single_attr.length >= 2) {
            const [sName, sVal] = single_attr;
            record[sName] = (record[sName] || 0) + (parseFloat(sVal) || 0) / 100;
        }
        return record;
    }

    // ==================== 7. PVP/PVE 一速与自定义方案拆分引擎 ====================
    function matchMainAttr(mitama, requiredMain) {
        if (!requiredMain || requiredMain === '不限') return true;
        const actual = mitama.mainAttr.name;
        if (requiredMain === '暴击/爆伤') return actual === '暴击' || actual === '暴击伤害';
        if (requiredMain === '生命/防御') return actual === '生命加成' || actual === '防御加成';
        if (requiredMain === '攻击/防御') return actual === '攻击加成' || actual === '防御加成';
        return actual === requiredMain;
    }

    function matchTwoPieceCategory(mitama, twoPieceReq) {
        if (!twoPieceReq || twoPieceReq === '不限') return true;
        if (twoPieceReq === '防御两件套') return SUIT_CATEGORIES['防御加成'].suits.includes(mitama.name);
        if (twoPieceReq === '生命两件套') return SUIT_CATEGORIES['生命加成'].suits.includes(mitama.name);
        if (twoPieceReq === '命中两件套') return SUIT_CATEGORIES['效果命中'].suits.includes(mitama.name);
        if (twoPieceReq === '抵抗两件套') return SUIT_CATEGORIES['效果抵抗'].suits.includes(mitama.name);
        if (twoPieceReq === '暴击两件套') return SUIT_CATEGORIES['暴击'].suits.includes(mitama.name);
        if (twoPieceReq === '攻击两件套') return SUIT_CATEGORIES['攻击加成'].suits.includes(mitama.name);
        return mitama.name === twoPieceReq;
    }

    /**
     * 核心配速求解器：支持任意四件套/散件、任意2/4/6主属性约束、两件套约束、满暴约束、以及排除已占用御魂UUID
     */
    function solveSpeedScheme(options = {}) {
        const {
            suitName = '散件',
            pos2Main = '速度',
            pos4Main = '不限',
            pos6Main = '不限',
            twoPiece = '不限',
            fullCrit = false,
            excludedUuids = new Set()
        } = options;

        const posMains = {
            1: '不限',
            2: pos2Main || '速度',
            3: '不限',
            4: pos4Main || '不限',
            5: '不限',
            6: pos6Main || '不限'
        };

        const cacheKey = excludedUuids.size === 0
            ? `${suitName}|${pos2Main}|${pos4Main}|${pos6Main}|${twoPiece}|${fullCrit ? 1 : 0}`
            : null;
        if (cacheKey && AppState.speedCache && AppState.speedCache.has(cacheKey)) {
            return AppState.speedCache.get(cacheKey);
        }

        // AppState.mitamaByPos[p] 已经在初始化时按 totalSpeed 降序预排序，无需每次重复 sort！
        const candidatesByPos = {};
        for (let p = 1; p <= 6; p++) {
            const src = AppState.mitamaByPos[p] || [];
            const reqMain = posMains[p];
            if (excludedUuids.size === 0 && (!reqMain || reqMain === '不限')) {
                candidatesByPos[p] = src;
            } else {
                candidatesByPos[p] = src.filter(m => !excludedUuids.has(m.uuid) && matchMainAttr(m, reqMain));
            }
        }

        function summarizeChoice(chosenMap, suitPositions) {
            let totalSpeed = 0;
            let subSpeedTotal = 0;
            const totalStats = {
                '速度': 0, '生命加成': 0, '防御加成': 0, '攻击加成': 0,
                '暴击': 0, '暴击伤害': 0, '效果命中': 0, '效果抵抗': 0
            };
            const suitCounts = {};

            for (let p = 1; p <= 6; p++) {
                const m = chosenMap[p];
                if (!m) continue;
                totalSpeed += m.totalSpeed;
                subSpeedTotal += m.subSpeed;
                suitCounts[m.name] = (suitCounts[m.name] || 0) + 1;

                // 累加主属性
                if (totalStats[m.mainAttr.name] !== undefined) {
                    totalStats[m.mainAttr.name] += m.mainAttr.val;
                }
                // 累加副属性与首领固有属性
                Object.keys(totalStats).forEach(k => {
                    if (k !== '速度') {
                        totalStats[k] += m.totalSubstats[k] || 0;
                    } else {
                        totalStats['速度'] += m.subSpeed || 0;
                    }
                });
            }

            // 累加套装两件套属性加成
            Object.entries(suitCounts).forEach(([sName, cnt]) => {
                if (cnt >= 2 && SUIT_TO_BONUS[sName]) {
                    const b = SUIT_TO_BONUS[sName];
                    const mult = cnt === 6 ? 2 : 1;
                    if (totalStats[b.attr] !== undefined) {
                        totalStats[b.attr] += b.val * mult;
                    }
                }
            });

            return {
                valid: Object.keys(chosenMap).length === 6,
                suitName,
                totalSpeed,
                subSpeedTotal,
                pieces: chosenMap,
                suitPositions,
                suitCounts,
                totalStats
            };
        }

        // 如果要求满暴（御魂暴击总和 >= 89%），使用分支限界搜索速度最高且满暴的组合
        if (fullCrit) {
            return solveFullCritSpeedScheme(candidatesByPos, suitName, twoPiece, summarizeChoice);
        }

        // 情况 A：散件一速
        if (suitName === '散件') {
            const chosen = {};
            for (let p = 1; p <= 6; p++) {
                if (candidatesByPos[p].length > 0) {
                    chosen[p] = candidatesByPos[p][0];
                }
            }
            const res = summarizeChoice(chosen, []);
            if (cacheKey && AppState.speedCache) AppState.speedCache.set(cacheKey, res);
            return res;
        }

        // 情况 B：指定四件套 (遍历 15 种四件套位置组合)
        let bestResult = null;

        for (const suitPosArr of COMBINATIONS_6_4) {
            const suitPosSet = new Set(suitPosArr);
            const otherPosArr = [1, 2, 3, 4, 5, 6].filter(p => !suitPosSet.has(p));

            // 检查 4 个套装位置是否都有该套装的御魂
            const chosen = {};
            let possible = true;
            for (const p of suitPosArr) {
                const found = candidatesByPos[p].find(m => m.name === suitName);
                if (!found) {
                    possible = false;
                    break;
                }
                chosen[p] = found;
            }
            if (!possible) continue;

            const [pA, pB] = otherPosArr;
            if (!twoPiece || twoPiece === '不限') {
                const candA = candidatesByPos[pA][0];
                const candB = candidatesByPos[pB][0];
                if (!candA || !candB) continue;
                chosen[pA] = candA;
                chosen[pB] = candB;
                const res = summarizeChoice(chosen, suitPosArr);
                if (!bestResult || res.totalSpeed > bestResult.totalSpeed) {
                    bestResult = res;
                }
            } else {
                // 要求特定 2 件套（必须是同一种2件套御魂名称，且满足 twoPiece 类别）
                const listA = candidatesByPos[pA].filter(m => matchTwoPieceCategory(m, twoPiece));
                const listB = candidatesByPos[pB].filter(m => matchTwoPieceCategory(m, twoPiece));
                // 按御魂名称分组取最快
                const bestA = {};
                const bestB = {};
                listA.forEach(m => { if (!bestA[m.name]) bestA[m.name] = m; });
                listB.forEach(m => { if (!bestB[m.name]) bestB[m.name] = m; });

                Object.keys(bestA).forEach(s2Name => {
                    if (bestB[s2Name]) {
                        const tempChosen = { ...chosen, [pA]: bestA[s2Name], [pB]: bestB[s2Name] };
                        const res = summarizeChoice(tempChosen, suitPosArr);
                        if (!bestResult || res.totalSpeed > bestResult.totalSpeed) {
                            bestResult = res;
                        }
                    }
                });
            }
        }

        if (!bestResult) {
            return {
                valid: false,
                suitName,
                totalSpeed: 0,
                subSpeedTotal: 0,
                pieces: {},
                suitPositions: [],
                suitCounts: {},
                totalStats: { '速度': 0, '生命加成': 0, '防御加成': 0, '攻击加成': 0, '暴击': 0, '暴击伤害': 0, '效果命中': 0, '效果抵抗': 0 }
            };
        }
        if (cacheKey && AppState.speedCache) AppState.speedCache.set(cacheKey, bestResult);
        return bestResult;
    }

    // 带满暴约束（御魂总暴击 >= 89%）的速度配装求解器
    function solveFullCritSpeedScheme(candidatesByPos, suitName, twoPiece, summarizeChoice) {
        const targetCrit = 89; // 配合大多数式神10%~12%暴击达到100%满暴
        const topPerPos = {};
        for (let p = 1; p <= 6; p++) {
            const bySpd = candidatesByPos[p].slice(0, 12);
            const byCritSpd = [...candidatesByPos[p]]
                .sort((a, b) => (b.totalSpeed + b.totalSubstats['暴击'] * 0.8) - (a.totalSpeed + a.totalSubstats['暴击'] * 0.8))
                .slice(0, 12);
            const merged = new Map();
            [...bySpd, ...byCritSpd].forEach(m => merged.set(m.uuid, m));
            topPerPos[p] = Array.from(merged.values());
        }

        let bestRes = null;
        const posSplits = suitName === '散件' ? [[]] : COMBINATIONS_6_4;

        for (const suitPosArr of posSplits) {
            const suitSet = new Set(suitPosArr);
            const slotLists = {};
            let validSplit = true;
            for (let p = 1; p <= 6; p++) {
                if (suitSet.has(p)) {
                    slotLists[p] = candidatesByPos[p].filter(m => m.name === suitName).slice(0, 10);
                } else {
                    slotLists[p] = topPerPos[p].filter(m => matchTwoPieceCategory(m, twoPiece)).slice(0, 10);
                }
                if (slotLists[p].length === 0) {
                    validSplit = false;
                    break;
                }
            }
            if (!validSplit) continue;

            // 递归回溯 + 剪枝
            const maxSpdRem = [0, 0, 0, 0, 0, 0, 0, 0];
            for (let p = 6; p >= 1; p--) {
                const maxP = Math.max(...slotLists[p].map(m => m.totalSpeed));
                maxSpdRem[p] = maxSpdRem[p + 1] + maxP;
            }

            const chosen = {};
            function dfs(p, curSpd) {
                if (bestRes && curSpd + maxSpdRem[p] <= bestRes.totalSpeed) return;
                if (p > 6) {
                    const res = summarizeChoice({ ...chosen }, suitPosArr);
                    if (res.totalStats['暴击'] >= targetCrit) {
                        if (!bestRes || res.totalSpeed > bestRes.totalSpeed) {
                            bestRes = res;
                        }
                    }
                    return;
                }
                for (const m of slotLists[p]) {
                    chosen[p] = m;
                    dfs(p + 1, curSpd + m.totalSpeed);
                }
            }
            dfs(1, 0);
        }

        return bestRes || {
            valid: false,
            suitName,
            totalSpeed: 0,
            subSpeedTotal: 0,
            pieces: {},
            suitPositions: [],
            suitCounts: {},
            totalStats: { '速度': 0, '生命加成': 0, '防御加成': 0, '攻击加成': 0, '暴击': 0, '暴击伤害': 0, '效果命中': 0, '效果抵抗': 0 }
        };
    }

    /**
     * 连续独立拆分多套御魂方案（不重复使用御魂UUID）
     */
    function solveSequentialIndependentSets(schemeList) {
        const usedUuids = new Set();
        const results = [];
        for (const scheme of schemeList) {
            const res = solveSpeedScheme({
                ...scheme,
                excludedUuids: usedUuids
            });
            if (res && res.valid) {
                Object.values(res.pieces).forEach(m => {
                    if (m && m.uuid) usedUuids.add(m.uuid);
                });
            }
            results.push({
                schemeLabel: scheme.label || `${scheme.suitName} · ${scheme.pos2Main || '速'}${scheme.pos4Main === '不限' ? 'X' : scheme.pos4Main.slice(0, 1)}${scheme.pos6Main === '不限' ? 'X' : scheme.pos6Main.slice(0, 1)}`,
                schemeConfig: scheme,
                result: res
            });
        }
        return results;
    }

    // ==================== 8. PVE / PVP 输出面板优化求解引擎 ====================
    /**
     * 获取式神基础属性：优先从账号已拥有的 6星满级觉醒式神中提取真实基础属性，否则使用预设标准白值
     */
    function getShikigamiBaseStats(heroKey) {
        const preset = SHIKIGAMI_PRESETS[heroKey] || SHIKIGAMI_PRESETS.xueyuqian;
        const heroes = AppState.acctHighlight?.heroes || {};
        let ownedCount = 0;
        let maxStarOwned = 0;
        let realStats = null;

        for (const h of Object.values(heroes)) {
            if (!h) continue;
            if (h.heroId === preset.heroId || h.name === preset.name) {
                ownedCount++;
                if ((h.star || 0) > maxStarOwned) maxStarOwned = h.star || 0;
                if (h.star === 6 && h.level >= 40 && h.attrs && h.attrs['攻击']) {
                    const atk = parseFloat(h.attrs['攻击'].val);
                    const def = parseFloat(h.attrs['防御']?.val);
                    const hp = parseFloat(h.attrs['生命']?.val);
                    const spd = parseFloat(h.attrs['速度']?.val) + (h.awake === 1 && preset.baseSpd > parseFloat(h.attrs['速度']?.val) && parseFloat(h.attrs['速度']?.val) < 110 ? 10 : 0);
                    if (atk > 2500) {
                        realStats = {
                            baseAtk: atk,
                            baseDef: def || preset.baseDef,
                            baseHp: hp || preset.baseHp,
                            baseSpd: spd || preset.baseSpd,
                            baseCrit: preset.baseCrit,
                            baseCdmg: preset.baseCdmg,
                            isRealFromAccount: true
                        };
                    }
                }
            }
        }

        return {
            ...preset,
            ...(realStats || { isRealFromAccount: false }),
            ownedCount,
            maxStarOwned
        };
    }

    /**
     * 核心输出面板求解器：
     * 支持：
     * - 常规极限满暴输出 (`mode === 'atk_cdmg'`)
     * - 平将门攻击架势 (`mode === 'pjm_atk'`, 要求满暴且 `总攻击 > 总防御 * 7`)
     * - 平将门防守架势 (`mode === 'pjm_def'`, 要求满暴且 `总攻击 <= 总防御 * 7` 且 `总防御 >= minDef`，最大化输出与回血)
     */
    function solveOutputPanel(config = {}) {
        const {
            heroKey = 'xueyuqian',
            suit4 = '海月火玉',
            suit2 = '鬼灵歌伎',
            minSpd = 128,
            pos2Allowed = ['攻击加成'],
            pos4Allowed = ['攻击加成'],
            pos6Allowed = ['暴击', '暴击伤害'],
            mode = 'atk_cdmg',
            minDef = 1150,
            mult = 1.0,
            songHits = 0,
            excludedUuids = new Set(),
            _isFallback = false
        } = config;

        const cacheKey = excludedUuids.size === 0
            ? `${heroKey}|${suit4}|${suit2}|${minSpd}|${pos2Allowed.join(',')}|${pos4Allowed.join(',')}|${pos6Allowed.join(',')}|${mode}|${minDef}|${_isFallback ? 1 : 0}`
            : null;
        if (cacheKey && AppState.outputCache && AppState.outputCache.has(cacheKey)) {
            return AppState.outputCache.get(cacheKey);
        }

        const hero = getShikigamiBaseStats(heroKey);
        const { baseAtk, baseDef, baseHp, baseSpd, baseCrit, baseCdmg } = hero;
        const needSpdAdd = Math.max(0, (Number(minSpd) || 0) - baseSpd);
        const isDefMode = mode === 'pjm_def';
        const scoreFn = isDefMode ? (m => m.defHeuristic) : (m => m.outputHeuristic);

        function matchSuit2(m) {
            if (!suit2 || suit2 === '不限') return true;
            if (suit2 === '暴击两件套') return SUIT_CATEGORIES['暴击'].suits.includes(m.name);
            if (suit2 === '攻击两件套') return SUIT_CATEGORIES['攻击加成'].suits.includes(m.name);
            if (suit2 === '防御两件套') return SUIT_CATEGORIES['防御加成'].suits.includes(m.name);
            return m.name === suit2;
        }

        function toFastItem(m) {
            const main = m.mainAttr;
            const ts = m.totalSubstats;
            return {
                m,
                name: m.name,
                atkRate: (main.name === '攻击加成' ? main.val : 0) + (ts['攻击加成'] || 0),
                atkFlat: (main.name === '攻击' ? main.val : 0) + (ts['攻击'] || 0),
                defRate: (main.name === '防御加成' ? main.val : 0) + (ts['防御加成'] || 0),
                defFlat: (main.name === '防御' ? main.val : 0) + (ts['防御'] || 0),
                hpRate: (main.name === '生命加成' ? main.val : 0) + (ts['生命加成'] || 0),
                hpFlat: (main.name === '生命' ? main.val : 0) + (ts['生命'] || 0),
                crit: (main.name === '暴击' ? main.val : 0) + (ts['暴击'] || 0),
                cdmg: (main.name === '暴击伤害' ? main.val : 0) + (ts['暴击伤害'] || 0),
                spd: m.totalSpeed,
                hScore: scoreFn(m)
            };
        }

        // 严格限制每个位置最多 4 个帕累托最优候选（按综合输出、高暴击、高速度去重截取），杜绝组合爆炸
        function pickTopFast(list, maxCount = 4) {
            if (!list || list.length === 0) return [];
            if (list.length <= maxCount) return list.map(toFastItem).sort((a, b) => b.hScore - a.hScore);
            const byScore = [...list].sort((a, b) => scoreFn(b) - scoreFn(a)).slice(0, 2);
            const byCrit = [...list].sort((a, b) => (b.totalSubstats['暴击'] * 3.0 + scoreFn(b)) - (a.totalSubstats['暴击'] * 3.0 + scoreFn(a))).slice(0, 2);
            const bySpd = needSpdAdd > 0
                ? [...list].sort((a, b) => (b.totalSpeed * 3.5 + scoreFn(b)) - (a.totalSpeed * 3.5 + scoreFn(a))).slice(0, 2)
                : [];
            const merged = new Map();
            for (const m of [...byScore, ...byCrit, ...bySpd]) {
                if (!merged.has(m.uuid)) merged.set(m.uuid, m);
                if (merged.size >= maxCount) break;
            }
            return Array.from(merged.values()).map(toFastItem).sort((a, b) => b.hScore - a.hScore);
        }

        // 在 15 种拆分循环外一次性预提取各位置 suit4 与 suit2 候选池（提速 15 倍！）
        const suit4FastByPos = {};
        const suit2FastByPos = {};
        for (let p = 1; p <= 6; p++) {
            const rawList = (AppState.mitamaByPos[p] || []).filter(m => {
                if (excludedUuids.size > 0 && excludedUuids.has(m.uuid)) return false;
                if (m.qua < 6 || m.level < 15) return false;
                if (p === 2 && pos2Allowed.length && !pos2Allowed.includes(m.mainAttr.name)) return false;
                if (p === 4 && pos4Allowed.length && !pos4Allowed.includes(m.mainAttr.name)) return false;
                if (p === 6 && pos6Allowed.length && !pos6Allowed.includes(m.mainAttr.name)) return false;
                return true;
            });
            if (suit4 !== '散件') {
                if (p === 6) {
                    const s4All = rawList.filter(m => m.name === suit4);
                    const s4Cdmg = pickTopFast(s4All.filter(m => m.mainAttr.name === '暴击伤害'), 2);
                    const s4Crit = pickTopFast(s4All.filter(m => m.mainAttr.name === '暴击'), 2);
                    suit4FastByPos[p] = [...s4Cdmg, ...s4Crit];
                } else {
                    suit4FastByPos[p] = pickTopFast(rawList.filter(m => m.name === suit4), 4);
                }
            }
            if (p === 6) {
                const s2All = rawList.filter(m => matchSuit2(m));
                const s2Cdmg = pickTopFast(s2All.filter(m => m.mainAttr.name === '暴击伤害'), 2);
                const s2Crit = pickTopFast(s2All.filter(m => m.mainAttr.name === '暴击'), 2);
                suit2FastByPos[p] = [...s2Cdmg, ...s2Crit];
            } else {
                suit2FastByPos[p] = pickTopFast(rawList.filter(m => matchSuit2(m)), 4);
            }
        }

        let bestSolution = null;
        const splits = suit4 === '散件' ? [[]] : COMBINATIONS_6_4;
        const s4BonusObj = suit4 !== '散件' ? SUIT_TO_BONUS[suit4] : null;
        const s4AtkR = s4BonusObj?.attr === '攻击加成' ? s4BonusObj.val : 0;
        const s4DefR = s4BonusObj?.attr === '防御加成' ? s4BonusObj.val : 0;
        const s4HpR = s4BonusObj?.attr === '生命加成' ? s4BonusObj.val : 0;
        const s4Crit = s4BonusObj?.attr === '暴击' ? s4BonusObj.val : 0;
        const s4Cdmg = s4BonusObj?.attr === '暴击伤害' ? s4BonusObj.val : 0;
        const maxPossibleSetCrit = s4Crit + (suit2 === '不限' || suit2 === '暴击两件套' || SUIT_TO_BONUS[suit2]?.attr === '暴击' ? 15 : 0);

        for (const suitPosArr of splits) {
            const suitPosSet = new Set(suitPosArr);
            const fastSlots = {};
            const remPos = [];
            let possible = true;

            for (let p = 1; p <= 6; p++) {
                if (suitPosSet.has(p)) {
                    fastSlots[p] = suit4FastByPos[p];
                } else {
                    fastSlots[p] = suit2FastByPos[p];
                    remPos.push(p);
                }
                if (!fastSlots[p] || fastSlots[p].length === 0) {
                    possible = false;
                    break;
                }
            }
            if (!possible) continue;

            const rem1 = remPos[0] || 0;
            const rem2 = remPos[1] || 0;

            const maxCritRem = [0, 0, 0, 0, 0, 0, 0, 0];
            const maxSpdRem = [0, 0, 0, 0, 0, 0, 0, 0];
            for (let p = 6; p >= 1; p--) {
                let mc = 0, ms = 0;
                for (const x of fastSlots[p]) {
                    if (x.crit > mc) mc = x.crit;
                    if (x.spd > ms) ms = x.spd;
                }
                maxCritRem[p] = maxCritRem[p + 1] + mc;
                maxSpdRem[p] = maxSpdRem[p + 1] + ms;
            }

            const chosenFast = new Array(7);

            function dfs(p, accAtkR, accAtkF, accDefR, accDefF, accCrit, accCdmg, accSpd) {
                if (accSpd + maxSpdRem[p] + 1e-6 < needSpdAdd) return;
                if (baseCrit + accCrit + maxCritRem[p] + maxPossibleSetCrit + 1e-6 < 100) return;

                if (p > 6) {
                    let bonusAtkR = s4AtkR, bonusDefR = s4DefR, bonusHpR = s4HpR, bonusCrit = s4Crit, bonusCdmg = s4Cdmg;
                    if (rem1 && rem2) {
                        const n1 = chosenFast[rem1].name;
                        const n2 = chosenFast[rem2].name;
                        if (n1 === n2) {
                            const b2 = SUIT_TO_BONUS[n1];
                            if (b2) {
                                if (b2.attr === '攻击加成') bonusAtkR += b2.val;
                                else if (b2.attr === '防御加成') bonusDefR += b2.val;
                                else if (b2.attr === '生命加成') bonusHpR += b2.val;
                                else if (b2.attr === '暴击') bonusCrit += b2.val;
                                else if (b2.attr === '暴击伤害') bonusCdmg += b2.val;
                            }
                        } else if (suit2 && suit2 !== '不限') {
                            return;
                        }
                    }

                    const finalCrit = baseCrit + accCrit + bonusCrit;
                    if (finalCrit + 1e-5 < 100) return;

                    const finalAtk = baseAtk * (1 + (accAtkR + bonusAtkR) / 100) + accAtkF;
                    const finalDef = baseDef * (1 + (accDefR + bonusDefR) / 100) + accDefF;
                    const finalCdmg = baseCdmg + accCdmg + bonusCdmg;
                    const finalSpd = baseSpd + accSpd;
                    const atkDefRatio = finalAtk / Math.max(1, finalDef);

                    if (mode === 'pjm_def') {
                        if (finalAtk > finalDef * 7.0 || finalDef < minDef) return;
                    } else if (mode === 'pjm_atk') {
                        if (finalAtk <= finalDef * 7.0) return;
                    }

                    const rawPanel = finalAtk * (finalCdmg / 100);
                    const healCap = Math.min(finalDef * 5.0, finalAtk * 0.7);
                    const evalScore = mode === 'pjm_def' ? rawPanel + healCap * 1.25 : rawPanel;

                    if (!bestSolution || evalScore > bestSolution.evalScore) {
                        const pieces = {};
                        const counts = {};
                        let hpRateSum = bonusHpR, hpFlatSum = 0;
                        for (let i = 1; i <= 6; i++) {
                            pieces[i] = chosenFast[i].m;
                            counts[chosenFast[i].name] = (counts[chosenFast[i].name] || 0) + 1;
                            hpRateSum += chosenFast[i].hpRate;
                            hpFlatSum += chosenFast[i].hpFlat;
                        }
                        const finalHp = baseHp * (1 + hpRateSum / 100) + hpFlatSum;
                        const effectiveDmg = rawPanel * mult + (songHits > 0 ? songHits * 2.55 * finalAtk : 0);

                        bestSolution = {
                            valid: true,
                            heroKey,
                            heroName: hero.name,
                            isRealFromAccount: hero.isRealFromAccount,
                            suit4,
                            suit2,
                            mode,
                            finalAtk,
                            finalDef,
                            finalHp,
                            finalSpd,
                            finalCrit,
                            finalCdmg,
                            atkDefRatio,
                            healCap,
                            rawPanel,
                            panelWan: (rawPanel / 10000).toFixed(2),
                            effectiveDmg,
                            evalScore,
                            pieces,
                            suitPositions: suitPosArr,
                            suitCounts: counts
                        };
                    }
                    return;
                }

                const list = fastSlots[p];
                for (let i = 0; i < list.length; i++) {
                    const item = list[i];
                    chosenFast[p] = item;
                    dfs(
                        p + 1,
                        accAtkR + item.atkRate,
                        accAtkF + item.atkFlat,
                        accDefR + item.defRate,
                        accDefF + item.defFlat,
                        accCrit + item.crit,
                        accCdmg + item.cdmg,
                        accSpd + item.spd
                    );
                }
            }

            dfs(1, 0, 0, 0, 0, 0, 0, 0);
        }

        // 单层非递归智能降级（仅当顶层调用未找到解时触发一次）
        if (!bestSolution && !_isFallback) {
            if (mode === 'pjm_def' && minDef > 900) {
                bestSolution = solveOutputPanel({ ...config, minDef: 900, _isFallback: true });
            }
            if ((!bestSolution || !bestSolution.valid) && suit2 && !['不限', '暴击两件套'].includes(suit2)) {
                const fb = solveOutputPanel({ ...config, suit2: '不限', mult: config.mult ? Math.max(1.0, config.mult / 1.1) : 1.0, songHits: 0, _isFallback: true });
                if (fb && fb.valid) {
                    fb.fallbackNote = '首领两件套未满暴，已切换散件/暴击两件套满暴补位';
                    bestSolution = fb;
                }
            }
            if ((!bestSolution || !bestSolution.valid) && minSpd > 0) {
                const fbSpd = solveOutputPanel({ ...config, minSpd: 0, _isFallback: true });
                if (fbSpd && fbSpd.valid) {
                    fbSpd.fallbackNote = `未达${minSpd}速线，已展示不限速最高满暴面板(实速${fbSpd.finalSpd.toFixed(1)})`;
                    bestSolution = fbSpd;
                }
            }
        }

        const finalRes = bestSolution || {
            valid: false,
            heroKey,
            heroName: hero.name,
            isRealFromAccount: hero.isRealFromAccount,
            suit4,
            suit2,
            mode,
            finalAtk: baseAtk,
            finalDef: baseDef,
            finalHp: baseHp,
            finalSpd: baseSpd,
            finalCrit: baseCrit,
            finalCdmg: baseCdmg,
            atkDefRatio: baseAtk / baseDef,
            healCap: 0,
            rawPanel: 0,
            panelWan: '0.00',
            effectiveDmg: 0,
            pieces: {},
            suitPositions: [],
            suitCounts: {}
        };

        if (cacheKey && AppState.outputCache) AppState.outputCache.set(cacheKey, finalRes);
        return finalRes;
    }

    // ==================== 9. 御魂胚子与极品度深度统计分析 ====================
    function analyzeEmbryoAndQuality(parsedList) {
        const stats = {
            totalCount: parsedList.length,
            sixStarMaxCount: 0,
            unmaxedEmbryoCount: 0,
            // 初始腿数分布 (基于满级总条数: 9条=天生4腿满条, 8条=天生3腿, <=7条=瘸腿)
            fullLegs4Count: 0,
            threeLegsCount: 0,
            twoLegsCount: 0,
            // 速度胚子与成装分布
            pos2DualSpeedCount: 0,       // 二号位主属性速度 + 副属性带速度 (双速胚子/成装)
            pos2DualSpeed16Plus: 0,      // 二号位双速且副属性 >= 16
            speedRolls6Count: 0,         // 6次速度收益 (满速5跳)
            speedRolls5Count: 0,         // 5次速度收益 (4跳速度 13.5~15.5)
            speedRolls4Count: 0,         // 4次速度收益 (3跳速度 11~13.5)
            true17Count: 0,              // 副属性速度 >= 17.0
            spd165Count: 0,              // 副属性速度 >= 16.5
            // 输出有效属性胚子分布 (暴击+爆伤+攻击加成+速度)
            outputRolls9Count: 0,        // 9条全满有效输出神仙胚子
            outputRolls8Count: 0,        // 8条极品有效输出御魂
            outputRolls7Count: 0,        // 7条优秀有效输出御魂
            pos6CdmgHighCritCount: 0,    // 六号位爆伤主属性且副属性暴击>=11% (满暴爆伤胚子)
            // 辅助有效属性胚子分布 (速度+命中+抵抗+生命加成+防御加成)
            supportRolls9Count: 0,       // 9条全满有效辅助神仙胚子
            supportRolls8Count: 0,       // 8条极品有效辅助御魂
            pos4HitSpdCount: 0,          // 四号位主属性命中 + 副属性带速度&命中 (命速双修胚子)
            pos4ResSpdCount: 0,          // 四号位主属性抵抗 + 副属性带速度&抵抗 (抵速双修胚子)
            // 首领御魂高分件
            bossTotalCount: 0,
            bossHighScoreCount: 0,       // 首领御魂等效收益 >= 10分 (固有8% + 副属性有效>=7条)
            bossGodScoreCount: 0,        // 首领御魂等效收益 >= 11分 (固有8% + 副属性有效>=8条)
            // 分类明细列表（供前端点击筛选查看）
            lists: {
                dual_speed: [],
                full_speed_6: [],
                output_8plus: [],
                support_8plus: [],
                boss_high: [],
                crit_dmg_6: []
            }
        };

        for (const m of parsedList) {
            if (m.qua === 6 && m.level === 15) {
                stats.sixStarMaxCount++;
            } else if (m.qua === 6 && m.level < 15) {
                stats.unmaxedEmbryoCount++;
            }

            if (m.initialLegs >= 4 || m.totalRolls >= 9) stats.fullLegs4Count++;
            else if (m.initialLegs === 3 || m.totalRolls === 8) stats.threeLegsCount++;
            else stats.twoLegsCount++;

            // 二号位双速
            if (m.pos === 2 && m.mainAttr.name === '速度' && m.subSpeed > 0) {
                stats.pos2DualSpeedCount++;
                if (m.subSpeed >= 16) stats.pos2DualSpeed16Plus++;
                stats.lists.dual_speed.push(m);
            }

            // 速度跳数与档位
            const isFullSpd = m.speedRolls >= 6 || m.subSpeed >= 15.0;
            if (isFullSpd) {
                stats.speedRolls6Count++;
                stats.lists.full_speed_6.push(m);
            } else if (m.speedRolls === 5 || (m.subSpeed >= 13.0 && m.subSpeed < 15.0)) {
                stats.speedRolls5Count++;
            } else if (m.speedRolls === 4 || (m.subSpeed >= 10.5 && m.subSpeed < 13.0)) {
                stats.speedRolls4Count++;
            }

            if (m.subSpeed >= 17.0) stats.true17Count++;
            if (m.subSpeed >= 16.5) stats.spd165Count++;

            // 输出有效胚子
            if (m.outputRolls >= 9) stats.outputRolls9Count++;
            else if (m.outputRolls === 8) stats.outputRolls8Count++;
            else if (m.outputRolls === 7) stats.outputRolls7Count++;

            if (m.outputRolls >= 8) {
                stats.lists.output_8plus.push(m);
            }

            // 六号位爆伤反堆高暴击胚子
            if (m.pos === 6 && m.mainAttr.name === '暴击伤害' && m.totalSubstats['暴击'] >= 11) {
                stats.pos6CdmgHighCritCount++;
                stats.lists.crit_dmg_6.push(m);
            }

            // 辅助有效胚子
            if (m.supportRolls >= 9) stats.supportRolls9Count++;
            else if (m.supportRolls === 8) stats.supportRolls8Count++;

            if (m.supportRolls >= 8) {
                stats.lists.support_8plus.push(m);
            }

            if (m.pos === 4 && m.mainAttr.name === '效果命中' && m.subSpeed > 0 && m.totalSubstats['效果命中'] > 0) {
                stats.pos4HitSpdCount++;
            }
            if (m.pos === 4 && m.mainAttr.name === '效果抵抗' && m.subSpeed > 0 && m.totalSubstats['效果抵抗'] > 0) {
                stats.pos4ResSpdCount++;
            }

            // 首领御魂
            if (m.isBoss) {
                stats.bossTotalCount++;
                if (m.bossOutputScore >= 10 || (m.outputRolls >= 7 && m.singleAttr)) {
                    stats.bossHighScoreCount++;
                    if (m.bossOutputScore >= 11 || m.outputRolls >= 8) {
                        stats.bossGodScoreCount++;
                    }
                    stats.lists.boss_high.push(m);
                }
            }
        }

        // 排序各明细列表
        stats.lists.dual_speed.sort((a, b) => b.subSpeed - a.subSpeed);
        stats.lists.full_speed_6.sort((a, b) => b.subSpeed - a.subSpeed);
        stats.lists.output_8plus.sort((a, b) => b.outputRolls - a.outputRolls || b.outputHeuristic - a.outputHeuristic);
        stats.lists.support_8plus.sort((a, b) => b.supportRolls - a.supportRolls || b.subSpeed - a.subSpeed);
        stats.lists.boss_high.sort((a, b) => b.bossOutputScore - a.bossOutputScore || b.outputHeuristic - a.outputHeuristic);
        stats.lists.crit_dmg_6.sort((a, b) => b.totalSubstats['暴击'] - a.totalSubstats['暴击'] || b.outputRolls - a.outputRolls);

        return stats;
    }

    // ==================== 10. 账号资源、式神收集与外观汇总 ====================
    function extractAccountResources(equipDesc, equipOuter, heroHistory, seasonFrames) {
        const d = equipDesc || {};
        const blackDamo = d?.damo_count_dict?.[2]?.[411] ?? d?.damo_count_dict?.['411'] ?? 0;
        const whiteDamo = d?.damo_count_dict?.[2]?.[412] ?? d?.damo_count_dict?.['412'] ?? 0;
        const blueDamo = d?.damo_count_dict?.[2]?.[410] ?? d?.damo_count_dict?.['410'] ?? 0;
        const hunyu = d?.hunyu ?? d?.s_jade ?? 0;
        const gouyu = d?.goyu ?? d?.gouyu ?? d?.jade ?? 0;
        const coin = d?.money ?? d?.coin ?? 0;
        const strength = d?.strength ?? d?.ap ?? 0;
        const mysteryAmulet = d?.mystery_amulet ?? d?.amulet_num ?? d?.blue_ticket ?? 0;
        const goldScale = d?.currency_900217 ?? 0; // 大蛇的逆鳞
        const purpleScale = d?.currency_900216 ?? 0; // 八岐大蛇鳞片
        const fengmoSoul = d?.currency_900218 ?? 0; // 逢魔之魂
        const taigu6 = d?.lbscards?.[200036]?.num ?? 0; // 六星太鼓
        const douyu6 = d?.lbscards?.[200040]?.num ?? 0; // 六星斗鱼
        const sanshinei6 = d?.lbscards?.[200032]?.num ?? 0; // 六星伞室内

        // 皮肤分类解析
        const filterSkinByName = (arr, keyword) => {
            if (!Array.isArray(arr)) return [];
            return arr.filter(item => Array.isArray(item) && typeof item[1] === 'string' && item[1].includes(keyword))
                .map(item => item[1]);
        };

        const zhencangSkins = filterSkinByName(d?.skin?.ss, '臻藏');
        const diancangSkins = filterSkinByName(d?.skin?.ss, '典藏').filter(n => !n.includes('臻藏'));
        const cangjinBattle = filterSkinByName(d?.skin?.battle, '藏金台阁');
        const yardSkins = Array.isArray(d?.skin?.yard) ? d.skin.yard.map(x => Array.isArray(x) ? x[1] : String(x)) : [];
        const gambleSkins = Array.isArray(d?.skin?.gamble) ? d.skin.gamble.map(x => Array.isArray(x) ? x[1] : String(x)) : [];
        const shishenluSkins = Array.isArray(d?.skin?.shishenlu) ? d.skin.shishenlu.map(x => Array.isArray(x) ? x[1] : String(x)) : [];
        const battleSkins = Array.isArray(d?.skin?.battle) ? d.skin.battle.map(x => Array.isArray(x) ? x[1] : String(x)) : [];

        // 统计六星式神与核心式神持有情况
        const heroes = d?.heroes || {};
        let sixStarHeroCount = 0;
        const keyHeroNames = [
            '雪御前', '平将门', '天照', '须佐之男', '阿修罗', '神堕八岐大蛇',
            '因幡辉夜姬', '不见岳', '云间不见岳', '龙吟铃鹿御前', '瑶音紧那罗',
            '神启荒', '封阳君', '祸津神', '伊邪那美', '纺愿缘结神', '千姬', '帝释天', '空相面灵气'
        ];
        const keyHeroCounts = {};
        keyHeroNames.forEach(n => { keyHeroCounts[n] = 0; });

        Object.values(heroes).forEach(h => {
            if (!h) return;
            if (h.star === 6) sixStarHeroCount++;
            if (h.name && keyHeroCounts[h.name] !== undefined) {
                keyHeroCounts[h.name]++;
            }
            // 同时根据 heroId 匹配雪御前/平将门/天照/须佐/阿修罗/SP大蛇/烬天
            Object.values(SHIKIGAMI_PRESETS).forEach(p => {
                if (h.heroId === p.heroId && h.name !== p.name) {
                    keyHeroCounts[p.name] = (keyHeroCounts[p.name] || 0) + 1;
                }
            });
        });

        const priceYuan = equipOuter?.price ? (Number(equipOuter.price) / 100).toFixed(0) : (d?.price ? (Number(d.price) / 100).toFixed(0) : null);

        return {
            priceYuan,
            sellerName: equipOuter?.seller_name || '',
            sellerRoleId: equipOuter?.seller_roleid || '',
            gameOrdersn: equipOuter?.game_ordersn || '',
            serverName: equipOuter?.server_name || '',
            blackDamo,
            whiteDamo,
            blueDamo,
            hunyu,
            gouyu,
            coin,
            strength,
            mysteryAmulet,
            goldScale,
            purpleScale,
            fengmoSoul,
            taigu6,
            douyu6,
            sanshinei6,
            zhencangSkins,
            diancangSkins,
            cangjinBattle,
            yardSkins,
            gambleSkins,
            shishenluSkins,
            battleSkins,
            sixStarHeroCount,
            totalHeroCount: Object.keys(heroes).length,
            heroHistory: heroHistory || {},
            seasonFrames: seasonFrames || {},
            keyHeroCounts
        };
    }

    // ==================== 11. 汇总分析主入口 (`buildFullAnalytics`) ====================
    function ensureHeroOutputComputed(hKey, onlyHeadline = false) {
        if (!AppState.outputSummary) AppState.outputSummary = {};
        const existing = AppState.outputSummary[hKey];
        if (existing && (!onlyHeadline ? existing.fullComputed : true)) {
            return existing;
        }
        const preset = SHIKIGAMI_PRESETS[hKey];
        if (!preset) return null;
        const baseInfo = getShikigamiBaseStats(hKey);
        const schemesToRun = onlyHeadline
            ? preset.defaultSchemes.filter((_, idx) => idx === 0 || (hKey === 'pingjiangmen' && idx === 2))
            : preset.defaultSchemes;
        const schemeResults = preset.defaultSchemes.map((sc, idx) => {
            if (onlyHeadline && idx !== 0 && !(hKey === 'pingjiangmen' && idx === 2)) {
                return { schemeMeta: sc, solved: null };
            }
            const solved = solveOutputPanel({
                heroKey: hKey,
                suit4: sc.suit4,
                suit2: sc.suit2,
                minSpd: sc.minSpd,
                pos2Allowed: sc.pos2,
                pos4Allowed: sc.pos4,
                pos6Allowed: sc.pos6,
                mode: sc.mode,
                minDef: sc.minDef || 1150,
                mult: sc.mult || 1.0,
                songHits: sc.songHits || 0
            });
            return { schemeMeta: sc, solved };
        });
        const entry = { baseInfo, schemeResults, fullComputed: !onlyHeadline };
        AppState.outputSummary[hKey] = entry;
        return entry;
    }

    function ensureAllOutputsComputed() {
        Object.keys(SHIKIGAMI_PRESETS).forEach(hKey => ensureHeroOutputComputed(hKey, false));
    }

    function buildFullAnalytics(inventory, heroHistory, headSkinCount = {}, equipDesc = {}, equipOuter = {}) {
        const frameMap = window.YysHelperFrameConfig?.getSeasonFrameNames?.() || {};
        const seasonFrames = {};
        for (const [fId, fName] of Object.entries(frameMap)) {
            if (headSkinCount[fId]) seasonFrames[fName] = headSkinCount[fId];
        }

        // 1. 解析全量御魂
        const parsedList = [];
        const byPos = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
        const suitSet = new Set(PRIORITY_SPEED_SUITS);

        const fastest = {};
        const fullspd_cnt = {};
        const true17_cnt = {};
        const mainAttrs = {};
        const heads = [];
        const hit_feet = [];
        const resist_feet = [];

        for (let pos = 1; pos <= 8; pos++) {
            fastest[pos] = {};
            fullspd_cnt[pos] = {};
            true17_cnt[pos] = {};
            mainAttrs[pos] = {};
            PRIORITY_SPEED_SUITS.forEach(s => {
                fastest[pos][s] = 0;
                fullspd_cnt[pos][s] = 0;
                true17_cnt[pos][s] = 0;
                mainAttrs[pos][s] = '';
            });
        }

        Object.entries(inventory || {}).forEach(([uuid, rawM]) => {
            const m = parseSingleMitama(uuid, rawM);
            parsedList.push(m);
            if (byPos[m.pos]) byPos[m.pos].push(m);
            if (m.name) suitSet.add(m.name);

            // 兼容原插件速度统计口径
            if (m.speedRolls < 1 || (m.pos === 2 && m.totalSpeed < 57)) return;
            const isFullSpd = m.pos === 2 ? m.totalSpeed >= 72 : m.totalSpeed >= 15;
            const isTrue17 = m.pos === 2 ? m.totalSpeed >= 74 : m.totalSpeed >= 17;

            if (isFullSpd) {
                fullspd_cnt[m.pos][m.name] = (fullspd_cnt[m.pos][m.name] || 0) + 1;
                if (m.pos === 2) {
                    heads.push({ pos: 2, name: m.name, value: m.totalSpeed - 57, uuid: m.uuid, main: m.mainAttr.name });
                } else if (m.pos === 4 && m.mainAttr.name === '效果命中') {
                    fullspd_cnt[7][m.name] = (fullspd_cnt[7][m.name] || 0) + 1;
                    hit_feet.push({ pos: 4, name: m.name, value: m.totalSpeed, uuid: m.uuid });
                } else if (m.pos === 4 && m.mainAttr.name === '效果抵抗') {
                    fullspd_cnt[8][m.name] = (fullspd_cnt[8][m.name] || 0) + 1;
                    resist_feet.push({ pos: 4, name: m.name, value: m.totalSpeed, uuid: m.uuid });
                }
            }
            if (isTrue17) {
                true17_cnt[m.pos][m.name] = (true17_cnt[m.pos][m.name] || 0) + 1;
            }

            const mainName = m.mainAttr.name;
            if (!fastest[m.pos][m.name] || fastest[m.pos][m.name] < m.totalSpeed) {
                fastest[m.pos][m.name] = m.totalSpeed;
                mainAttrs[m.pos][m.name] = mainName;
            }
            if (fastest[m.pos]['散件'] < m.totalSpeed) {
                fastest[m.pos]['散件'] = m.totalSpeed;
                mainAttrs[m.pos]['散件'] = mainName;
            }
            if (m.pos === 4 && mainName === '效果命中') {
                if (!fastest[7][m.name] || fastest[7][m.name] < m.totalSpeed) {
                    fastest[7][m.name] = m.totalSpeed;
                    mainAttrs[7][m.name] = mainName;
                }
                if (fastest[7]['散件'] < m.totalSpeed) {
                    fastest[7]['散件'] = m.totalSpeed;
                    mainAttrs[7]['散件'] = mainName;
                }
            } else if (m.pos === 4 && mainName === '效果抵抗') {
                if (!fastest[8][m.name] || fastest[8][m.name] < m.totalSpeed) {
                    fastest[8][m.name] = m.totalSpeed;
                    mainAttrs[8][m.name] = mainName;
                }
                if (fastest[8]['散件'] < m.totalSpeed) {
                    fastest[8]['散件'] = m.totalSpeed;
                    mainAttrs[8]['散件'] = mainName;
                }
            }
        });

        for (let p = 1; p <= 6; p++) {
            byPos[p].sort((a, b) => b.totalSpeed - a.totalSpeed || b.outputRolls - a.outputRolls);
        }
        AppState.parsedMitamaList = parsedList;
        AppState.mitamaByPos = byPos;
        AppState.availableSuits = Array.from(suitSet);
        AppState.speedCache = new Map();
        AppState.outputCache = new Map();

        heads.sort((a, b) => b.value - a.value);
        hit_feet.sort((a, b) => b.value - a.value);
        resist_feet.sort((a, b) => b.value - a.value);

        AppState.summary = {
            heads,
            hit_feet,
            resist_feet,
            fastest,
            fullspd_cnt,
            true17_cnt,
            mainAttrs,
            hero_info: heroHistory,
            seasonFrames
        };

        // 2. 胚子与极品度统计
        AppState.embryoStats = analyzeEmbryoAndQuality(parsedList);

        // 3. 按需延迟计算（Lazy Evaluation）输出面板：首次加载仅计算顶部 KPI 所需的雪御前与平将门代表方案，完整 26 套方案在点击「输出面板」标签时毫秒级计算并缓存！
        AppState.outputSummary = {};
        ensureHeroOutputComputed('xueyuqian', true);
        ensureHeroOutputComputed('pingjiangmen', true);

        // 4. 提取账号资源与收集信息
        AppState.resourceSummary = extractAccountResources(equipDesc, equipOuter, heroHistory, seasonFrames);
        AppState.ready = true;
    }

    // ==================== 12. 数据拦截与缓存处理 ====================
    function processEquipResponse(rawResponse) {
        if (!rawResponse || !rawResponse.equip || !rawResponse.equip.equip_desc) return rawResponse;
        const equip = rawResponse.equip;
        const equipDesc = typeof equip.equip_desc === 'string' ? JSON.parse(equip.equip_desc) : equip.equip_desc;
        const inventory = equipDesc.inventory || {};
        const heroes = equipDesc.heroes || {};
        const heroHistory = equipDesc.hero_history || {};
        const headSkinCount = equipDesc.head_skin_count || {};

        try {
            AppState.latest = {
                name: equip.seller_name,
                roleid: equip.seller_roleid,
                ordersn: equip.game_ordersn,
                mitama_list: inventory
            };
            AppState.equipMeta = equip;
            AppState.acctHighlight = equipDesc;
        } catch (e) {
            console.error('[yyscbghelper] 保存账号基础信息出错:', e);
        }

        // 先执行全量深度分析（使用未被格式化修改的原始 inventory）
        buildFullAnalytics(inventory, heroHistory, headSkinCount, equipDesc, equip);

        return rawResponse;
    }

    function cacheJsonData(rawResponse, rawByteLength = 0) {
        try {
            const ordersn = rawResponse?.equip?.game_ordersn || '';
            if (window.YYS_CACHED_JSON_DATA) {
                const prevSn = window.YYS_CACHED_JSON_DATA.accountInfo?.game_ordersn || '';
                if (prevSn && prevSn === ordersn) return;
            }
            const approxLen = rawByteLength || (rawResponse?.equip?.equip_desc?.length || 0);
            const cacheObj = {
                data: rawResponse,
                timestamp: Date.now(),
                url: window.location.href,
                rawByteLength: approxLen,
                accountInfo: {
                    seller_name: rawResponse?.equip?.seller_name || '',
                    seller_roleid: rawResponse?.equip?.seller_roleid || '',
                    game_ordersn: ordersn
                }
            };
            window.YYS_CACHED_JSON_DATA = cacheObj;
            try {
                localStorage.setItem('yys_json_basic_info', JSON.stringify({
                    accountInfo: cacheObj.accountInfo,
                    timestamp: cacheObj.timestamp,
                    url: cacheObj.url,
                    dataSize: (approxLen / 1024).toFixed(2)
                }));
            } catch (e) {}
            console.log(`[yyscbghelper] ✅ 已缓存JSON数据到内存 [订单号: ${ordersn}]`);
        } catch (e) {
            console.error('[yyscbghelper] ❌ 缓存数据时出错:', e);
        }
    }

    // 拦截 XMLHttpRequest
    const origSend = window.XMLHttpRequest.prototype.send;
    window.XMLHttpRequest.prototype.send = function (body) {
        if (this._url && this._url.includes(API_EQUIP_DETAIL)) {
            try {
                const params = new URLSearchParams(body);
                params.delete('exclude_equip_desc');
                body = params.toString();
            } catch (e) {
                console.error('[yyscbghelper] 修改请求参数时出错:', e);
            }
        }
        return origSend.apply(this, [body]);
    };

    const origOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (method, url) {
        const xhr = this;
        xhr._url = url;
        if (typeof url === 'string' && url.indexOf(API_EQUIP_DETAIL) > -1) {
            let handled = false;
            xhr.addEventListener('readystatechange', function () {
                if (xhr.readyState === 4 && xhr.status === 200 && !handled) {
                    handled = true;
                    // 异步非阻塞处理，绝不阻塞藏宝阁原网页渲染与打开速度！
                    const rawText = xhr.responseText;
                    setTimeout(function () {
                        try {
                            const rawJson = JSON.parse(rawText);
                            cacheJsonData(rawJson, rawText.length);
                            const processed = processEquipResponse(rawJson);
                            window.YYS_PROCESSED_DATA = processed;
                            console.log('%c[yyscbghelper] ⚡ 非阻塞极速分析完成', 'color: #10b981; font-weight: bold;');
                            window.dispatchEvent(new CustomEvent('yys-data-ready', {
                                detail: { original: rawJson, processed }
                            }));
                        } catch (e) {
                            console.error('[yyscbghelper] 处理响应数据时出错:', e);
                        }
                    }, 30);
                }
            }, false);
        }
        return origOpen.apply(xhr, arguments);
    };

    // ==================== 13. 导出、缓存与多账号对比管理 ====================
    function exportRawJsonFile() {
        try {
            const cache = window.YYS_CACHED_JSON_DATA;
            if (!cache) {
                alert('❌ 暂无缓存数据！\n\n请先打开一个账号详情页面，等待数据加载后再导出。');
                return;
            }
            const info = cache.accountInfo || {};
            const fileName = `yys_raw_${info.game_ordersn || 'unknown'}_${Date.now()}.json`;
            const jsonStr = JSON.stringify(cache.data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('❌ 导出失败：' + e.message);
        }
    }

    function exportYuhunOcrJsonFile() {
        if (AppState.latest && AppState.latest.mitama_list) {
            const list = Object.values(AppState.latest.mitama_list).map(convertToYuhunOcrFormat);
            list.unshift('yuhun_ocr2.0');
            const blob = new Blob([JSON.stringify(list)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const sn = AppState.latest.ordersn || 'account';
            a.href = url;
            a.download = `yuhun_${sn}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            alert('暂无御魂数据可保存，请先等待账号详情加载完成。');
        }
    }

    function showCacheInfoAlert() {
        const cache = window.YYS_CACHED_JSON_DATA;
        if (!cache) {
            alert('❌ 暂无缓存数据！');
            return;
        }
        const info = cache.accountInfo || {};
        const timeStr = new Date(cache.timestamp).toLocaleString('zh-CN');
        const rawStr = JSON.stringify(cache.data);
        const kb = (rawStr.length / 1024).toFixed(2);
        const mb = (rawStr.length / 1024 / 1024).toFixed(2);
        alert(
            `📦 缓存数据信息\n\n` +
            `账号名称: ${info.seller_name || '未知'}\n` +
            `角色ID: ${info.seller_roleid || '未知'}\n` +
            `订单号: ${info.game_ordersn || '未知'}\n` +
            `御魂数量: ${AppState.parsedMitamaList.length} 个\n` +
            `缓存时间: ${timeStr}\n` +
            `数据大小: ${kb} KB (${mb} MB)\n` +
            `来源URL: ${cache.url || '未知'}`
        );
    }

    // 多账号横向对比存储管理
    function loadCompareAccounts() {
        try {
            const raw = localStorage.getItem(COMPARE_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveCompareAccounts(list) {
        try {
            localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(list));
            return true;
        } catch (e) {
            console.error('[yyscbghelper] 保存对比列表失败:', e);
            return false;
        }
    }

    function buildAccountSnapshotForCompare() {
        if (!AppState.ready) return null;
        const res = AppState.resourceSummary || {};
        const emb = AppState.embryoStats || {};
        const san1 = solveSpeedScheme({ suitName: '散件', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' });
        const zc1 = solveSpeedScheme({ suitName: '招财猫', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' });
        const hl1 = solveSpeedScheme({ suitName: '火灵', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' });
        const bj1 = solveSpeedScheme({ suitName: '蚌精', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' });
        const zcHpHp = solveSpeedScheme({ suitName: '招财猫', pos2Main: '速度', pos4Main: '生命加成', pos6Main: '生命加成' });

        // 独立二速、三速
        const indepSan = solveSequentialIndependentSets([
            { suitName: '散件', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' },
            { suitName: '散件', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' },
            { suitName: '散件', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' }
        ]);

        ensureHeroOutputComputed('tianzhao', true);
        ensureHeroOutputComputed('xuzuozhinan', true);
        const xyqBest = AppState.outputSummary?.xueyuqian?.schemeResults?.[0]?.solved?.rawPanel || 0;
        const pjmDefBest = AppState.outputSummary?.pingjiangmen?.schemeResults?.[0]?.solved?.rawPanel || 0;
        const pjmAtkBest = AppState.outputSummary?.pingjiangmen?.schemeResults?.[2]?.solved?.rawPanel || 0;
        const tzBest = AppState.outputSummary?.tianzhao?.schemeResults?.[0]?.solved?.rawPanel || 0;
        const xzBest = AppState.outputSummary?.xuzuozhinan?.schemeResults?.[0]?.solved?.rawPanel || 0;

        return {
            id: res.gameOrdersn || `acc_${Date.now()}`,
            addedAt: Date.now(),
            url: window.location.href,
            sellerName: res.sellerName || '未知卖家',
            serverName: res.serverName || '',
            priceYuan: res.priceYuan || '-',
            sanSpeed1: Number(san1.totalSpeed.toFixed(2)),
            sanSpeed2: Number((indepSan[1]?.result?.totalSpeed || 0).toFixed(2)),
            sanSpeed3: Number((indepSan[2]?.result?.totalSpeed || 0).toFixed(2)),
            zhaocaiSpeed: Number(zc1.totalSpeed.toFixed(2)),
            huolingSpeed: Number(hl1.totalSpeed.toFixed(2)),
            bangjingSpeed: Number(bj1.totalSpeed.toFixed(2)),
            zcHpHpSpeed: Number(zcHpHp.totalSpeed.toFixed(2)),
            fullSpdCount: emb.speedRolls6Count || 0,
            true17Count: emb.true17Count || 0,
            dualSpdCount: emb.pos2DualSpeedCount || 0,
            fullLegs4Count: emb.fullLegs4Count || 0,
            output8PlusCount: (emb.outputRolls9Count || 0) + (emb.outputRolls8Count || 0),
            bossHighCount: emb.bossHighScoreCount || 0,
            xyqPanel: Math.round(xyqBest),
            pjmDefPanel: Math.round(pjmDefBest),
            pjmAtkPanel: Math.round(pjmAtkBest),
            tzPanel: Math.round(tzBest),
            xzPanel: Math.round(xzBest),
            blackDamo: res.blackDamo || 0,
            hunyu: res.hunyu || 0,
            gouyu: res.gouyu || 0,
            zhencangCount: (res.zhencangSkins || []).length,
            yardSkinCount: (res.yardSkins || []).length,
            sixStarHeroes: res.sixStarHeroCount || 0
        };
    }

    function addCurrentAccountToCompare() {
        const snap = buildAccountSnapshotForCompare();
        if (!snap) {
            alert('❌ 当前账号数据尚未加载完成，请稍后再试。');
            return false;
        }
        const list = loadCompareAccounts();
        const idx = list.findIndex(x => x.id === snap.id);
        if (idx >= 0) {
            list[idx] = snap;
        } else {
            list.push(snap);
        }
        saveCompareAccounts(list);
        updateCompareButtonBadge();
        return true;
    }

    function updateCompareButtonBadge() {
        const btn = document.getElementById('cbghelper-btn-open-compare');
        if (btn) {
            const count = loadCompareAccounts().length;
            btn.textContent = `📊 对比篮 (${count})`;
        }
    }

    // ==================== 14. 手动请求获取数据 ====================
    function extractParamsFromUrl() {
        const href = window.location.href;
        const m = href.match(/\/equip\/(\d+)\/([\w-]+)/);
        if (!m) return null;
        const sp = new URLSearchParams(window.location.search);
        return {
            serverid: m[1],
            ordersn: m[2],
            view_loc: sp.get('view_loc') || '',
            refer_sn: sp.get('refer_sn') || ''
        };
    }

    async function manualFetchEquipData(silent = false) {
        const btn = document.getElementById('cbghelper_manual_fetch');
        if (btn) {
            btn.textContent = '⏳ 获取中...';
            btn.style.pointerEvents = 'none';
        }
        try {
            const p = extractParamsFromUrl();
            if (!p) {
                if (!silent) alert('❌ 无法从当前URL提取服务器与订单参数，请确认在藏宝阁账号详情页。');
                return false;
            }
            const traceId = '019A' + Date.now().toString(16).toUpperCase().slice(-12) + '-' + Math.random().toString(36).substring(2, 15).toUpperCase();
            const bodyParams = new URLSearchParams({
                serverid: p.serverid,
                ordersn: p.ordersn,
                h5_device: 'other',
                app_client: 'other',
                view_loc: p.view_loc,
                exter: 'direct',
                page_session_id: traceId,
                traffic_trace: JSON.stringify({ field_id: 'f_reco_home', content_id: 'c_reco_home' }),
                refer_sn: p.refer_sn
            });
            const resp = await fetch('https://yys.cbg.163.com/cgi/api/get_equip_detail?client_type=h5', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: bodyParams.toString()
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const json = await resp.json();
            cacheJsonData(json);
            processEquipResponse(json);
            renderMainDashboard(true);
            renderTopHighlightTags(true);
            return true;
        } catch (e) {
            if (!silent) alert('❌ 手动获取数据失败：' + e.message);
            return false;
        } finally {
            if (btn) {
                btn.textContent = '🔄 刷新数据';
                btn.style.pointerEvents = 'auto';
            }
        }
    }

    // ==================== 15. 顶部藏宝阁原生高亮标签注入 ====================
    function renderTopHighlightTags(forceReRender = false) {
        if (!AppState.ready || !AppState.resourceSummary) return;
        const existing = document.getElementById('cbghelper_exthighlight');
        if (existing && !forceReRender) return;

        const highlightList = document.getElementsByClassName('highlight');
        if (!highlightList || !highlightList[0]) return;
        const ul = highlightList[0];

        if (forceReRender) {
            ul.querySelectorAll('.cbghelper-hl-tag').forEach(el => el.remove());
            if (existing) existing.remove();
        }

        const res = AppState.resourceSummary;
        const emb = AppState.embryoStats;
        const tags = [];

        for (const [fName, cnt] of Object.entries(res.seasonFrames || {})) {
            if (cnt > 0) tags.push(`🏆 ${fName}×${cnt}`);
        }
        const hInfo = res.heroHistory;
        if (hInfo?.ssr && hInfo?.sp) {
            if (hInfo.ssr.all + hInfo.sp.all === hInfo.ssr.got + hInfo.sp.got) {
                tags.push('🌟 SSR/SP全收集');
            } else if (hInfo.ssr.all === hInfo.ssr.got) {
                tags.push('🌟 SSR全收集');
            }
        }
        if (emb?.speedRolls6Count > 0) tags.push(`⚡ 满速${emb.speedRolls6Count}颗 (真17×${emb.true17Count})`);
        if (res.blackDamo >= 10) tags.push(`🎱 御行达摩${formatWan(res.blackDamo)}个`);
        if (res.hunyu >= 30) tags.push(`💎 魂玉${formatWan(res.hunyu)}`);
        if (res.taigu6 >= 20) tags.push(`🥁 太鼓${formatWan(res.taigu6)}个`);
        if (res.zhencangSkins.length > 0) tags.push(`👑 臻藏皮肤${res.zhencangSkins.length}个`);
        if (res.cangjinBattle.length > 0) tags.push(`🏯 藏金台阁`);
        if (res.yardSkins.length > 0) tags.push(`🌸 庭院皮肤${res.yardSkins.length}个`);
        if (res.goldScale >= 5000) tags.push(`🐍 金逆鳞${formatWan(res.goldScale)}`);
        if (res.fengmoSoul >= 1000) tags.push(`🔥 逢魔之魂${formatWan(res.fengmoSoul)}`);

        tags.forEach(text => {
            const li = document.createElement('li');
            li.className = 'cbghelper-hl-tag';
            li.textContent = text;
            ul.appendChild(li);
        });

        const marker = document.createElement('span');
        marker.id = 'cbghelper_exthighlight';
        marker.style.display = 'none';
        ul.appendChild(marker);
    }

    // ==================== 16. UI 样式注入 (现代和风暗金/星夜蓝紫卡片式设计) ====================
    function injectStyles() {
        if (document.getElementById('cbghelper-v2-styles')) return;
        const style = document.createElement('style');
        style.id = 'cbghelper-v2-styles';
        style.textContent = `
            #cbghelper_highlight {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
                color: #1e293b;
                background: #f8fafc;
                border-radius: 12px;
                border: 1px solid #e2e8f0;
                box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);
                margin: 10px 0 16px 0;
                overflow: hidden;
            }
            /* 顶部品牌与快捷操作栏 */
            .cbgh-topbar {
                background: linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #4338ca 100%);
                color: #ffffff;
                padding: 12px 16px;
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
                border-bottom: 2px solid #fbbf24;
            }
            .cbgh-brand {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .cbgh-brand-title {
                font-size: 16px;
                font-weight: 700;
                letter-spacing: 0.5px;
                color: #fef3c7;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .cbgh-brand-badge {
                background: rgba(251, 191, 36, 0.2);
                border: 1px solid #fbbf24;
                color: #fde68a;
                font-size: 11px;
                padding: 2px 7px;
                border-radius: 999px;
                font-weight: 600;
            }
            .cbgh-toolbar {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                align-items: center;
            }
            .cbgh-action-btn {
                background: rgba(255, 255, 255, 0.14);
                color: #ffffff;
                border: 1px solid rgba(255, 255, 255, 0.25);
                padding: 5px 10px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
            }
            .cbgh-action-btn:hover {
                background: rgba(255, 255, 255, 0.26);
                transform: translateY(-1px);
            }
            .cbgh-action-btn.gold {
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                border-color: #fbbf24;
                color: #fff;
            }
            .cbgh-action-btn.emerald {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                border-color: #34d399;
                color: #fff;
            }
            /* 核心指标速览横幅 */
            .cbgh-kpi-strip {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
                gap: 8px;
                padding: 12px 14px;
                background: #ffffff;
                border-bottom: 1px solid #e2e8f0;
            }
            .cbgh-kpi-card {
                background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 8px 10px;
                text-align: center;
            }
            .cbgh-kpi-label {
                font-size: 11px;
                color: #64748b;
                margin-bottom: 3px;
            }
            .cbgh-kpi-val {
                font-size: 16px;
                font-weight: 800;
                color: #0f172a;
            }
            .cbgh-kpi-sub {
                font-size: 10px;
                color: #6366f1;
                margin-top: 2px;
                font-weight: 600;
            }
            /* 主导航标签栏 */
            .cbgh-nav-tabs {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                padding: 8px 14px 0 14px;
                background: #f1f5f9;
                border-bottom: 1px solid #cbd5e1;
            }
            .cbgh-nav-tab {
                padding: 8px 14px;
                font-size: 13px;
                font-weight: 700;
                color: #475569;
                background: transparent;
                border: 1px solid transparent;
                border-bottom: none;
                border-radius: 8px 8px 0 0;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .cbgh-nav-tab:hover {
                color: #1e1b4b;
                background: rgba(255, 255, 255, 0.6);
            }
            .cbgh-nav-tab.active {
                color: #4338ca;
                background: #ffffff;
                border-color: #cbd5e1;
                box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.03);
            }
            /* 内容面板 */
            .cbgh-tab-body {
                padding: 14px;
                background: #ffffff;
            }
            .cbgh-section-card {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 12px 14px;
                margin-bottom: 14px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
            }
            .cbgh-section-header {
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                padding-bottom: 8px;
                margin-bottom: 10px;
                border-bottom: 2px solid #f1f5f9;
            }
            .cbgh-section-title {
                font-size: 14px;
                font-weight: 700;
                color: #1e293b;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .cbgh-section-desc {
                font-size: 11px;
                color: #64748b;
            }
            /* 表格通用美化 */
            .cbgh-table-wrap {
                overflow-x: auto;
            }
            .cbgh-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
            }
            .cbgh-table th {
                background: #f8fafc;
                color: #475569;
                font-weight: 700;
                padding: 6px 8px;
                border-bottom: 2px solid #e2e8f0;
                text-align: center;
                white-space: nowrap;
            }
            .cbgh-table td {
                padding: 6px 8px;
                border-bottom: 1px solid #f1f5f9;
                text-align: center;
                vertical-align: middle;
            }
            .cbgh-table tr:hover td {
                background: #f8fafc;
            }
            .cbgh-clickable-row {
                cursor: pointer;
            }
            .cbgh-clickable-row:hover td {
                background: #eef2ff !important;
            }
            /* 交互式选择器与预设按钮 */
            .cbgh-preset-bar {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-bottom: 10px;
            }
            .cbgh-pill-btn {
                padding: 5px 10px;
                border-radius: 6px;
                border: 1px solid #cbd5e1;
                background: #f8fafc;
                color: #334155;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .cbgh-pill-btn:hover {
                border-color: #6366f1;
                color: #4338ca;
                background: #eef2ff;
            }
            .cbgh-pill-btn.active {
                background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
                color: #ffffff;
                border-color: #4338ca;
                box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);
            }
            .cbgh-filter-row {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                align-items: center;
                background: #f8fafc;
                padding: 10px;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
                margin-bottom: 12px;
            }
            .cbgh-filter-item {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                color: #475569;
                font-weight: 600;
            }
            .cbgh-select {
                padding: 4px 8px;
                border-radius: 6px;
                border: 1px solid #cbd5e1;
                background: #ffffff;
                font-size: 12px;
                color: #1e293b;
                font-weight: 600;
            }
            /* 1~6号位御魂详情六宫格 */
            .cbgh-slot-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
                gap: 8px;
                margin-top: 10px;
            }
            .cbgh-slot-card {
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 9px 10px;
                background: #ffffff;
                position: relative;
                transition: all 0.15s;
            }
            .cbgh-slot-card.is-suit {
                border-left: 4px solid #4f46e5;
                background: linear-gradient(180deg, #fafaff 0%, #ffffff 100%);
            }
            .cbgh-slot-card.is-sanjian {
                border-left: 4px solid #f59e0b;
            }
            .cbgh-slot-top {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
            }
            .cbgh-slot-title {
                font-weight: 700;
                font-size: 12px;
                color: #1e293b;
            }
            .cbgh-slot-badge {
                font-size: 10px;
                padding: 1px 5px;
                border-radius: 4px;
                font-weight: 600;
            }
            .cbgh-slot-badge.suit {
                background: #e0e7ff;
                color: #4338ca;
            }
            .cbgh-slot-badge.sub {
                background: #fef3c7;
                color: #b45309;
            }
            .cbgh-slot-main {
                font-size: 11px;
                font-weight: 700;
                color: #0f172a;
                background: #f1f5f9;
                padding: 3px 6px;
                border-radius: 4px;
                margin-bottom: 5px;
            }
            .cbgh-slot-subs {
                font-size: 11px;
                color: #475569;
                line-height: 1.5;
            }
            .cbgh-slot-subs .hl-spd {
                color: #dc2626;
                font-weight: 700;
            }
            .cbgh-slot-subs .hl-crit {
                color: #d97706;
                font-weight: 700;
            }
            .cbgh-summary-banner {
                background: linear-gradient(90deg, #eef2ff 0%, #f8fafc 100%);
                border: 1px solid #c7d2fe;
                border-radius: 8px;
                padding: 8px 12px;
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                font-size: 12px;
            }
            /* 输出式神专项卡片 */
            .cbgh-hero-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
                gap: 12px;
                margin-bottom: 12px;
            }
            .cbgh-hero-card {
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                overflow: hidden;
                background: #fff;
            }
            .cbgh-hero-header {
                padding: 10px 12px;
                background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                color: #fff;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .cbgh-hero-header.xueyuqian {
                background: linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%);
            }
            .cbgh-hero-header.pingjiangmen {
                background: linear-gradient(135deg, #b91c1c 0%, #d97706 100%);
            }
            /* 胚子定义说明盒 */
            .cbgh-guide-box {
                background: #fffbeb;
                border: 1px solid #fde68a;
                border-left: 4px solid #f59e0b;
                border-radius: 8px;
                padding: 10px 12px;
                font-size: 12px;
                color: #78350f;
                line-height: 1.6;
                margin-bottom: 12px;
            }
            /* 模态弹窗（对比弹窗 & 配色设置弹窗） */
            .cbgh-modal-backdrop {
                display: none;
                position: fixed;
                z-index: 99999;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background: rgba(15, 23, 42, 0.6);
                backdrop-filter: blur(2px);
            }
            .cbgh-modal-box {
                background: #ffffff;
                margin: 4vh auto;
                padding: 18px 20px;
                width: 92%;
                max-width: 1050px;
                max-height: 88vh;
                overflow-y: auto;
                border-radius: 12px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // ==================== 17. 渲染四大核心功能模块 HTML ====================

    // 渲染 1~6 号位具体御魂搭配六宫格
    function renderMitamaSlotGrid(pieces, suitPositions = [], mode = 'speed') {
        const suitSet = new Set(suitPositions || []);
        const cards = [];
        for (let p = 1; p <= 6; p++) {
            const m = pieces ? pieces[p] : null;
            if (!m) {
                cards.push(`
                    <div class="cbgh-slot-card">
                        <div class="cbgh-slot-top">
                            <span class="cbgh-slot-title">${p}号位 · 空缺</span>
                        </div>
                        <div style="color:#94a3b8;font-size:11px;padding:12px 0;">未找到符合主属性要求的御魂</div>
                    </div>
                `);
                continue;
            }
            const isSuitSlot = suitSet.has(p);
            const subLines = [];
            Object.entries(m.subStats).forEach(([k, v]) => {
                if (!v || v <= 0) return;
                const rCnt = m.rolls[k] || 1;
                const valStr = PERCENT_ATTR_NAMES.has(k) ? `${v.toFixed(2)}%` : v.toFixed(2);
                let cls = '';
                if (k === '速度') cls = 'hl-spd';
                else if (k === '暴击' || k === '暴击伤害') cls = 'hl-crit';
                subLines.push(`<span class="${cls}">${k} +${valStr} <small style="color:#94a3b8;">(${rCnt}跳)</small></span>`);
            });
            if (m.singleAttr) {
                subLines.unshift(`<span style="color:#7c3aed;font-weight:700;">[固有] ${m.singleAttr.name} +${m.singleAttr.val}%</span>`);
            }

            const mainValStr = PERCENT_ATTR_NAMES.has(m.mainAttr.name) ? `${m.mainAttr.val}%` : m.mainAttr.val;
            const badgeText = suitPositions.length === 0 ? '散件最优' : (isSuitSlot ? '四件套' : '二件套/散件');
            const badgeCls = isSuitSlot ? 'suit' : 'sub';

            cards.push(`
                <div class="cbgh-slot-card ${isSuitSlot ? 'is-suit' : 'is-sanjian'}">
                    <div class="cbgh-slot-top">
                        <span class="cbgh-slot-title">${p}号位 · ${escapeHtml(m.name)}</span>
                        <span class="cbgh-slot-badge ${badgeCls}">${badgeText}</span>
                    </div>
                    <div class="cbgh-slot-main">
                        主属性：${escapeHtml(m.mainAttr.name)} +${mainValStr}
                        ${m.subSpeed > 0 ? `<span style="float:right;color:${getSingleSpeedColor(m.subSpeed)};">副速 +${m.subSpeed.toFixed(2)}</span>` : ''}
                    </div>
                    <div class="cbgh-slot-subs">
                        ${subLines.join('<br/>') || '<span style="color:#94a3b8;">无有效副属性</span>'}
                    </div>
                    <div style="margin-top:4px;padding-top:4px;border-top:1px dashed #e2e8f0;font-size:10px;color:#64748b;display:flex;justify-content:space-between;">
                        <span>初始${m.initialLegs}腿 (总${m.totalRolls}条)</span>
                        <span>${mode === 'output' ? `输出有效: <b>${m.outputRolls}</b>条` : `辅助有效: <b>${m.supportRolls}</b>条`}</span>
                    </div>
                </div>
            `);
        }
        return `<div class="cbgh-slot-grid">${cards.join('')}</div>`;
    }

    // ---------- Tab 1: PVP 一速与御魂配装拆分 ----------
    function renderTabPvpSpeed() {
        const sum = AppState.summary;
        const emb = AppState.embryoStats;
        if (!sum || !emb) return '';

        // 1. 各位置满速 / 真17 / 5跳速统计表
        const posSpdStats = { full: {}, true17: {}, spd165: {}, roll5: {} };
        let totFull = 0, tot17 = 0, tot165 = 0, totRoll5 = 0;
        for (let p = 1; p <= 6; p++) {
            const list = AppState.mitamaByPos[p] || [];
            posSpdStats.full[p] = list.filter(m => m.speedRolls >= 6 || m.subSpeed >= 15).length;
            posSpdStats.true17[p] = list.filter(m => m.subSpeed >= 17.0).length;
            posSpdStats.spd165[p] = list.filter(m => m.subSpeed >= 16.5).length;
            posSpdStats.roll5[p] = list.filter(m => !((m.speedRolls >= 6 || m.subSpeed >= 15)) && (m.speedRolls === 5 || m.subSpeed >= 13.5)).length;
            totFull += posSpdStats.full[p];
            tot17 += posSpdStats.true17[p];
            tot165 += posSpdStats.spd165[p];
            totRoll5 += posSpdStats.roll5[p];
        }

        const formatHeadList = (arr) => arr.length > 0
            ? arr.map(x => `<span style="display:inline-block;margin:2px 4px;padding:2px 7px;border-radius:4px;background:#f8fafc;border:1px solid #e2e8f0;color:${getSingleSpeedColor(x.value)};font-weight:700;">${escapeHtml(x.name)}: ${x.value.toFixed(2)}</span>`).join('')
            : '<span style="color:#94a3b8;">无满速件</span>';

        // 2. 交互式御魂方案自选工作台计算：同时算第1套（一速）、第2套（独立二速）、第3套（独立三速）
        const sel = AppState.schemeSelector;
        const threeIndependentSets = solveSequentialIndependentSets([
            { suitName: sel.suitName, pos2Main: sel.pos2Main, pos4Main: sel.pos4Main, pos6Main: sel.pos6Main, twoPiece: sel.twoPiece, fullCrit: sel.fullCrit },
            { suitName: sel.suitName, pos2Main: sel.pos2Main, pos4Main: sel.pos4Main, pos6Main: sel.pos6Main, twoPiece: sel.twoPiece, fullCrit: sel.fullCrit },
            { suitName: sel.suitName, pos2Main: sel.pos2Main, pos4Main: sel.pos4Main, pos6Main: sel.pos6Main, twoPiece: sel.twoPiece, fullCrit: sel.fullCrit }
        ]);
        const activeIdx = Math.min(2, Math.max(0, sel.activeSetIdx || 0));
        const activeSetRes = threeIndependentSets[activeIdx]?.result;

        // 3. 实战多套独立拆分策略对比
        const strategyDefinitions = {
            pvp_standard: {
                name: '策略A：斗技先手四套独立拆分（散件一速 → 独立招财 → 独立火灵 → 独立共潜/蚌精）',
                schemes: [
                    { label: '① 散件极限一速 (阎魔/面灵气)', suitName: '散件', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' },
                    { label: '② 独立招财猫二速 (千姬/连)', suitName: '招财猫', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' },
                    { label: '③ 独立火灵三速 (因幡/追月)', suitName: '火灵', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' },
                    { label: '④ 独立蚌精四速 (护盾辅助)', suitName: '蚌精', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' }
                ]
            },
            pvp_functional: {
                name: '策略B：实战主属性严选独立拆分（散件速命X → 招财速生生 → 火灵速命生 → 蚌精速生暴 → 共潜速抵生）',
                schemes: [
                    { label: '① 散件命中一速 (速命X · 阎魔)', suitName: '散件', pos2Main: '速度', pos4Main: '效果命中', pos6Main: '不限' },
                    { label: '② 独立招财 · 速生生 (千姬/白藏主)', suitName: '招财猫', pos2Main: '速度', pos4Main: '生命加成', pos6Main: '生命加成' },
                    { label: '③ 独立火灵 · 速命生 (帝释天/那美)', suitName: '火灵', pos2Main: '速度', pos4Main: '效果命中', pos6Main: '生命加成' },
                    { label: '④ 独立蚌精 · 速生暴 (匣子/鲸千)', suitName: '蚌精', pos2Main: '速度', pos4Main: '生命加成', pos6Main: '暴击/爆伤' },
                    { label: '⑤ 独立共潜 · 速抵生 (驱散辅助)', suitName: '共潜', pos2Main: '速度', pos4Main: '效果抵抗', pos6Main: '生命加成' }
                ]
            },
            sanjian_depth: {
                name: '策略C：全号散件速度池深度测试（独立散件一速 ~ 独立散件五速，共30颗不重复御魂）',
                schemes: [
                    { label: '① 独立散件一速', suitName: '散件', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' },
                    { label: '② 独立散件二速', suitName: '散件', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' },
                    { label: '③ 独立散件三速', suitName: '散件', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' },
                    { label: '④ 独立散件四速', suitName: '散件', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' },
                    { label: '⑤ 独立散件五速', suitName: '散件', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' }
                ]
            }
        };
        const currentStrat = strategyDefinitions[AppState.independentStrategyId] || strategyDefinitions.pvp_standard;
        const stratResults = solveSequentialIndependentSets(currentStrat.schemes);

        // 4. 全套装一速多维对比矩阵（极限速XX vs 速生生 vs 速命X vs 速抵X vs 速生暴）
        const matrixSuits = ['散件', '招财猫', '火灵', '蚌精', '共潜', '遗念火', '木魅', '返魂香', '薙魂', '日女巳时', '魅妖', '雪幽魂', '钟灵', '海月火玉', '狂骨', '破势', '伤魂鸟'];
        const matrixRowsHtml = [];
        matrixSuits.forEach(sName => {
            const rMax = solveSpeedScheme({ suitName: sName, pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' });
            if (!rMax.valid || rMax.totalSpeed < 120) return;
            const rHpHp = solveSpeedScheme({ suitName: sName, pos2Main: '速度', pos4Main: '生命加成', pos6Main: '生命加成' });
            const rHpCrit = solveSpeedScheme({ suitName: sName, pos2Main: '速度', pos4Main: '生命加成', pos6Main: '暴击/爆伤' });
            const rHit = solveSpeedScheme({ suitName: sName, pos2Main: '速度', pos4Main: '效果命中', pos6Main: '不限' });
            const rRes = solveSpeedScheme({ suitName: sName, pos2Main: '速度', pos4Main: '效果抵抗', pos6Main: '不限' });

            const posCells = [1, 2, 3, 4, 5, 6].map(p => {
                const m = rMax.pieces[p];
                if (!m) return '<td>-</td>';
                const spdVal = m.subSpeed;
                const isSuit = rMax.suitPositions.includes(p);
                const shortMain = m.mainAttr.name.replace('效果', '').replace('加成', '').replace('暴击伤害', '爆伤');
                return `<td>
                    <span style="color:${getSingleSpeedColor(spdVal)};font-weight:700;${isSuit ? 'text-decoration:underline;' : ''}">${spdVal.toFixed(2)}</span>
                    ${(p === 4 || p === 6) ? `<small style="color:#64748b;">[${shortMain}]</small>` : ''}
                </td>`;
            }).join('');

            matrixRowsHtml.push(`
                <tr class="cbgh-clickable-row" data-load-suit="${escapeHtml(sName)}" title="点击在上方工作台查看【${escapeHtml(sName)}】的1~6号位详细御魂搭配">
                    <td style="font-weight:700;text-align:left;">🔍 ${escapeHtml(sName)}</td>
                    <td><span style="color:${getSuitSpeedColor(rMax.totalSpeed)};font-weight:800;font-size:13px;">+${rMax.totalSpeed.toFixed(2)}</span></td>
                    <td><span style="color:${getSuitSpeedColor(rHpHp.totalSpeed)};font-weight:700;">${rHpHp.valid ? '+' + rHpHp.totalSpeed.toFixed(2) : '-'}</span></td>
                    <td><span style="color:${getSuitSpeedColor(rHpCrit.totalSpeed)};font-weight:700;">${rHpCrit.valid ? '+' + rHpCrit.totalSpeed.toFixed(2) : '-'}</span></td>
                    <td><span style="color:${getSuitSpeedColor(rHit.totalSpeed)};font-weight:700;">${rHit.valid ? '+' + rHit.totalSpeed.toFixed(2) : '-'}</span></td>
                    <td><span style="color:${getSuitSpeedColor(rRes.totalSpeed)};font-weight:700;">${rRes.valid ? '+' + rRes.totalSpeed.toFixed(2) : '-'}</span></td>
                    ${posCells}
                </tr>
            `);
        });

        return `
            <!-- 1. 各位置速度底子与头尾详情 -->
            <div class="cbgh-section-card">
                <div class="cbgh-section-header">
                    <div class="cbgh-section-title">⚡ 各位置速度底子与满速头尾详情</div>
                    <div class="cbgh-section-desc">6跳满速(≥15速) · 真17(≥17.0速) · 极品16.5+ · 5跳准满速(13.5~15速)</div>
                </div>
                <div class="cbgh-table-wrap">
                    <table class="cbgh-table">
                        <thead>
                            <tr>
                                <th>档位指标</th>
                                <th>1号位</th>
                                <th>2号位(双速)</th>
                                <th>3号位</th>
                                <th>4号位</th>
                                <th>5号位</th>
                                <th>6号位</th>
                                <th style="background:#eef2ff;color:#4338ca;">全号总计</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="font-weight:700;color:#dc2626;">🔥 真17 (≥17.0)</td>
                                ${[1, 2, 3, 4, 5, 6].map(p => `<td style="font-weight:700;color:${posSpdStats.true17[p] > 0 ? '#dc2626' : '#94a3b8'};">${posSpdStats.true17[p]}</td>`).join('')}
                                <td style="background:#eef2ff;font-weight:800;color:#dc2626;">${tot17}</td>
                            </tr>
                            <tr>
                                <td style="font-weight:700;color:#ea580c;">⭐ 16.5+ 极品速</td>
                                ${[1, 2, 3, 4, 5, 6].map(p => `<td style="font-weight:700;">${posSpdStats.spd165[p]}</td>`).join('')}
                                <td style="background:#eef2ff;font-weight:800;">${tot165}</td>
                            </tr>
                            <tr>
                                <td style="font-weight:700;color:#2563eb;">⚡ 满速 (6跳/≥15)</td>
                                ${[1, 2, 3, 4, 5, 6].map(p => `<td style="font-weight:700;">${posSpdStats.full[p]}</td>`).join('')}
                                <td style="background:#eef2ff;font-weight:800;color:#2563eb;">${totFull}</td>
                            </tr>
                            <tr>
                                <td style="font-weight:600;color:#475569;">✨ 5跳准满速 (13.5~15)</td>
                                ${[1, 2, 3, 4, 5, 6].map(p => `<td>${posSpdStats.roll5[p]}</td>`).join('')}
                                <td style="background:#eef2ff;font-weight:700;">${totRoll5}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style="margin-top:10px;display:grid;grid-template-columns:1fr;gap:6px;font-size:12px;">
                    <div><strong style="color:#1e293b;">👑 二号位满速头 (${sum.heads.length}颗):</strong> ${formatHeadList(sum.heads)}</div>
                    <div><strong style="color:#1e293b;">🎯 四号位命中尾 (${sum.hit_feet.length}颗):</strong> ${formatHeadList(sum.hit_feet)}</div>
                    <div><strong style="color:#1e293b;">🔰 四号位抵抗尾 (${sum.resist_feet.length}颗):</strong> ${formatHeadList(sum.resist_feet)}</div>
                </div>
            </div>

            <!-- 2. 交互式「御魂方案自选工作台」（速生生/速生暴/速命生等自由切换查看具体搭配因素） -->
            <div class="cbgh-section-card" id="cbgh-scheme-workbench" style="border:2px solid #c7d2fe;">
                <div class="cbgh-section-header">
                    <div class="cbgh-section-title">🛠️ 御魂配装方案自选工作台（自由切换 速生生 / 速生暴 / 速命生 / 速抵生 查看 1~6 号位具体搭配因素）</div>
                    <div class="cbgh-section-desc">点击下方预设或修改下拉框，实时计算该方案的【第1套一速 / 第2套独立二速 / 第3套独立三速】及每颗御魂详情</div>
                </div>

                <!-- 快捷方案按钮 -->
                <div class="cbgh-preset-bar">
                    ${SPEED_SCHEME_PRESETS.map(p => `
                        <button type="button" class="cbgh-pill-btn cbgh-scheme-preset-btn ${sel.presetId === p.id ? 'active' : ''}" data-preset-id="${p.id}" title="${escapeHtml(p.desc)}">
                            ${escapeHtml(p.name)}
                        </button>
                    `).join('')}
                </div>

                <!-- 自定义下拉组合器 -->
                <div class="cbgh-filter-row">
                    <div class="cbgh-filter-item">
                        <span>四件套:</span>
                        <select id="cbgh-sel-suit" class="cbgh-select">
                            ${AppState.availableSuits.map(s => `<option value="${escapeHtml(s)}" ${sel.suitName === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="cbgh-filter-item">
                        <span>2号位主属性:</span>
                        <select id="cbgh-sel-pos2" class="cbgh-select">
                            ${['速度', '攻击加成', '生命加成', '防御加成', '不限'].map(v => `<option value="${v}" ${sel.pos2Main === v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                    </div>
                    <div class="cbgh-filter-item">
                        <span>4号位主属性:</span>
                        <select id="cbgh-sel-pos4" class="cbgh-select">
                            ${['不限', '生命加成', '效果命中', '效果抵抗', '攻击加成', '防御加成'].map(v => `<option value="${v}" ${sel.pos4Main === v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                    </div>
                    <div class="cbgh-filter-item">
                        <span>6号位主属性:</span>
                        <select id="cbgh-sel-pos6" class="cbgh-select">
                            ${['不限', '生命加成', '暴击/爆伤', '暴击', '暴击伤害', '攻击加成', '防御加成', '生命/防御'].map(v => `<option value="${v}" ${sel.pos6Main === v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                    </div>
                    <div class="cbgh-filter-item">
                        <span>两件套要求:</span>
                        <select id="cbgh-sel-twopiece" class="cbgh-select">
                            ${['不限', '生命两件套', '防御两件套', '命中两件套', '抵抗两件套', '暴击两件套', '蜃气楼'].map(v => `<option value="${v}" ${sel.twoPiece === v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                    </div>
                    <label class="cbgh-filter-item" style="cursor:pointer;">
                        <input type="checkbox" id="cbgh-sel-fullcrit" ${sel.fullCrit ? 'checked' : ''} />
                        <span>要求满暴(≥89%暴)</span>
                    </label>
                </div>

                <!-- 独立第1套/第2套/第3套切换栏 -->
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
                    ${threeIndependentSets.map((item, idx) => {
                        const r = item.result;
                        const spdTxt = r && r.valid ? `+${r.totalSpeed.toFixed(2)}` : '无法凑齐';
                        return `
                            <button type="button" class="cbgh-pill-btn cbgh-set-idx-btn ${activeIdx === idx ? 'active' : ''}" data-set-idx="${idx}">
                                第 ${idx + 1} 套独立【${escapeHtml(sel.suitName)}】一速：<strong>${spdTxt}</strong>
                                ${idx > 0 ? `<small style="opacity:0.85;">(已排除前${idx}套御魂)</small>` : ''}
                            </button>
                        `;
                    }).join('')}
                </div>

                <!-- 当前选中方案汇总横幅 -->
                ${activeSetRes && activeSetRes.valid ? `
                    <div class="cbgh-summary-banner">
                        <div>
                            <strong style="color:#1e1b4b;font-size:14px;">
                                【${escapeHtml(sel.suitName)} · 2${escapeHtml(sel.pos2Main)} / 4${escapeHtml(sel.pos4Main)} / 6${escapeHtml(sel.pos6Main)}】第 ${activeIdx + 1} 套总速度加成：
                            </strong>
                            <span style="font-size:18px;font-weight:800;color:${getSuitSpeedColor(activeSetRes.totalSpeed)};">
                                +${activeSetRes.totalSpeed.toFixed(2)}
                            </span>
                            <span style="color:#64748b;margin-left:8px;">
                                (面灵气面板: <b>${(119 + activeSetRes.totalSpeed).toFixed(2)}</b> | 阎魔面板: <b>${(127 + activeSetRes.totalSpeed).toFixed(2)}</b> | 千姬面板: <b>${(121 + activeSetRes.totalSpeed).toFixed(2)}</b>)
                            </span>
                        </div>
                        <div style="color:#334155;font-weight:600;">
                            套装总加成：
                            生命 <b>+${activeSetRes.totalStats['生命加成'].toFixed(1)}%</b> ·
                            防御 <b>+${activeSetRes.totalStats['防御加成'].toFixed(1)}%</b> ·
                            命中 <b>+${activeSetRes.totalStats['效果命中'].toFixed(1)}%</b> ·
                            抵抗 <b>+${activeSetRes.totalStats['效果抵抗'].toFixed(1)}%</b> ·
                            暴击 <b>+${activeSetRes.totalStats['暴击'].toFixed(1)}%</b>
                        </div>
                    </div>
                    ${renderMitamaSlotGrid(activeSetRes.pieces, activeSetRes.suitPositions, 'speed')}
                ` : `
                    <div style="padding:16px;text-align:center;color:#dc2626;background:#fef2f2;border-radius:8px;border:1px solid #fecaca;">
                        ⚠️ 当前账号御魂库在该筛选条件下无法凑齐完整的第 ${activeIdx + 1} 套 6 个位置御魂，请尝试放宽主属性或两件套限制。
                    </div>
                `}
            </div>

            <!-- 3. 斗技/道馆多套独立不冲突拆分策略 -->
            <div class="cbgh-section-card">
                <div class="cbgh-section-header">
                    <div class="cbgh-section-title">♟️ 斗技/道馆多套独立一速拆分策略（严格按优先级去重，绝不共用同一颗御魂）</div>
                    <div class="cbgh-preset-bar" style="margin-bottom:0;">
                        <button type="button" class="cbgh-pill-btn cbgh-strat-btn ${AppState.independentStrategyId === 'pvp_standard' ? 'active' : ''}" data-strat="pvp_standard">策略A: 散件+招财+火灵+蚌精</button>
                        <button type="button" class="cbgh-pill-btn cbgh-strat-btn ${AppState.independentStrategyId === 'pvp_functional' ? 'active' : ''}" data-strat="pvp_functional">策略B: 实战主属性严选5套</button>
                        <button type="button" class="cbgh-pill-btn cbgh-strat-btn ${AppState.independentStrategyId === 'sanjian_depth' ? 'active' : ''}" data-strat="sanjian_depth">策略C: 独立散件一至五速</button>
                    </div>
                </div>
                <div class="cbgh-table-wrap">
                    <table class="cbgh-table">
                        <thead>
                            <tr>
                                <th style="text-align:left;">独立拆分顺位与方案</th>
                                <th>总速度加成</th>
                                <th>1号位</th>
                                <th>2号位</th>
                                <th>3号位</th>
                                <th>4号位</th>
                                <th>5号位</th>
                                <th>6号位</th>
                                <th>总命中/抵抗/生命</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stratResults.map(item => {
                                const r = item.result;
                                if (!r || !r.valid) {
                                    return `<tr><td style="text-align:left;font-weight:700;">${escapeHtml(item.schemeLabel)}</td><td colspan="8" style="color:#94a3b8;">御魂不足以凑齐该独立套装</td></tr>`;
                                }
                                const cells = [1, 2, 3, 4, 5, 6].map(p => {
                                    const m = r.pieces[p];
                                    if (!m) return '<td>-</td>';
                                    const isSuit = r.suitPositions.includes(p);
                                    const shortMain = m.mainAttr.name.replace('效果', '').replace('加成', '').replace('暴击伤害', '爆伤');
                                    return `<td>
                                        <span style="color:${getSingleSpeedColor(m.subSpeed)};font-weight:700;${isSuit ? 'text-decoration:underline;' : ''}">${m.subSpeed.toFixed(2)}</span>
                                        <br/><small style="color:#64748b;">${escapeHtml(m.name.slice(0, 2))}[${shortMain}]</small>
                                    </td>`;
                                }).join('');
                                return `
                                    <tr>
                                        <td style="text-align:left;font-weight:700;color:#1e293b;">${escapeHtml(item.schemeLabel)}</td>
                                        <td><span style="color:${getSuitSpeedColor(r.totalSpeed)};font-weight:800;font-size:13px;">+${r.totalSpeed.toFixed(2)}</span></td>
                                        ${cells}
                                        <td style="font-size:11px;color:#475569;">
                                            命+${r.totalStats['效果命中'].toFixed(0)}% / 抵+${r.totalStats['效果抵抗'].toFixed(0)}% / 生+${r.totalStats['生命加成'].toFixed(0)}%
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 4. 全套装一速多方案对比矩阵 -->
            <div class="cbgh-section-card">
                <div class="cbgh-section-header">
                    <div class="cbgh-section-title">📊 全套装多方案一速全景矩阵（点击任意套装行可立即在上方工作台展开 1~6 号位详情）</div>
                    <div class="cbgh-section-desc">同时展示每套御魂的【速XX极限一速】【速生生】【速生暴】【速命X】【速抵X】真实可配速度</div>
                </div>
                <div class="cbgh-table-wrap">
                    <table class="cbgh-table">
                        <thead>
                            <tr>
                                <th style="text-align:left;">套装名称 (点击查看详情)</th>
                                <th>⚡ 速XX(极限)</th>
                                <th>🛡️ 速生生</th>
                                <th>💎 速生暴/爆</th>
                                <th>🎯 速命X</th>
                                <th>🔰 速抵X</th>
                                <th>1号位</th>
                                <th>2号位</th>
                                <th>3号位</th>
                                <th>4号位</th>
                                <th>5号位</th>
                                <th>6号位</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${matrixRowsHtml.join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ---------- Tab 2: PVE / PVP 输出面板（雪御前、平将门、天照、须佐、阿修罗等） ----------
    function renderTabOutputPanel() {
        ensureAllOutputsComputed();
        const outSum = AppState.outputSummary;
        if (!outSum) return '';

        const renderHeroCard = (hKey, headerClass) => {
            const data = outSum[hKey];
            if (!data) return '';
            const info = data.baseInfo;
            const badgeText = info.isRealFromAccount
                ? `✅ 号内已拥有 ${info.ownedCount} 只 (实装6★满级白值)`
                : (info.ownedCount > 0 ? `📦 号内拥有 ${info.ownedCount} 只 (最高${info.maxStarOwned}★ · 按6★满级计算)` : `📐 未持有 · 按官方6★满级白值预览`);

            return `
                <div class="cbgh-hero-card">
                    <div class="cbgh-hero-header ${headerClass}">
                        <div>
                            <div style="font-size:15px;font-weight:800;">${escapeHtml(info.name)} <span style="font-size:11px;font-weight:500;opacity:0.9;">(${escapeHtml(info.role)})</span></div>
                            <div style="font-size:11px;opacity:0.85;margin-top:2px;">
                                基础攻击 <b>${info.baseAtk}</b> · 防御 <b>${info.baseDef}</b> · 速度 <b>${info.baseSpd}</b> · 暴击 <b>${info.baseCrit}%</b> · 初始爆伤 <b>${info.baseCdmg}%</b>
                            </div>
                        </div>
                        <span style="background:rgba(255,255,255,0.2);padding:3px 8px;border-radius:999px;font-size:11px;font-weight:600;">${badgeText}</span>
                    </div>
                    <div style="padding:10px 12px;">
                        <div style="font-size:11px;color:#64748b;margin-bottom:8px;">💡 ${escapeHtml(info.desc)}</div>
                        <table class="cbgh-table">
                            <thead>
                                <tr>
                                    <th style="text-align:left;">常用主流配装方案 (点击查看1~6号位御魂)</th>
                                    <th>面板 (攻×爆伤)</th>
                                    <th>最终攻击</th>
                                    <th>最终爆伤</th>
                                    <th>最终速度</th>
                                    <th>${hKey === 'pingjiangmen' ? '最终防御 / 攻防比' : '暴击率'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.schemeResults.map((sr, idx) => {
                                    const s = sr.solved;
                                    const cardKey = `${hKey}:${idx}`;
                                    const isSelected = AppState.outputSelector.selectedCardKey === cardKey;
                                    if (!s || !s.valid) {
                                        return `<tr><td style="text-align:left;">${escapeHtml(sr.schemeMeta.label)}</td><td colspan="5" style="color:#94a3b8;">当前御魂库无法凑齐满暴方案</td></tr>`;
                                    }
                                    const extraCol = hKey === 'pingjiangmen'
                                        ? `<span style="font-weight:700;color:${s.mode === 'pjm_def' ? '#059669' : '#dc2626'};">${Math.round(s.finalDef)}防 (${s.atkDefRatio.toFixed(2)}倍${s.mode === 'pjm_def' ? '✅守' : '⚔️攻'})</span>`
                                        : `${s.finalCrit.toFixed(1)}%`;
                                    return `
                                        <tr class="cbgh-clickable-row cbgh-output-preset-row" data-card-key="${cardKey}" style="${isSelected ? 'background:#eef2ff;font-weight:700;' : ''}">
                                            <td style="text-align:left;font-weight:700;color:#1e293b;">🔍 ${escapeHtml(sr.schemeMeta.label)} ${s.fallbackNote ? `<br/><small style="color:#d97706;font-weight:600;">(${escapeHtml(s.fallbackNote)})</small>` : ""}</td>
                                            <td><span style="color:#dc2626;font-weight:800;font-size:13px;">${s.panelWan}w</span> <small style="color:#64748b;">(${Math.round(s.rawPanel)})</small></td>
                                            <td style="font-weight:700;">${Math.round(s.finalAtk)}</td>
                                            <td style="font-weight:700;color:#d97706;">${s.finalCdmg.toFixed(1)}%</td>
                                            <td>${s.finalSpd.toFixed(1)}</td>
                                            <td>${extraCol}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        };

        // 获取当前选中的输出面板详情（来自预设卡片点击 或 自定义计算器）
        const outSel = AppState.outputSelector;
        let detailSolved = null;
        let detailTitle = '';
        if (outSel.selectedCardKey && outSel.selectedCardKey !== 'custom') {
            const [hk, idxStr] = outSel.selectedCardKey.split(':');
            const sr = outSum[hk]?.schemeResults?.[Number(idxStr)];
            if (sr && sr.solved) {
                detailSolved = sr.solved;
                detailTitle = `${outSum[hk].baseInfo.name} · ${sr.schemeMeta.label}`;
            }
        }
        if (!detailSolved) {
            detailSolved = solveOutputPanel({
                heroKey: outSel.heroKey,
                suit4: outSel.suit4,
                suit2: outSel.suit2,
                minSpd: outSel.minSpd,
                pos2Allowed: outSel.mode === 'pjm_def' ? ['攻击加成', '防御加成', '速度'] : (outSel.minSpd >= 150 ? ['速度', '攻击加成'] : ['攻击加成']),
                pos4Allowed: outSel.mode === 'pjm_def' ? ['防御加成', '攻击加成'] : ['攻击加成'],
                pos6Allowed: ['暴击', '暴击伤害'],
                mode: outSel.mode,
                minDef: outSel.minDef
            });
            detailTitle = `自定义计算：${SHIKIGAMI_PRESETS[outSel.heroKey]?.name || ''} · ${outSel.suit4} + ${outSel.suit2}`;
        }

        // 其他核心输出式神速览行
        const otherHeroKeys = ['tianzhao', 'xuzuozhinan', 'axiuLuo', 'spDashe', 'spJintian'];
        const otherRows = [];
        otherHeroKeys.forEach(hk => {
            const d = outSum[hk];
            if (!d) return;
            d.schemeResults.forEach((sr, idx) => {
                const s = sr.solved;
                const cardKey = `${hk}:${idx}`;
                otherRows.push(`
                    <tr class="cbgh-clickable-row cbgh-output-preset-row" data-card-key="${cardKey}">
                        <td style="font-weight:700;text-align:left;">${escapeHtml(d.baseInfo.name)} <small style="color:#64748b;">(攻${d.baseInfo.baseAtk}/速${d.baseInfo.baseSpd}/爆${d.baseInfo.baseCdmg}%)</small></td>
                        <td style="text-align:left;font-weight:600;">🔍 ${escapeHtml(sr.schemeMeta.label)}</td>
                        <td><span style="color:#dc2626;font-weight:800;">${s.valid ? s.panelWan + 'w (' + Math.round(s.rawPanel) + ')' : '未凑齐满暴'}</span></td>
                        <td>${s.valid ? Math.round(s.finalAtk) : '-'}</td>
                        <td>${s.valid ? s.finalCdmg.toFixed(1) + '%' : '-'}</td>
                        <td>${s.valid ? s.finalSpd.toFixed(1) : '-'}</td>
                        <td>${s.valid ? s.finalCrit.toFixed(1) + '%' : '-'}</td>
                    </tr>
                `);
            });
        });

        return `
            <!-- 1. 雪御前 & 平将门 重点专项输出面板双卡 -->
            <div class="cbgh-hero-grid">
                ${renderHeroCard('xueyuqian', 'xueyuqian')}
                ${renderHeroCard('pingjiangmen', 'pingjiangmen')}
            </div>

            <!-- 2. 选中输出方案的 1~6 号位御魂搭配明细与自定义输出计算器 -->
            <div class="cbgh-section-card" id="cbgh-output-detail-box" style="border:2px solid #fca5a5;">
                <div class="cbgh-section-header">
                    <div class="cbgh-section-title">⚔️ 输出面板 1~6 号位御魂搭配明细 & 交互式定制计算器</div>
                    <div class="cbgh-section-desc">点击上方任意式神方案行可切换查看具体 1~6 号位御魂，也可在下方自由组合式神、套装与速度要求</div>
                </div>

                <!-- 自定义输出面板筛选栏 -->
                <div class="cbgh-filter-row">
                    <div class="cbgh-filter-item">
                        <span>选择式神:</span>
                        <select id="cbgh-out-hero" class="cbgh-select">
                            ${Object.values(SHIKIGAMI_PRESETS).map(p => `<option value="${p.key}" ${outSel.heroKey === p.key ? 'selected' : ''}>${p.name} (攻${p.baseAtk}/爆${p.baseCdmg}%)</option>`).join('')}
                        </select>
                    </div>
                    <div class="cbgh-filter-item">
                        <span>四件套:</span>
                        <select id="cbgh-out-suit4" class="cbgh-select">
                            ${['海月火玉', '狂骨', '隐念', '破势', '针女', '伤魂鸟', '心眼', '网切', '镇墓兽', '无刀取', '散件'].map(s => `<option value="${s}" ${outSel.suit4 === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>
                    <div class="cbgh-filter-item">
                        <span>两件套/首领:</span>
                        <select id="cbgh-out-suit2" class="cbgh-select">
                            ${['鬼灵歌伎', '荒骷髅', '暴击两件套', '攻击两件套', '防御两件套', '不限'].map(s => `<option value="${s}" ${outSel.suit2 === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>
                    <div class="cbgh-filter-item">
                        <span>最低速度:</span>
                        <select id="cbgh-out-spd" class="cbgh-select">
                            ${[
                                { v: 0, l: '不限速度 (极限输出)' },
                                { v: 128, l: '超星 (≥128速)' },
                                { v: 132, l: '神罚配速 (≥132速)' },
                                { v: 145, l: '中速 (≥145速)' },
                                { v: 158, l: '魂土高速 (≥158速)' },
                                { v: 185, l: '高速 (≥185速)' }
                            ].map(o => `<option value="${o.v}" ${Number(outSel.minSpd) === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}
                        </select>
                    </div>
                    <div class="cbgh-filter-item">
                        <span>计算模式:</span>
                        <select id="cbgh-out-mode" class="cbgh-select">
                            <option value="atk_cdmg" ${outSel.mode === 'atk_cdmg' ? 'selected' : ''}>常规极限输出 (满暴攻×爆)</option>
                            <option value="pjm_def" ${outSel.mode === 'pjm_def' ? 'selected' : ''}>平将门·防守架势 (满暴且攻≤7倍防)</option>
                            <option value="pjm_atk" ${outSel.mode === 'pjm_atk' ? 'selected' : ''}>平将门·攻击架势 (满暴且攻>7倍防)</option>
                        </select>
                    </div>
                    <button type="button" id="cbgh-out-calc-btn" class="cbgh-pill-btn active">🚀 立即计算此配置</button>
                </div>

                ${detailSolved && detailSolved.valid ? `
                    <div class="cbgh-summary-banner" style="background:linear-gradient(90deg, #fff1f2 0%, #fffbeb 100%);border-color:#fda4af;">
                        <div>
                            <strong style="color:#9f1239;font-size:14px;">【${escapeHtml(detailTitle)}】</strong>
                            <span style="font-size:18px;font-weight:800;color:#dc2626;margin-left:6px;">
                                面板 ${detailSolved.panelWan}w (${Math.round(detailSolved.rawPanel)})
                            </span>
                        </div>
                        <div style="color:#1e293b;font-weight:600;">
                            总攻击: <b>${Math.round(detailSolved.finalAtk)}</b> ·
                            总防御: <b>${Math.round(detailSolved.finalDef)}</b>
                            (攻防比: <b>${detailSolved.atkDefRatio.toFixed(2)}倍</b>
                            ${detailSolved.mode === 'pjm_def' ? `<span style="color:#059669;">[✅防守架势生效 · 受击回血基准: ${Math.round(detailSolved.healCap)}]</span>` : ''}) ·
                            暴击: <b>${detailSolved.finalCrit.toFixed(1)}%</b> ·
                            爆伤: <b style="color:#d97706;">${detailSolved.finalCdmg.toFixed(1)}%</b> ·
                            速度: <b>${detailSolved.finalSpd.toFixed(2)}</b>
                        </div>
                    </div>
                    ${renderMitamaSlotGrid(detailSolved.pieces, detailSolved.suitPositions, 'output')}
                ` : `
                    <div style="padding:14px;text-align:center;color:#dc2626;background:#fef2f2;border-radius:8px;">
                        ⚠️ 当前账号御魂库在该套装与速度限制下无法凑齐 100% 满暴配装，请尝试切换两件套为「暴击两件套」或「不限」，或降低速度要求。
                    </div>
                `}
            </div>

            <!-- 3. 天照 / 须佐之男 / 阿修罗 / 神堕八岐大蛇 / 烬天玉藻前 面板速览表 -->
            <div class="cbgh-section-card">
                <div class="cbgh-section-header">
                    <div class="cbgh-section-title">🌟 其他主流 PVE / PVP 核心输出式神面板总览（点击任意行可在上方展开 1~6 号位御魂详情）</div>
                    <div class="cbgh-section-desc">涵盖天照、须佐之男、阿修罗、神堕八岐大蛇、烬天玉藻前的常用副本标准配装</div>
                </div>
                <div class="cbgh-table-wrap">
                    <table class="cbgh-table">
                        <thead>
                            <tr>
                                <th style="text-align:left;">式神名称与六星白值</th>
                                <th style="text-align:left;">配装方案 (点击查看御魂明细)</th>
                                <th>输出面板 (攻×爆伤)</th>
                                <th>最终攻击</th>
                                <th>最终爆伤</th>
                                <th>最终速度</th>
                                <th>暴击率</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${otherRows.join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ---------- Tab 3: 御魂胚子数量与权威定义评估 ----------
    function renderTabEmbryo() {
        const emb = AppState.embryoStats;
        if (!emb) return '';

        const filterLabels = {
            dual_speed: `🚀 二号位双速胚子/成装 (${emb.lists.dual_speed.length})`,
            full_speed_6: `⚡ 全位置6跳满速御魂 (${emb.lists.full_speed_6.length})`,
            output_8plus: `🗡️ 8~9条极品输出满条胚子 (${emb.lists.output_8plus.length})`,
            support_8plus: `🛡️ 8~9条极品辅助满条胚子 (${emb.lists.support_8plus.length})`,
            boss_high: `👹 极品首领御魂 10分+ (${emb.lists.boss_high.length})`,
            crit_dmg_6: `💥 六号位高暴击爆伤胚子 (${emb.lists.crit_dmg_6.length})`
        };

        const currentList = emb.lists[AppState.embryoFilter] || [];

        return `
            <!-- 1. 御魂胚子权威定义与评估标准科普指南 -->
            <div class="cbgh-guide-box">
                <div style="font-weight:800;font-size:13px;margin-bottom:4px;">📖 《阴阳师》御魂“胚子”权威定义与社区评估标准（基于官网与主流攻略整理）</div>
                <ul style="margin:0;padding-left:18px;">
                    <li><strong>1. 什么是“腿数”与“满条胚子”：</strong>六星御魂0级初始自带 2~4 条副属性（俗称 <b>2条腿[瘸腿] / 3条腿 / 4条腿[满条胚子]</b>），每强化 +3 级增加 1 次强化收益（+15满级共新增5次收益）。因此<strong>天生4条腿满条胚子</strong>强满15级共有 <strong>9条总收益</strong>（4初始+5强化），天生3条腿满级为 <strong>8条总收益</strong>，天生2条腿满级仅 <strong>7条总收益</strong>。满条9收益御魂数量直接反映账号赌魂与整理质量！</li>
                    <li><strong>2. 速度胚子与二号位双速：</strong>二号位主属性为「速度(+57)」且副属性同时带有「速度」的御魂称为<strong>「二号位双速胚子」</strong>（唯一可突破57速达到72~75速的头）；任意位置副属性带速度且强化5次全中速度（共6次速度收益，副属性速度≥15~18）称为<strong>「满速成装」</strong>，副属性≥17.0称为<strong>「真17」</strong>。</li>
                    <li><strong>3. 输出有效胚子与辅助有效胚子：</strong>输出御魂以 <strong>{暴击、暴击伤害、攻击加成、速度}</strong> 为4项有效属性，满级有效收益达到 <strong>8~9条</strong> 即为传家宝级极品输出件；辅助御魂以 <strong>{速度、效果命中、效果抵抗、生命加成、防御加成}</strong> 为有效属性，四号位主属性命中/抵抗且带速度称为<strong>「命速/抵速有效胚子」</strong>。</li>
                    <li><strong>4. 首领御魂计分标准：</strong>首领御魂（荒骷髅、鬼灵歌伎、蜃气楼、土蜘蛛、地震鲶）自带 <strong>8%固有属性</strong>（相当于额外白送约 2.8~3 条副属性收益），固有属性对口且副属性有效收益 ≥ 7~9 条即为社区估价常说的 <strong>10分 / 11分 / 12分极品首领御魂</strong>。</li>
                </ul>
            </div>

            <!-- 2. 胚子数量与极品度统计仪表盘 -->
            <div class="cbgh-section-card">
                <div class="cbgh-section-header">
                    <div class="cbgh-section-title">💎 账号御魂胚子数量与有效收益深度统计</div>
                    <div class="cbgh-section-desc">共扫描 ${emb.totalCount} 颗御魂（其中 6★满级 ${emb.sixStarMaxCount} 颗${emb.unmaxedEmbryoCount > 0 ? `，未满级潜力胚子 ${emb.unmaxedEmbryoCount} 颗` : ''}）</div>
                </div>
                <div class="cbgh-kpi-strip" style="padding:0;border:none;margin-bottom:12px;">
                    <div class="cbgh-kpi-card">
                        <div class="cbgh-kpi-label">天生4腿满条 (9收益)</div>
                        <div class="cbgh-kpi-val" style="color:#4338ca;">${emb.fullLegs4Count} 颗</div>
                        <div class="cbgh-kpi-sub">占比 ${emb.totalCount ? ((emb.fullLegs4Count / emb.totalCount) * 100).toFixed(1) : 0}% (3腿:${emb.threeLegsCount})</div>
                    </div>
                    <div class="cbgh-kpi-card">
                        <div class="cbgh-kpi-label">二号位双速胚子/成装</div>
                        <div class="cbgh-kpi-val" style="color:#dc2626;">${emb.pos2DualSpeedCount} 颗</div>
                        <div class="cbgh-kpi-sub">其中16+双速头: ${emb.pos2DualSpeed16Plus} 颗</div>
                    </div>
                    <div class="cbgh-kpi-card">
                        <div class="cbgh-kpi-label">速度跳数分布 (6/5/4跳)</div>
                        <div class="cbgh-kpi-val" style="color:#ea580c;">${emb.speedRolls6Count} / ${emb.speedRolls5Count} / ${emb.speedRolls4Count}</div>
                        <div class="cbgh-kpi-sub">6跳满速 / 5跳准满 / 4跳中速</div>
                    </div>
                    <div class="cbgh-kpi-card">
                        <div class="cbgh-kpi-label">极品输出胚子 (9条/8条/7条)</div>
                        <div class="cbgh-kpi-val" style="color:#d97706;">${emb.outputRolls9Count} / ${emb.outputRolls8Count} / ${emb.outputRolls7Count}</div>
                        <div class="cbgh-kpi-sub">六号高暴爆伤件: ${emb.pos6CdmgHighCritCount} 颗</div>
                    </div>
                    <div class="cbgh-kpi-card">
                        <div class="cbgh-kpi-label">极品辅助胚子 (9条/8条)</div>
                        <div class="cbgh-kpi-val" style="color:#059669;">${emb.supportRolls9Count} / ${emb.supportRolls8Count}</div>
                        <div class="cbgh-kpi-sub">4号命速:${emb.pos4HitSpdCount} · 抵速:${emb.pos4ResSpdCount}</div>
                    </div>
                    <div class="cbgh-kpi-card">
                        <div class="cbgh-kpi-label">极品首领御魂 (10分+/11分+)</div>
                        <div class="cbgh-kpi-val" style="color:#7c3aed;">${emb.bossHighScoreCount} / ${emb.bossGodScoreCount}</div>
                        <div class="cbgh-kpi-sub">首领御魂总数: ${emb.bossTotalCount} 颗</div>
                    </div>
                </div>

                <!-- 分类筛选器与极品胚子明细表 -->
                <div class="cbgh-preset-bar">
                    ${Object.entries(filterLabels).map(([key, label]) => `
                        <button type="button" class="cbgh-pill-btn cbgh-embryo-filter-btn ${AppState.embryoFilter === key ? 'active' : ''}" data-emb-filter="${key}">
                            ${escapeHtml(label)}
                        </button>
                    `).join('')}
                </div>

                <div class="cbgh-table-wrap" style="max-height:360px;overflow-y:auto;">
                    <table class="cbgh-table">
                        <thead>
                            <tr>
                                <th>序号</th>
                                <th>御魂名称</th>
                                <th>位置</th>
                                <th>主属性</th>
                                <th>初始腿数 (总条数)</th>
                                <th>副属性速度 (跳数)</th>
                                <th>输出有效条数</th>
                                <th>辅助有效条数</th>
                                <th style="text-align:left;">完整副属性与固有属性明细</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${currentList.slice(0, 80).map((m, idx) => {
                                const subParts = [];
                                if (m.singleAttr) {
                                    subParts.push(`<span style="color:#7c3aed;font-weight:700;">[固有:${m.singleAttr.name}+${m.singleAttr.val}%]</span>`);
                                }
                                Object.entries(m.subStats).forEach(([k, v]) => {
                                    if (!v || v <= 0) return;
                                    const rCnt = m.rolls[k] || 1;
                                    const valStr = PERCENT_ATTR_NAMES.has(k) ? `${v.toFixed(2)}%` : v.toFixed(2);
                                    const isImportant = ['速度', '暴击', '暴击伤害', '攻击加成', '效果命中', '效果抵抗'].includes(k);
                                    subParts.push(`<span style="${isImportant ? 'font-weight:700;color:#1e293b;' : 'color:#64748b;'}">${k}+${valStr}(${rCnt}跳)</span>`);
                                });
                                return `
                                    <tr>
                                        <td>${idx + 1}</td>
                                        <td style="font-weight:700;">${escapeHtml(m.name)}</td>
                                        <td>${m.pos}号位</td>
                                        <td style="font-weight:700;color:#4338ca;">${escapeHtml(m.mainAttr.name)} +${PERCENT_ATTR_NAMES.has(m.mainAttr.name) ? m.mainAttr.val + '%' : m.mainAttr.val}</td>
                                        <td><span style="padding:2px 6px;border-radius:4px;background:${m.initialLegs >= 4 ? '#dcfce7;color:#166534;font-weight:700;' : '#f1f5f9;color:#475569;'}">天生${m.initialLegs}腿 (${m.totalRolls}条)</span></td>
                                        <td style="font-weight:700;color:${getSingleSpeedColor(m.subSpeed)};">${m.subSpeed > 0 ? `+${m.subSpeed.toFixed(2)} (${m.speedRolls}跳)` : '-'}</td>
                                        <td style="font-weight:700;color:#d97706;">${m.outputRolls} 条${m.isBoss ? ` (首领${m.bossOutputScore}分)` : ''}</td>
                                        <td style="font-weight:700;color:#059669;">${m.supportRolls} 条</td>
                                        <td style="text-align:left;font-size:11px;">${subParts.join(' · ')}</td>
                                    </tr>
                                `;
                            }).join('') || '<tr><td colspan="9" style="color:#94a3b8;padding:16px;">该分类下暂无符合条件的御魂</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ---------- Tab 4: 账号资源与外观收集全景 ----------
    function renderTabResources() {
        const res = AppState.resourceSummary;
        if (!res) return '';

        const hInfo = res.heroHistory || {};
        const ssrGot = hInfo.ssr?.got || 0, ssrAll = hInfo.ssr?.all || 0;
        const spGot = hInfo.sp?.got || 0, spAll = hInfo.sp?.all || 0;
        const xGot = hInfo.x?.got || 0, xAll = hInfo.x?.all || 0;

        const resourceItems = [
            { icon: '🎱', label: '御行达摩 (黑蛋)', val: `${res.blackDamo} 个`, sub: `白蛋:${res.whiteDamo} / 蓝蛋:${res.blueDamo}`, hl: res.blackDamo >= 15 },
            { icon: '💎', label: '魂玉 (氪金货币)', val: formatWan(res.hunyu), sub: '账号留存魂玉', hl: res.hunyu >= 100 },
            { icon: '🌙', label: '勾玉', val: formatWan(res.gouyu), sub: `折合蓝票约 ${Math.floor((res.gouyu || 0) / 90)} 抽`, hl: res.gouyu >= 5000 },
            { icon: '🎫', label: '神秘的符咒 (蓝票)', val: `${res.mysteryAmulet} 张`, sub: '直接抽卡符咒', hl: res.mysteryAmulet >= 20 },
            { icon: '🥁', label: '六星太鼓结界卡', val: `${res.taigu6} 张`, sub: `斗鱼:${res.douyu6} / 伞室内:${res.sanshinei6}`, hl: res.taigu6 >= 30 },
            { icon: '🐍', label: '大蛇的逆鳞 (金鳞片)', val: formatWan(res.goldScale), sub: `紫鳞片: ${formatWan(res.purpleScale)}`, hl: res.goldScale >= 5000 },
            { icon: '🔥', label: '逢魔之魂', val: formatWan(res.fengmoSoul), sub: '首领御魂赌魂核心资源', hl: res.fengmoSoul >= 2000 },
            { icon: '⚡', label: '体力储备', val: formatWan(res.strength), sub: `金币: ${formatWan(res.coin)}`, hl: res.strength >= 10000 }
        ];

        return `
            <!-- 1. 硬通货与养成资源矩阵 -->
            <div class="cbgh-section-card">
                <div class="cbgh-section-header">
                    <div class="cbgh-section-title">🏮 账号硬通货与核心养成资源一览</div>
                    <div class="cbgh-section-desc">直接从藏宝阁底层 JSON 提取全量货币、达摩、结界卡与御魂材料</div>
                </div>
                <div class="cbgh-kpi-strip" style="padding:0;border:none;">
                    ${resourceItems.map(item => `
                        <div class="cbgh-kpi-card" style="${item.hl ? 'border-color:#fbbf24;background:linear-gradient(180deg,#fffbeb 0%,#fef3c7 100%);' : ''}">
                            <div class="cbgh-kpi-label">${item.icon} ${escapeHtml(item.label)}</div>
                            <div class="cbgh-kpi-val" style="${item.hl ? 'color:#b45309;' : ''}">${escapeHtml(item.val)}</div>
                            <div class="cbgh-kpi-sub">${escapeHtml(item.sub)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- 2. 式神收集率与核心人权式神持有检视 -->
            <div class="cbgh-section-card">
                <div class="cbgh-section-header">
                    <div class="cbgh-section-title">🎎 式神图鉴收集率与版本核心式神持有情况</div>
                    <div class="cbgh-section-desc">
                        SSR收集: <b>${ssrGot}/${ssrAll}</b> ·
                        SP收集: <b>${spGot}/${spAll}</b> ·
                        联动收集: <b>${xGot}/${xAll}</b> ·
                        六星式神总数: <b>${res.sixStarHeroCount}</b> 只
                    </div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                    ${Object.entries(res.keyHeroCounts).map(([hName, cnt]) => `
                        <span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;border:1px solid ${cnt > 0 ? '#a7f3d0' : '#e2e8f0'};background:${cnt > 0 ? '#ecfdf5' : '#f8fafc'};color:${cnt > 0 ? '#065f46' : '#94a3b8'};">
                            ${cnt > 0 ? '✅' : '⚪'} ${escapeHtml(hName)} ${cnt > 1 ? `<b>×${cnt} (多号机)</b>` : (cnt === 1 ? '×1' : '未持有')}
                        </span>
                    `).join('')}
                </div>
            </div>

            <!-- 3. 臻藏皮肤、庭院皮肤与高价值外观 -->
            <div class="cbgh-section-card">
                <div class="cbgh-section-header">
                    <div class="cbgh-section-title">👑 臻藏皮肤、庭院/召唤屋/幕间外观与荣誉框资产</div>
                    <div class="cbgh-section-desc">
                        臻藏 <b>${res.zhencangSkins.length}</b> ·
                        庭院 <b>${res.yardSkins.length}</b> ·
                        召唤屋 <b>${res.gambleSkins.length}</b> ·
                        幕间 <b>${res.shishenluSkins.length}</b> ·
                        战斗主题 <b>${res.battleSkins.length}</b>
                    </div>
                </div>
                <div style="font-size:12px;line-height:1.8;color:#334155;">
                    <div><strong>👑 臻藏皮肤 (${res.zhencangSkins.length}个):</strong> ${res.zhencangSkins.length ? res.zhencangSkins.map(s => `<span style="background:#fef3c7;color:#92400e;border:1px solid #fbbf24;padding:1px 6px;border-radius:4px;margin:2px;display:inline-block;font-weight:700;">${escapeHtml(s)}</span>`).join('') : '<span style="color:#94a3b8;">无</span>'}</div>
                    <div><strong>🌸 庭院皮肤 (${res.yardSkins.length}个):</strong> ${res.yardSkins.length ? res.yardSkins.map(s => `<span style="background:#f1f5f9;padding:1px 6px;border-radius:4px;margin:2px;display:inline-block;">${escapeHtml(s)}</span>`).join('') : '<span style="color:#94a3b8;">无</span>'}</div>
                    <div><strong>🏮 召唤屋皮肤 (${res.gambleSkins.length}个):</strong> ${res.gambleSkins.length ? res.gambleSkins.map(s => `<span style="background:#f1f5f9;padding:1px 6px;border-radius:4px;margin:2px;display:inline-block;">${escapeHtml(s)}</span>`).join('') : '<span style="color:#94a3b8;">无</span>'}</div>
                    <div><strong>🎭 幕间皮肤 (${res.shishenluSkins.length}个):</strong> ${res.shishenluSkins.length ? res.shishenluSkins.map(s => `<span style="background:#f1f5f9;padding:1px 6px;border-radius:4px;margin:2px;display:inline-block;">${escapeHtml(s)}</span>`).join('') : '<span style="color:#94a3b8;">无</span>'}</div>
                    <div><strong>⚔️ 战斗皮肤 (${res.battleSkins.length}个):</strong> ${res.battleSkins.length ? res.battleSkins.map(s => `<span style="background:${s.includes('藏金台阁') ? '#fef3c7;color:#b45309;font-weight:700;' : '#f1f5f9;'};padding:1px 6px;border-radius:4px;margin:2px;display:inline-block;">${escapeHtml(s)}</span>`).join('') : '<span style="color:#94a3b8;">无</span>'}</div>
                </div>
            </div>
        `;
    }

    // ==================== 18. 主界面渲染与事件绑定 ====================
    function renderMainDashboard(forceUpdate = false) {
        if (!AppState.ready) return;
        injectStyles();

        const targetContainer = document.getElementsByClassName('content-overview')[0]
            || document.getElementsByClassName('yuhun-list')[0]?.parentElement
            || document.getElementsByClassName('content-top-left')[0]
            || document.querySelector('.content-wrap')
            || document.querySelector('.module-selling-info')?.parentElement;
        if (!targetContainer) return;

        let container = document.getElementById('cbghelper_highlight');
        if (container && !forceUpdate) return;
        if (!container) {
            container = document.createElement('div');
            container.id = 'cbghelper_highlight';
            container.className = 'module';
            if (targetContainer.classList?.contains('content-overview')) {
                targetContainer.insertBefore(container, targetContainer.firstChild);
            } else {
                targetContainer.insertBefore(container, targetContainer.firstChild);
            }
        }
        ensureFloatingTrigger();

        // 计算顶部 KPI 摘要
        const san1 = solveSpeedScheme({ suitName: '散件', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' });
        const zc1 = solveSpeedScheme({ suitName: '招财猫', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' });
        const hl1 = solveSpeedScheme({ suitName: '火灵', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' });
        const xyqBest = AppState.outputSummary?.xueyuqian?.schemeResults?.[0]?.solved;
        const pjmDefBest = AppState.outputSummary?.pingjiangmen?.schemeResults?.[0]?.solved;
        const pjmAtkBest = AppState.outputSummary?.pingjiangmen?.schemeResults?.[2]?.solved;
        const emb = AppState.embryoStats;
        const res = AppState.resourceSummary;
        const compareCount = loadCompareAccounts().length;

        const tab = AppState.activeMainTab;

        container.innerHTML = `
            <!-- 顶部品牌与快捷下载对比工具栏 -->
            <div class="cbgh-topbar">
                <div class="cbgh-brand">
                    <div class="cbgh-brand-title">⚡ 御魂与面板工作台</div>
                    <span class="cbgh-brand-badge">v2.0 专业增强版</span>
                    ${res.sellerName ? `<span style="font-size:12px;color:#cbd5e1;">卖家: <b>${escapeHtml(res.sellerName)}</b></span>` : ''}
                </div>
                <div class="cbgh-toolbar">
                    <button type="button" class="cbgh-action-btn gold" id="cbgh-btn-add-compare" title="将当前账号加入本地对比篮，支持跨页面多账号同屏横向对比">➕ 加入对比</button>
                    <button type="button" class="cbgh-action-btn emerald" id="cbghelper-btn-open-compare" title="打开多账号横向对比面板，支持导入JSON与导出CSV对比报告">📊 对比篮 (${compareCount})</button>
                    <button type="button" class="cbgh-action-btn" id="cbghelper_download" title="导出 yuhun_ocr2.0 格式御魂 JSON，可直接导入御魂计算器">💾 导出御魂JSON</button>
                    <button type="button" class="cbgh-action-btn" id="cbghelper_export_raw" title="导出藏宝阁原始 JSON 数据用于备份或对比">📦 导出原始JSON</button>
                    <button type="button" class="cbgh-action-btn" id="cbghelper_cache_info" title="查看当前内存缓存详情">ℹ️ 缓存信息</button>
                    <button type="button" class="cbgh-action-btn" id="cbgh-btn-color-settings" title="自定义单位置与套装一速档位颜色">🎨 速度配色</button>
                    <button type="button" class="cbgh-action-btn" id="cbghelper_manual_fetch" title="重新请求藏宝阁接口刷新数据">🔄 刷新数据</button>
                </div>
            </div>

            <!-- 6大核心指标速览横幅 -->
            <div class="cbgh-kpi-strip">
                <div class="cbgh-kpi-card">
                    <div class="cbgh-kpi-label">⚡ 散件一速 / 满速数</div>
                    <div class="cbgh-kpi-val" style="color:${getSuitSpeedColor(san1.totalSpeed)};">+${san1.totalSpeed.toFixed(2)}</div>
                    <div class="cbgh-kpi-sub">满速 ${emb.speedRolls6Count} 颗 · 真17 ${emb.true17Count} 颗</div>
                </div>
                <div class="cbgh-kpi-card">
                    <div class="cbgh-kpi-label">🐱 招财一速 / 火灵一速</div>
                    <div class="cbgh-kpi-val" style="color:${getSuitSpeedColor(zc1.totalSpeed)};">+${zc1.totalSpeed.toFixed(2)}</div>
                    <div class="cbgh-kpi-sub">火灵: +${hl1.totalSpeed.toFixed(2)}</div>
                </div>
                <div class="cbgh-kpi-card">
                    <div class="cbgh-kpi-label">❄️ 雪御前 (海歌超星)</div>
                    <div class="cbgh-kpi-val" style="color:#0284c7;">${xyqBest?.valid ? xyqBest.panelWan + 'w' : '未满暴'}</div>
                    <div class="cbgh-kpi-sub">${xyqBest?.valid ? `攻${Math.round(xyqBest.finalAtk)} · 爆${xyqBest.finalCdmg.toFixed(0)}%` : '点击输出面板查看'}</div>
                </div>
                <div class="cbgh-kpi-card">
                    <div class="cbgh-kpi-label">🔥 平将门 (防守 / 攻击)</div>
                    <div class="cbgh-kpi-val" style="color:#dc2626;">${pjmDefBest?.valid ? pjmDefBest.panelWan + 'w' : '-'} / ${pjmAtkBest?.valid ? pjmAtkBest.panelWan + 'w' : '-'}</div>
                    <div class="cbgh-kpi-sub">${pjmDefBest?.valid ? `守:${Math.round(pjmDefBest.finalDef)}防(${pjmDefBest.atkDefRatio.toFixed(2)}x)` : '双架势智能计算'}</div>
                </div>
                <div class="cbgh-kpi-card">
                    <div class="cbgh-kpi-label">💎 满条胚子 / 极品输出</div>
                    <div class="cbgh-kpi-val" style="color:#d97706;">${emb.fullLegs4Count} / ${emb.outputRolls9Count + emb.outputRolls8Count}</div>
                    <div class="cbgh-kpi-sub">二号双速:${emb.pos2DualSpeedCount} · 首领10+:${emb.bossHighScoreCount}</div>
                </div>
                <div class="cbgh-kpi-card">
                    <div class="cbgh-kpi-label">🏮 黑蛋 / 魂玉 / 臻藏</div>
                    <div class="cbgh-kpi-val" style="color:#059669;">${res.blackDamo} / ${formatWan(res.hunyu)} / ${res.zhencangSkins.length}</div>
                    <div class="cbgh-kpi-sub">太鼓:${res.taigu6} · 庭院:${res.yardSkins.length}</div>
                </div>
            </div>

            <!-- 四大模块 + 全展开模式 导航栏 -->
            <div class="cbgh-nav-tabs">
                <button type="button" class="cbgh-nav-tab ${tab === 'tab-pvp-speed' ? 'active' : ''}" data-tab="tab-pvp-speed">⚡ PVP 一速与御魂配装工作台</button>
                <button type="button" class="cbgh-nav-tab ${tab === 'tab-output-panel' ? 'active' : ''}" data-tab="tab-output-panel">⚔️ PVE / PVP 输出面板 (雪御前 & 平将门)</button>
                <button type="button" class="cbgh-nav-tab ${tab === 'tab-embryo' ? 'active' : ''}" data-tab="tab-embryo">💎 御魂胚子数量与定义评估</button>
                <button type="button" class="cbgh-nav-tab ${tab === 'tab-resources' ? 'active' : ''}" data-tab="tab-resources">🏮 账号资源与外观总览</button>
                <button type="button" class="cbgh-nav-tab ${tab === 'tab-all' ? 'active' : ''}" data-tab="tab-all">📋 全部展开同屏浏览</button>
            </div>

            <!-- 主体内容区 -->
            <div class="cbgh-tab-body">
                ${(tab === 'tab-pvp-speed' || tab === 'tab-all') ? renderTabPvpSpeed() : ''}
                ${(tab === 'tab-output-panel' || tab === 'tab-all') ? renderTabOutputPanel() : ''}
                ${(tab === 'tab-embryo' || tab === 'tab-all') ? renderTabEmbryo() : ''}
                ${(tab === 'tab-resources' || tab === 'tab-all') ? renderTabResources() : ''}
            </div>
        `;

        bindDashboardEvents(container);
    }

    function bindDashboardEvents(container) {
        // 顶部工具栏按钮
        container.querySelector('#cbghelper_download')?.addEventListener('click', exportYuhunOcrJsonFile);
        container.querySelector('#cbghelper_export_raw')?.addEventListener('click', exportRawJsonFile);
        container.querySelector('#cbghelper_cache_info')?.addEventListener('click', showCacheInfoAlert);
        container.querySelector('#cbghelper_manual_fetch')?.addEventListener('click', manualFetchEquipData);
        container.querySelector('#cbgh-btn-color-settings')?.addEventListener('click', openColorSettingsModal);
        container.querySelector('#cbgh-btn-add-compare')?.addEventListener('click', () => {
            if (addCurrentAccountToCompare()) {
                const btn = container.querySelector('#cbgh-btn-add-compare');
                if (btn) {
                    btn.textContent = '✅ 已加入对比';
                    setTimeout(() => { btn.textContent = '➕ 加入对比'; }, 1500);
                }
            }
        });
        container.querySelector('#cbghelper-btn-open-compare')?.addEventListener('click', openCompareModal);

        // 主标签页切换
        container.querySelectorAll('.cbgh-nav-tab').forEach(btn => {
            btn.addEventListener('click', function () {
                AppState.activeMainTab = this.dataset.tab;
                renderMainDashboard(true);
            });
        });

        // 御魂方案工作台：快捷主属性预设按钮
        container.querySelectorAll('.cbgh-scheme-preset-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const pid = this.dataset.presetId;
                const found = SPEED_SCHEME_PRESETS.find(p => p.id === pid);
                if (found) {
                    AppState.schemeSelector.presetId = found.id;
                    AppState.schemeSelector.pos2Main = found.pos2;
                    AppState.schemeSelector.pos4Main = found.pos4;
                    AppState.schemeSelector.pos6Main = found.pos6;
                    AppState.schemeSelector.twoPiece = found.twoPiece;
                    AppState.schemeSelector.fullCrit = found.fullCrit;
                    AppState.schemeSelector.activeSetIdx = 0;
                    renderMainDashboard(true);
                }
            });
        });

        // 御魂方案工作台：下拉框修改
        const bindSelectChange = (selId, field) => {
            const el = container.querySelector(selId);
            if (el) {
                el.addEventListener('change', function () {
                    AppState.schemeSelector[field] = this.type === 'checkbox' ? this.checked : this.value;
                    if (field !== 'suitName') AppState.schemeSelector.presetId = 'custom';
                    renderMainDashboard(true);
                });
            }
        };
        bindSelectChange('#cbgh-sel-suit', 'suitName');
        bindSelectChange('#cbgh-sel-pos2', 'pos2Main');
        bindSelectChange('#cbgh-sel-pos4', 'pos4Main');
        bindSelectChange('#cbgh-sel-pos6', 'pos6Main');
        bindSelectChange('#cbgh-sel-twopiece', 'twoPiece');
        bindSelectChange('#cbgh-sel-fullcrit', 'fullCrit');

        // 第1/2/3套独立切换
        container.querySelectorAll('.cbgh-set-idx-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                AppState.schemeSelector.activeSetIdx = Number(this.dataset.setIdx) || 0;
                renderMainDashboard(true);
            });
        });

        // 多套独立拆分策略切换
        container.querySelectorAll('.cbgh-strat-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                AppState.independentStrategyId = this.dataset.strat;
                renderMainDashboard(true);
            });
        });

        // 全套装矩阵行点击载入工作台
        container.querySelectorAll('tr[data-load-suit]').forEach(row => {
            row.addEventListener('click', function () {
                AppState.schemeSelector.suitName = this.dataset.loadSuit;
                AppState.schemeSelector.activeSetIdx = 0;
                renderMainDashboard(true);
                document.getElementById('cbgh-scheme-workbench')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        });

        // 输出面板预设行点击切换 1~6 号位御魂明细
        container.querySelectorAll('.cbgh-output-preset-row').forEach(row => {
            row.addEventListener('click', function () {
                AppState.outputSelector.selectedCardKey = this.dataset.cardKey;
                renderMainDashboard(true);
                document.getElementById('cbgh-output-detail-box')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        });

        // 自定义输出计算器按钮
        container.querySelector('#cbgh-out-calc-btn')?.addEventListener('click', function () {
            AppState.outputSelector.heroKey = container.querySelector('#cbgh-out-hero')?.value || 'xueyuqian';
            AppState.outputSelector.suit4 = container.querySelector('#cbgh-out-suit4')?.value || '海月火玉';
            AppState.outputSelector.suit2 = container.querySelector('#cbgh-out-suit2')?.value || '鬼灵歌伎';
            AppState.outputSelector.minSpd = Number(container.querySelector('#cbgh-out-spd')?.value) || 0;
            AppState.outputSelector.mode = container.querySelector('#cbgh-out-mode')?.value || 'atk_cdmg';
            AppState.outputSelector.selectedCardKey = 'custom';
            renderMainDashboard(true);
        });

        // 胚子分类筛选按钮
        container.querySelectorAll('.cbgh-embryo-filter-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                AppState.embryoFilter = this.dataset.embFilter;
                renderMainDashboard(true);
            });
        });
    }

    // ==================== 19. 多账号横向对比弹窗与导入/导出 ====================
    function openCompareModal() {
        injectStyles();
        let modal = document.getElementById('cbgh-compare-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'cbgh-compare-modal';
            modal.className = 'cbgh-modal-backdrop';
            document.body.appendChild(modal);
        }

        const list = loadCompareAccounts();

        const metrics = [
            { key: 'priceYuan', label: '💰 价格 (元)', higherBetter: false },
            { key: 'sanSpeed1', label: '⚡ 散件一速', higherBetter: true },
            { key: 'sanSpeed2', label: '⚡ 独立散件二速', higherBetter: true },
            { key: 'sanSpeed3', label: '⚡ 独立散件三速', higherBetter: true },
            { key: 'zhaocaiSpeed', label: '🐱 招财猫一速', higherBetter: true },
            { key: 'zcHpHpSpeed', label: '🛡️ 招财·速生生一速', higherBetter: true },
            { key: 'huolingSpeed', label: '🔥 火灵一速', higherBetter: true },
            { key: 'bangjingSpeed', label: '🐚 蚌精一速', higherBetter: true },
            { key: 'fullSpdCount', label: '🌟 6跳满速御魂数', higherBetter: true },
            { key: 'true17Count', label: '🔥 真17(≥17.0)御魂数', higherBetter: true },
            { key: 'dualSpdCount', label: '👑 二号位双速数', higherBetter: true },
            { key: 'fullLegs4Count', label: '💎 天生4腿满条胚子数', higherBetter: true },
            { key: 'output8PlusCount', label: '🗡️ 8~9条极品输出件数', higherBetter: true },
            { key: 'bossHighCount', label: '👹 10分+极品首领数', higherBetter: true },
            { key: 'xyqPanel', label: '❄️ 雪御前 (海歌超星面板)', higherBetter: true },
            { key: 'pjmDefPanel', label: '🛡️ 平将门 (防守架势面板)', higherBetter: true },
            { key: 'pjmAtkPanel', label: '⚔️ 平将门 (攻击架势面板)', higherBetter: true },
            { key: 'tzPanel', label: '☀️ 天照 (海荒超星面板)', higherBetter: true },
            { key: 'xzPanel', label: '⚡ 须佐之男 (狂歌超星面板)', higherBetter: true },
            { key: 'blackDamo', label: '🎱 御行达摩(黑蛋)', higherBetter: true },
            { key: 'hunyu', label: '💎 魂玉', higherBetter: true },
            { key: 'gouyu', label: '🌙 勾玉', higherBetter: true },
            { key: 'zhencangCount', label: '👑 臻藏皮肤数', higherBetter: true },
            { key: 'yardSkinCount', label: '🌸 庭院皮肤数', higherBetter: true }
        ];

        const rowsHtml = metrics.map(m => {
            const nums = list.map(a => parseFloat(a[m.key])).filter(n => !isNaN(n) && n > 0);
            const bestVal = nums.length > 0 ? (m.higherBetter ? Math.max(...nums) : Math.min(...nums)) : null;
            const cells = list.map(a => {
                const v = a[m.key];
                const isBest = bestVal !== null && parseFloat(v) === bestVal && nums.length > 1;
                return `<td style="${isBest ? 'background:#ecfdf5;color:#059669;font-weight:800;' : ''}">${escapeHtml(v ?? '-')}${isBest ? ' 🏆' : ''}</td>`;
            }).join('');
            return `<tr><td style="text-align:left;font-weight:700;">${escapeHtml(m.label)}</td>${cells}</tr>`;
        }).join('');

        modal.innerHTML = `
            <div class="cbgh-modal-box">
                <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:10px;margin-bottom:12px;">
                    <div>
                        <h2 style="margin:0;font-size:18px;color:#1e1b4b;">📊 藏宝阁多账号横向对比中心 (${list.length} 个账号)</h2>
                        <div style="font-size:12px;color:#64748b;margin-top:2px;">支持跨页面加入对比、导入已下载的原始 JSON 文件加入对比，以及一键导出 CSV 对比报告</div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <button type="button" class="cbgh-pill-btn active" id="cbgh-cmp-add-current">➕ 加入当前页账号</button>
                        <label class="cbgh-pill-btn" style="cursor:pointer;">
                            📂 导入JSON文件对比
                            <input type="file" id="cbgh-cmp-import-file" accept=".json" style="display:none;" multiple />
                        </label>
                        <button type="button" class="cbgh-pill-btn" id="cbgh-cmp-export-csv">📥 导出对比CSV</button>
                        <button type="button" class="cbgh-pill-btn" id="cbgh-cmp-clear" style="color:#dc2626;border-color:#fca5a5;">🗑️ 清空</button>
                        <button type="button" class="cbgh-pill-btn" id="cbgh-cmp-close" style="font-size:14px;">✖ 关闭</button>
                    </div>
                </div>

                ${list.length === 0 ? `
                    <div style="padding:40px;text-align:center;color:#64748b;background:#f8fafc;border-radius:8px;">
                        对比篮暂为空。请点击上方「➕ 加入当前页账号」或「📂 导入JSON文件对比」添加账号！
                    </div>
                ` : `
                    <div class="cbgh-table-wrap">
                        <table class="cbgh-table">
                            <thead>
                                <tr>
                                    <th style="text-align:left;min-width:160px;">对比维度 / 账号</th>
                                    ${list.map(a => `
                                        <th style="min-width:130px;">
                                            <div style="font-size:13px;color:#1e1b4b;">${escapeHtml(a.sellerName)}</div>
                                            <div style="font-size:10px;color:#64748b;font-weight:normal;">${escapeHtml(a.id)}</div>
                                            <button type="button" class="cbgh-cmp-del-one" data-del-id="${escapeHtml(a.id)}" style="margin-top:3px;font-size:10px;color:#dc2626;border:none;background:none;cursor:pointer;">[移除]</button>
                                        </th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;

        modal.style.display = 'block';

        modal.querySelector('#cbgh-cmp-close')?.addEventListener('click', () => { modal.style.display = 'none'; });
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

        modal.querySelector('#cbgh-cmp-add-current')?.addEventListener('click', () => {
            if (addCurrentAccountToCompare()) openCompareModal();
        });

        modal.querySelector('#cbgh-cmp-clear')?.addEventListener('click', () => {
            if (confirm('确定要清空对比篮中的所有账号吗？')) {
                saveCompareAccounts([]);
                updateCompareButtonBadge();
                openCompareModal();
            }
        });

        modal.querySelectorAll('.cbgh-cmp-del-one').forEach(btn => {
            btn.addEventListener('click', function () {
                const delId = this.dataset.delId;
                const next = loadCompareAccounts().filter(x => x.id !== delId);
                saveCompareAccounts(next);
                updateCompareButtonBadge();
                openCompareModal();
            });
        });

        // 导入本地下载的原始 JSON 文件加入对比
        modal.querySelector('#cbgh-cmp-import-file')?.addEventListener('change', async function () {
            const files = Array.from(this.files || []);
            if (!files.length) return;
            const prevState = {
                parsedMitamaList: AppState.parsedMitamaList,
                mitamaByPos: AppState.mitamaByPos,
                availableSuits: AppState.availableSuits,
                summary: AppState.summary,
                embryoStats: AppState.embryoStats,
                outputSummary: AppState.outputSummary,
                resourceSummary: AppState.resourceSummary,
                acctHighlight: AppState.acctHighlight
            };

            let importedCount = 0;
            for (const f of files) {
                try {
                    const txt = await f.text();
                    const parsed = JSON.parse(txt);
                    const rawEquip = parsed?.equip ? parsed.equip : (parsed?.data?.equip ? parsed.data.equip : null);
                    if (rawEquip && rawEquip.equip_desc) {
                        const ed = typeof rawEquip.equip_desc === 'string' ? JSON.parse(rawEquip.equip_desc) : rawEquip.equip_desc;
                        AppState.acctHighlight = ed;
                        buildFullAnalytics(ed.inventory || {}, ed.hero_history || {}, ed.head_skin_count || {}, ed, rawEquip);
                        const snap = buildAccountSnapshotForCompare();
                        if (snap) {
                            const curList = loadCompareAccounts();
                            const idx = curList.findIndex(x => x.id === snap.id);
                            if (idx >= 0) curList[idx] = snap;
                            else curList.push(snap);
                            saveCompareAccounts(curList);
                            importedCount++;
                        }
                    }
                } catch (err) {
                    console.error('[yyscbghelper] 导入对比JSON失败:', err);
                }
            }
            // 恢复当前页面状态
            Object.assign(AppState, prevState);
            updateCompareButtonBadge();
            if (importedCount > 0) {
                openCompareModal();
            } else {
                alert('❌ 未能从所选JSON文件中解析出藏宝阁账号数据，请选择通过本插件导出的 yys_raw_*.json 文件。');
            }
        });

        // 导出 CSV 对比报告
        modal.querySelector('#cbgh-cmp-export-csv')?.addEventListener('click', () => {
            const curList = loadCompareAccounts();
            if (!curList.length) return;
            const headers = ['指标名称', ...curList.map(a => `${a.sellerName}(${a.id})`)];
            const csvLines = [headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',')];
            metrics.forEach(m => {
                const row = [m.label, ...curList.map(a => a[m.key] ?? '-')];
                csvLines.push(row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));
            });
            const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `yys_cbg_compare_${Date.now()}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // ==================== 20. 速度配色自定义弹窗 ====================
    function openColorSettingsModal() {
        injectStyles();
        let modal = document.getElementById('cbghelper-settings-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'cbghelper-settings-modal';
            modal.className = 'cbgh-modal-backdrop';
            document.body.appendChild(modal);
        }

        const cfg = getColorConfig();
        const renderTierInputs = (tiers, type) => tiers.map((t, idx) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:6px;">
                <span style="font-weight:700;font-size:13px;">档位 ${idx + 1}：${escapeHtml(t.label)}</span>
                <div style="display:flex;align-items:center;gap:8px;">
                    <input type="color" data-type="${type}" data-idx="${idx}" value="${escapeHtml(t.color || '#333333')}" style="width:42px;height:30px;border:none;cursor:pointer;" />
                    <input type="text" data-type="${type}-txt" data-idx="${idx}" value="${escapeHtml((t.color || '#333333').toUpperCase())}" style="width:85px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px;font-family:monospace;" />
                </div>
            </div>
        `).join('');

        modal.innerHTML = `
            <div class="cbgh-modal-box" style="max-width:620px;">
                <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:10px;margin-bottom:12px;">
                    <h2 style="margin:0;font-size:17px;color:#1e1b4b;">🎨 自定义速度档位配色</h2>
                    <button type="button" class="cbgh-pill-btn" id="cbgh-color-close">✖ 关闭</button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                    <div>
                        <h3 style="margin:0 0 8px 0;font-size:14px;color:#4338ca;">📍 单位置速度颜色 (1~6号位)</h3>
                        ${renderTierInputs(cfg.speedColorConfig, 'speed')}
                    </div>
                    <div>
                        <h3 style="margin:0 0 8px 0;font-size:14px;color:#4338ca;">🎯 套装总一速颜色</h3>
                        ${renderTierInputs(cfg.suitSpeedColorConfig, 'suit')}
                    </div>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;">
                    <button type="button" class="cbgh-pill-btn" id="cbgh-color-reset" style="color:#dc2626;">🔄 恢复默认渐变</button>
                    <button type="button" class="cbgh-pill-btn active" id="cbgh-color-save">💾 保存并立即生效</button>
                </div>
            </div>
        `;

        modal.style.display = 'block';
        modal.querySelector('#cbgh-color-close')?.addEventListener('click', () => { modal.style.display = 'none'; });
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

        modal.querySelectorAll('input[type="color"]').forEach(inp => {
            inp.addEventListener('input', function () {
                const txt = modal.querySelector(`input[data-type="${this.dataset.type}-txt"][data-idx="${this.dataset.idx}"]`);
                if (txt) txt.value = this.value.toUpperCase();
            });
        });

        modal.querySelector('#cbgh-color-reset')?.addEventListener('click', () => {
            window.YysHelperColorConfig?.resetColorConfig?.();
            modal.style.display = 'none';
            renderMainDashboard(true);
        });

        modal.querySelector('#cbgh-color-save')?.addEventListener('click', () => {
            const newSpd = cfg.speedColorConfig.map((t, idx) => ({
                ...t,
                color: modal.querySelector(`input[data-type="speed"][data-idx="${idx}"]`)?.value || t.color
            }));
            const newSuit = cfg.suitSpeedColorConfig.map((t, idx) => ({
                ...t,
                color: modal.querySelector(`input[data-type="suit"][data-idx="${idx}"]`)?.value || t.color
            }));
            window.YysHelperColorConfig?.saveColorConfig?.(newSpd, newSuit);
            modal.style.display = 'none';
            renderMainDashboard(true);
        });
    }

    // ==================== 21. 卖家ID一键复制增强 ====================
    function injectCopySellerButton() {
        try {
            const sellingInfo = document.querySelector('.module-selling-info');
            if (!sellingInfo || sellingInfo.querySelector('.cbghelper-copy-seller-btn')) return;
            const sellerName = AppState.resourceSummary?.sellerName
                || window.YYS_CACHED_JSON_DATA?.data?.equip?.seller_name
                || '';
            if (!sellerName) return;

            const pEl = Array.from(sellingInfo.querySelectorAll('p')).find(p => p.textContent && p.textContent.includes('卖家:'));
            if (!pEl) return;

            const btn = document.createElement('button');
            btn.className = 'cbghelper-copy-seller-btn';
            btn.title = '复制卖家昵称';
            btn.style.cssText = 'margin-left:6px;padding:2px 6px;font-size:11px;border-radius:4px;border:1px solid #cbd5e1;background:#f8fafc;color:#475569;cursor:pointer;';
            btn.textContent = '📋 复制';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard?.writeText(sellerName).then(() => {
                    btn.textContent = '✅ 已复制';
                    setTimeout(() => { btn.textContent = '📋 复制'; }, 1500);
                });
            });
            pEl.appendChild(btn);
        } catch (e) {}
    }

    // 右下角悬浮快捷入口球（任何标签页随时呼出/定位到御魂与输出工作台）
    function ensureFloatingTrigger() {
        if (document.getElementById('cbgh-floating-ball')) return;
        if (!document.body) return;
        const ball = document.createElement('div');
        ball.id = 'cbgh-floating-ball';
        ball.style.cssText = 'position:fixed;right:18px;bottom:24px;z-index:99990;background:linear-gradient(135deg,#1e1b4b 0%,#4338ca 100%);color:#fef3c7;border:2px solid #fbbf24;border-radius:999px;padding:8px 14px;font-size:12px;font-weight:800;box-shadow:0 6px 20px rgba(30,27,75,0.35);cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none;';
        ball.innerHTML = '<span>⚡ 御魂/输出工作台</span>';
        ball.title = '点击立即定位到阴阳师CBG御魂与输出评估工作台';
        ball.addEventListener('click', async () => {
            if (!AppState.ready) {
                ball.innerHTML = '<span>⏳ 正在加载御魂数据...</span>';
                await manualFetchEquipData(true);
                ball.innerHTML = '<span>⚡ 御魂/输出工作台</span>';
            }
            renderMainDashboard(true);
            const el = document.getElementById('cbghelper_highlight');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        document.body.appendChild(ball);
    }

    async function switchTabAndScroll(tabName) {
        if (!AppState.ready) {
            await manualFetchEquipData(true);
        }
        if (tabName) {
            AppState.activeMainTab = tabName;
        }
        renderMainDashboard(true);
        const el = document.getElementById('cbghelper_highlight');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return true;
        }
        return false;
    }

    // ==================== 22. Bridge 消息监听与页面周期挂载 ====================
    window.addEventListener('message', function (event) {
        if (!event.data || event.data.source !== 'cbg-helper-bridge') return;
        const { type } = event.data;
        if (type === 'CBG_HELPER_OPEN_SETTINGS') {
            openColorSettingsModal();
            window.postMessage({ type: 'CBG_HELPER_SETTINGS_OPENED', source: 'cbg-helper-main' }, '*');
        } else if (type === 'CBG_HELPER_OPEN_COMPARE') {
            openCompareModal();
            window.postMessage({ type: 'CBG_HELPER_COMPARE_OPENED', source: 'cbg-helper-main' }, '*');
        } else if (type === 'CBG_HELPER_EXPORT_YUHUN') {
            exportYuhunOcrJsonFile();
            window.postMessage({ type: 'CBG_HELPER_YUHUN_EXPORTED', source: 'cbg-helper-main' }, '*');
        } else if (type === 'CBG_HELPER_ADD_COMPARE') {
            const ok = addCurrentAccountToCompare();
            window.postMessage({ type: 'CBG_HELPER_COMPARE_ADDED', source: 'cbg-helper-main', detail: { ok } }, '*');
        }
    });

    window.addEventListener('yys-data-ready', function () {
        setTimeout(() => {
            renderMainDashboard(true);
            renderTopHighlightTags(true);
            injectCopySellerButton();
        }, 120);
    });

    // 轻量级非阻塞挂载检查（不主动发起重复网络请求，避免触发藏宝阁风控或双倍解析卡顿）
    setInterval(function () {
        if (!document.URL.startsWith('https://yys.cbg.163.com/cgi/mweb/equip')) return;
        ensureFloatingTrigger();
        if (AppState.ready) {
            if (!document.getElementById('cbghelper_highlight')) {
                renderMainDashboard(false);
            }
            if (document.getElementsByClassName('highlight').length && !document.getElementById('cbghelper_exthighlight')) {
                renderTopHighlightTags(false);
            }
            injectCopySellerButton();
        }
    }, 800);

    // 暴露调试与测试接口到 window，方便外部脚本或控制台调用
    function getQuickSummaryForPopup() {
        if (!AppState.ready) return null;
        const emb = AppState.embryoStats || {};
        const san1 = solveSpeedScheme({ suitName: '散件', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' });
        const zc1 = solveSpeedScheme({ suitName: '招财猫', pos2Main: '速度', pos4Main: '不限', pos6Main: '不限' });
        const zcHpHp = solveSpeedScheme({ suitName: '招财猫', pos2Main: '速度', pos4Main: '生命加成', pos6Main: '生命加成' });
        ensureHeroOutputComputed('xueyuqian', true);
        ensureHeroOutputComputed('pingjiangmen', true);
        const xyqBest = AppState.outputSummary?.xueyuqian?.schemeResults?.[0]?.solved?.rawPanel || 0;
        const pjmDefBest = AppState.outputSummary?.pingjiangmen?.schemeResults?.[0]?.solved?.rawPanel || 0;
        const pjmAtkBest = AppState.outputSummary?.pingjiangmen?.schemeResults?.[2]?.solved?.rawPanel || 0;
        return {
            sanSpeed1: Number(san1.totalSpeed.toFixed(2)),
            zhaocaiSpeed: Number(zc1.totalSpeed.toFixed(2)),
            zcHpHpSpeed: Number(zcHpHp.totalSpeed.toFixed(2)),
            fullSpdCount: emb.speedRolls6Count || 0,
            true17Count: emb.true17Count || 0,
            dualSpdCount: emb.pos2DualSpeedCount || 0,
            fullLegs4Count: emb.fullLegs4Count || 0,
            xyqPanel: Math.round(xyqBest),
            pjmDefPanel: Math.round(pjmDefBest),
            pjmAtkPanel: Math.round(pjmAtkBest)
        };
    }

    window.YysHelperV2 = {
        AppState,
        processEquipResponse,
        solveSpeedScheme,
        solveSequentialIndependentSets,
        solveOutputPanel,
        analyzeEmbryoAndQuality,
        renderMainDashboard,
        openCompareModal,
        openColorSettingsModal,
        addCurrentAccountToCompare,
        exportYuhunOcrJsonFile,
        exportRawJsonFile,
        manualFetchEquipData,
        switchTabAndScroll,
        buildAccountSnapshotForCompare,
        getQuickSummaryForPopup
    };
})();