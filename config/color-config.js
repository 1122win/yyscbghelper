/**
 * yyscbghelper - 速度与面板配色配置模块
 * @version 2.0.0
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'cbghelper_color_config';

    const SPEED_TIERS = [
        { min: 17.5, max: Infinity, label: '17.5+' },
        { min: 17, max: 17.5, label: '17-17.5' },
        { min: 16.5, max: 17, label: '16.5-17' },
        { min: 16, max: 16.5, label: '16-16.5' },
        { min: 0, max: 16, label: '<16' }
    ];

    const SUIT_SPEED_TIERS = [
        { min: 160, max: Infinity, label: '>160' },
        { min: 159, max: 160, label: '159-160' },
        { min: 157, max: 159, label: '157-159' },
        { min: 155, max: 157, label: '155-157' },
        { min: 0, max: 155, label: '<155' }
    ];

    const COLOR_SCHEMES = [
        {
            id: 'default',
            name: '默认配色',
            description: '沉稳深色，简洁清晰',
            speedColorConfig: [
                { min: 17.5, max: Infinity, label: '17.5+', color: '#DC2626' },
                { min: 17, max: 17.5, label: '17-17.5', color: '#EA580C' },
                { min: 16.5, max: 17, label: '16.5-17', color: '#D97706' },
                { min: 16, max: 16.5, label: '16-16.5', color: '#2563EB' },
                { min: 0, max: 16, label: '<16', color: '#64748B' }
            ],
            suitSpeedColorConfig: [
                { min: 160, max: Infinity, label: '>160', color: '#DC2626' },
                { min: 159, max: 160, label: '159-160', color: '#EA580C' },
                { min: 157, max: 159, label: '157-159', color: '#D97706' },
                { min: 155, max: 157, label: '155-157', color: '#2563EB' },
                { min: 0, max: 155, label: '<155', color: '#64748B' }
            ]
        },
        {
            id: 'scheme1',
            name: '经典渐变',
            description: '从热烈的红色过渡到温和的橙色，经典视觉感受',
            speedColorConfig: [
                { min: 17.5, max: Infinity, label: '17.5+', color: '#D32F2F' },
                { min: 17, max: 17.5, label: '17-17.5', color: '#F44336' },
                { min: 16.5, max: 17, label: '16.5-17', color: '#FF6F00' },
                { min: 16, max: 16.5, label: '16-16.5', color: '#FFA726' },
                { min: 0, max: 16, label: '<16', color: '#78909C' }
            ],
            suitSpeedColorConfig: [
                { min: 160, max: Infinity, label: '>160', color: '#D32F2F' },
                { min: 159, max: 160, label: '159-160', color: '#F44336' },
                { min: 157, max: 159, label: '157-159', color: '#FF6F00' },
                { min: 155, max: 157, label: '155-157', color: '#FFA726' },
                { min: 0, max: 155, label: '<155', color: '#94A3B8' }
            ]
        },
        {
            id: 'scheme2',
            name: '冷色科技',
            description: '从神秘的紫色过渡到清新的青蓝，现代科技风格',
            speedColorConfig: [
                { min: 17.5, max: Infinity, label: '17.5+', color: '#6A1B9A' },
                { min: 17, max: 17.5, label: '17-17.5', color: '#8E24AA' },
                { min: 16.5, max: 17, label: '16.5-17', color: '#5E35B1' },
                { min: 16, max: 16.5, label: '16-16.5', color: '#1E88E5' },
                { min: 0, max: 16, label: '<16', color: '#78909C' }
            ],
            suitSpeedColorConfig: [
                { min: 160, max: Infinity, label: '>160', color: '#6A1B9A' },
                { min: 159, max: 160, label: '159-160', color: '#8E24AA' },
                { min: 157, max: 159, label: '157-159', color: '#3949AB' },
                { min: 155, max: 157, label: '155-157', color: '#1E88E5' },
                { min: 0, max: 155, label: '<155', color: '#94A3B8' }
            ]
        },
        {
            id: 'scheme3',
            name: '暖色活力',
            description: '从激情的玫红过渡到温暖的金橙，充满活力',
            speedColorConfig: [
                { min: 17.5, max: Infinity, label: '17.5+', color: '#C2185B' },
                { min: 17, max: 17.5, label: '17-17.5', color: '#E91E63' },
                { min: 16.5, max: 17, label: '16.5-17', color: '#F06292' },
                { min: 16, max: 16.5, label: '16-16.5', color: '#FF6F00' },
                { min: 0, max: 16, label: '<16', color: '#78909C' }
            ],
            suitSpeedColorConfig: [
                { min: 160, max: Infinity, label: '>160', color: '#C2185B' },
                { min: 159, max: 160, label: '159-160', color: '#E91E63' },
                { min: 157, max: 159, label: '157-159', color: '#EC407A' },
                { min: 155, max: 157, label: '155-157', color: '#FF6F00' },
                { min: 0, max: 155, label: '<155', color: '#94A3B8' }
            ]
        }
    ];

    const defaultSpeedColorConfig = COLOR_SCHEMES[1].speedColorConfig;
    const defaultSuitSpeedColorConfig = COLOR_SCHEMES[1].suitSpeedColorConfig;

    function normalizeTiers(tiers, referenceTiers) {
        if (!Array.isArray(tiers) || tiers.length !== referenceTiers.length) {
            return referenceTiers.map(t => ({ ...t }));
        }
        return tiers.map((item, idx) => ({
            min: referenceTiers[idx].min,
            max: referenceTiers[idx].max,
            label: referenceTiers[idx].label,
            color: item.color || referenceTiers[idx].color || '#333333'
        }));
    }

    function loadColorConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return {
                    speedColorConfig: normalizeTiers(defaultSpeedColorConfig, defaultSpeedColorConfig),
                    suitSpeedColorConfig: normalizeTiers(defaultSuitSpeedColorConfig, defaultSuitSpeedColorConfig)
                };
            }
            const parsed = JSON.parse(raw);
            return {
                speedColorConfig: normalizeTiers(parsed.speedColorConfig, defaultSpeedColorConfig),
                suitSpeedColorConfig: normalizeTiers(parsed.suitSpeedColorConfig, defaultSuitSpeedColorConfig)
            };
        } catch (e) {
            return {
                speedColorConfig: normalizeTiers(defaultSpeedColorConfig, defaultSpeedColorConfig),
                suitSpeedColorConfig: normalizeTiers(defaultSuitSpeedColorConfig, defaultSuitSpeedColorConfig)
            };
        }
    }

    function saveColorConfig(speedColorConfig, suitSpeedColorConfig) {
        try {
            const data = {
                speedColorConfig: normalizeTiers(speedColorConfig, defaultSpeedColorConfig),
                suitSpeedColorConfig: normalizeTiers(suitSpeedColorConfig, defaultSuitSpeedColorConfig)
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('[yyscbghelper] 保存颜色配置失败:', e);
            return false;
        }
    }

    function resetColorConfig() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            return loadColorConfig();
        } catch (e) {
            return loadColorConfig();
        }
    }

    function getAllColorSchemes() {
        return COLOR_SCHEMES;
    }

    function applyColorScheme(schemeId) {
        const found = COLOR_SCHEMES.find(s => s.id === schemeId);
        if (!found) return false;
        return saveColorConfig(found.speedColorConfig, found.suitSpeedColorConfig);
    }

    window.YysHelperColorConfig = {
        loadColorConfig,
        saveColorConfig,
        resetColorConfig,
        getAllColorSchemes,
        applyColorScheme,
        defaultSpeedColorConfig,
        defaultSuitSpeedColorConfig,
        SPEED_TIERS,
        SUIT_SPEED_TIERS
    };
})();