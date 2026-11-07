/**
 * yyscbghelper - 头像框与印记配置模块
 * @version 2.0.0
 */
(function () {
    'use strict';

    const seasonFrames = {
        '9011218': '巅峰英豪',
        '9011219': '巅峰翘楚',
        '9011220': '名士翘楚',
        '9011221': '名士无双'
    };

    const eventFrames = {
        '9011001': '日月同辉',
        '9011002': '大阴阳师',
        '9011003': '京都之主'
    };

    const specialFrames = {};

    window.YysHelperFrameConfig = {
        getSeasonFrameNames: function () {
            return seasonFrames;
        },
        getEventFrameNames: function () {
            return eventFrames;
        },
        getSpecialFrameNames: function () {
            return specialFrames;
        },
        getAllFrameNames: function () {
            return {
                ...seasonFrames,
                ...eventFrames,
                ...specialFrames
            };
        }
    };
})();