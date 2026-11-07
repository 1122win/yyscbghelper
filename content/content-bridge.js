/**
 * yyscbghelper - Content Bridge (ISOLATED World 通信桥接模块)
 * 支持转发设置弹窗、多账号对比弹窗、导出御魂JSON等指令到 MAIN World
 * @version 2.0.0
 */
(function () {
    'use strict';

    console.log('[yyscbghelper-bridge] 桥接脚本已加载 (ISOLATED world)');
    const browserAPI = window.YysHelperAPI || (typeof chrome !== 'undefined' ? chrome : null);

    if (browserAPI && browserAPI.runtime && browserAPI.runtime.onMessage) {
        browserAPI.runtime.onMessage.addListener(function (request, sender, sendResponse) {
            console.log('[yyscbghelper-bridge] 收到来自 popup 的消息:', request);

            const actionMap = {
                openColorSettings: {
                    postType: 'CBG_HELPER_OPEN_SETTINGS',
                    ackType: 'CBG_HELPER_SETTINGS_OPENED'
                },
                openCompareModal: {
                    postType: 'CBG_HELPER_OPEN_COMPARE',
                    ackType: 'CBG_HELPER_COMPARE_OPENED'
                },
                exportYuhunJson: {
                    postType: 'CBG_HELPER_EXPORT_YUHUN',
                    ackType: 'CBG_HELPER_YUHUN_EXPORTED'
                },
                addCurrentToCompare: {
                    postType: 'CBG_HELPER_ADD_COMPARE',
                    ackType: 'CBG_HELPER_COMPARE_ADDED'
                }
            };

            const mapped = request && actionMap[request.action];
            if (mapped) {
                let responded = false;
                const handleMessage = function (event) {
                    if (event.data && event.data.type === mapped.ackType) {
                        responded = true;
                        window.removeEventListener('message', handleMessage);
                        sendResponse({ success: true, detail: event.data.detail || null });
                    }
                };
                window.addEventListener('message', handleMessage);
                window.postMessage({
                    type: mapped.postType,
                    source: 'cbg-helper-bridge',
                    payload: request.payload || null
                }, '*');

                setTimeout(() => {
                    window.removeEventListener('message', handleMessage);
                    if (!responded) {
                        sendResponse({ success: true });
                    }
                }, 1000);
                return true;
            }
            return false;
        });
        console.log('[yyscbghelper-bridge] ✅ 消息监听器已初始化');
    } else {
        console.warn('[yyscbghelper-bridge] ⚠️ Browser runtime API 不可用');
    }
})();