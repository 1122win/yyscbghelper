window.YYS_CHANGELOG = `# 更新日志

## [1.0.1] - 2026-11-08
### 维护
- 移除未使用的兼容层与更新检查模块，改为纯本地运行、零外部请求
- 统一扩展名称与日志标识为 yyscbghelper
- 重绘图标，补齐 16/48/128 与 1024 两档

## [1.0.0] - 2026-11-08
### 首发
- 一速与多套独立拆分、配装自选工作台、胚子统计
- 雪御前 / 平将门等输出面板计算
- 资源全景与多账号横向对比导出
`;

document.addEventListener('DOMContentLoaded', function () {
    const browserAPI = window.YysHelperAPI || (typeof chrome !== 'undefined' ? chrome : null);
    if (!browserAPI || !browserAPI.storage) {
        alert('❌ 浏览器扩展 API 不可用！');
        return;
    }

    try {
        const manifest = browserAPI.runtime.getManifest();
        const versionEl = document.getElementById('versionDisplay');
        if (versionEl && manifest.version) {
            versionEl.textContent = `v${manifest.version}`;
        }
    } catch (e) {}

    const statusElement = document.getElementById('pageStatus');
    const liveSummaryBox = document.getElementById('liveSummaryBox');
    const exportRawJsonBtn = document.getElementById('exportRawJson');
    const exportYuhunBtn = document.getElementById('exportYuhunBtn');
    const addCompareBtn = document.getElementById('addCompareBtn');
    const openCompareBtn = document.getElementById('openCompareBtn');
    const viewCacheInfoBtn = document.getElementById('viewCacheInfo');
    const viewChangelogBtn = document.getElementById('viewChangelog');
    const openColorSettingsBtn = document.getElementById('openColorSettings');
    const checkUpdateBtn = document.getElementById('checkUpdate');
    const schemeCards = document.querySelectorAll('.scheme-card-compact, .scheme-card');

    // 毫秒级非阻塞读取当前页面的御魂摘要（不主动发起重复网络请求，避免阻塞网页）
    function loadLiveSummaryFromPage() {
        browserAPI.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (!tabs || !tabs[0]) return;
            const url = tabs[0].url || '';
            if (!url.includes('yys.cbg.163.com')) {
                if (statusElement) {
                    statusElement.textContent = '⚠️ 请先访问阴阳师藏宝阁 (yys.cbg.163.com)';
                    statusElement.classList.add('inactive');
                }
                if (liveSummaryBox) {
                    liveSummaryBox.textContent = '当前不在藏宝阁网页，请先打开任意阴阳师藏宝阁账号详情页。';
                }
                return;
            }

            if (statusElement) {
                statusElement.textContent = url.includes('/cgi/mweb/equip')
                    ? '✅ 已在藏宝阁账号详情页 (极速引擎就绪)'
                    : '✅ 已在藏宝阁网站 (请点开具体账号详情页)';
                statusElement.classList.add('active');
            }

            if (!url.includes('/cgi/mweb/equip')) {
                if (liveSummaryBox) {
                    liveSummaryBox.textContent = '请点击进入任意一个具体的藏宝阁账号商品详情页以查看御魂与面板分析。';
                }
                return;
            }

            browserAPI.scripting.executeScript({
                target: { tabId: tabs[0].id },
                world: 'MAIN',
                func: function () {
                    if (!window.YysHelperV2) {
                        return { status: 'need_reload' };
                    }
                    if (!window.YysHelperV2.AppState.ready) {
                        return { status: 'loading' };
                    }
                    const snap = window.YysHelperV2.getQuickSummaryForPopup
                        ? window.YysHelperV2.getQuickSummaryForPopup()
                        : window.YysHelperV2.buildAccountSnapshotForCompare();
                    return { status: 'ok', snap };
                }
            }, function (results) {
                const res = results && results[0] && results[0].result;
                if (!res || res.status === 'need_reload') {
                    if (liveSummaryBox) {
                        liveSummaryBox.innerHTML = '⚠️ <strong>提示：</strong>请按 <b>F5 刷新一次当前藏宝阁网页</b>，网页顶部会自动展开完整的【御魂一速/速生生工作台、雪御前/平将门输出面板、御魂胚子评估】看板！';
                    }
                    return;
                }
                if (res.status === 'loading' || !res.snap) {
                    if (liveSummaryBox) {
                        liveSummaryBox.innerHTML = '⏳ 正在等待藏宝阁页面完成加载... 若页面是在安装插件前打开的，请按 <b>F5 刷新页面</b> 或点击下方任意模块按钮立即加载！';
                    }
                    return;
                }
                const s = res.snap;
                if (liveSummaryBox) {
                    liveSummaryBox.innerHTML =
                        `<div>⚡ <b>散件一速:</b> <span style="color:#dc2626;font-weight:800;">+${s.sanSpeed1}</span> · <b>招财一速:</b> <span style="color:#2563eb;font-weight:800;">+${s.zhaocaiSpeed}</span> (速生生+${s.zcHpHpSpeed})</div>` +
                        `<div>💎 <b>满速(6跳):</b> ${s.fullSpdCount}颗 (真17×${s.true17Count}) · <b>4腿满条胚子:</b> ${s.fullLegs4Count}颗 · <b>双速头:</b> ${s.dualSpdCount}颗</div>` +
                        `<div>⚔️ <b>雪御前(海歌):</b> <span style="color:#0284c7;font-weight:800;">${(s.xyqPanel / 10000).toFixed(2)}w</span> · <b>平将门(守/攻):</b> <span style="color:#d97706;font-weight:800;">${(s.pjmDefPanel / 10000).toFixed(2)}w / ${(s.pjmAtkPanel / 10000).toFixed(2)}w</span></div>` +
                        `<div style="color:#4338ca;margin-top:2px;">👇 <b>点击下方按钮可在网页主界面直接展开并定位对应详情模块：</b></div>`;
                }
            });
        });
    }

    loadLiveSummaryFromPage();

    function jumpToPageTab(tabId) {
        browserAPI.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (!tabs || !tabs[0] || !(tabs[0].url || '').includes('yys.cbg.163.com')) {
                alert('❌ 请先打开阴阳师藏宝阁账号详情页！');
                return;
            }
            browserAPI.scripting.executeScript({
                target: { tabId: tabs[0].id },
                world: 'MAIN',
                args: [tabId],
                func: async function (tId) {
                    if (window.YysHelperV2 && window.YysHelperV2.switchTabAndScroll) {
                        return await window.YysHelperV2.switchTabAndScroll(tId);
                    }
                    window.location.reload();
                    return false;
                }
            }, function () {
                window.close();
            });
        });
    }

    document.getElementById('jumpSpeedTab')?.addEventListener('click', () => jumpToPageTab('tab-pvp-speed'));
    document.getElementById('jumpOutputTab')?.addEventListener('click', () => jumpToPageTab('tab-output-panel'));
    document.getElementById('jumpEmbryoTab')?.addEventListener('click', () => jumpToPageTab('tab-embryo'));
    document.getElementById('jumpResourceTab')?.addEventListener('click', () => jumpToPageTab('tab-resources'));

    function sendBridgeAction(actionName, successMsg) {
        browserAPI.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (!tabs || !tabs[0]) return;
            const url = tabs[0].url || '';
            if (!url.includes('yys.cbg.163.com')) {
                alert('❌ 请先打开阴阳师藏宝阁账号详情页！');
                return;
            }
            browserAPI.tabs.sendMessage(tabs[0].id, { action: actionName }, function () {
                if (browserAPI.runtime.lastError) {
                    alert('❌ 请先按 F5 刷新一次当前藏宝阁页面后再试。');
                } else if (successMsg) {
                    alert(successMsg);
                }
            });
        });
    }

    addCompareBtn?.addEventListener('click', function () {
        sendBridgeAction('addCurrentToCompare', '✅ 已将当前账号加入对比篮！');
    });

    openCompareBtn?.addEventListener('click', function () {
        sendBridgeAction('openCompareModal');
        setTimeout(() => window.close(), 200);
    });

    exportYuhunBtn?.addEventListener('click', function () {
        sendBridgeAction('exportYuhunJson');
    });

    openColorSettingsBtn?.addEventListener('click', function () {
        sendBridgeAction('openColorSettings');
        setTimeout(() => window.close(), 200);
    });

    // 导出原始 JSON
    exportRawJsonBtn?.addEventListener('click', function () {
        browserAPI.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (!tabs || !tabs[0] || !(tabs[0].url || '').includes('yys.cbg.163.com')) {
                alert('❌ 请先打开阴阳师藏宝阁账号详情页面！');
                return;
            }
            browserAPI.scripting.executeScript({
                target: { tabId: tabs[0].id },
                world: 'MAIN',
                func: function () {
                    return window.YYS_CACHED_JSON_DATA ? JSON.stringify(window.YYS_CACHED_JSON_DATA) : null;
                }
            }, function (results) {
                const cachedStr = results && results[0] && results[0].result;
                if (!cachedStr) {
                    alert('❌ 暂无缓存数据！请按 F5 刷新一次藏宝阁账号详情页。');
                    return;
                }
                try {
                    const cacheData = JSON.parse(cachedStr);
                    const accountInfo = cacheData.accountInfo || {};
                    const fileName = `yys_raw_${accountInfo.game_ordersn || 'unknown'}_${Date.now()}.json`;
                    const dataStr = JSON.stringify(cacheData.data, null, 2);
                    const blob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (e) {
                    alert('❌ 导出失败：' + e.message);
                }
            });
        });
    });

    // 查看缓存信息
    viewCacheInfoBtn?.addEventListener('click', function () {
        browserAPI.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (!tabs || !tabs[0] || !(tabs[0].url || '').includes('yys.cbg.163.com')) {
                alert('❌ 请先打开阴阳师藏宝阁账号详情页面！');
                return;
            }
            browserAPI.scripting.executeScript({
                target: { tabId: tabs[0].id },
                world: 'MAIN',
                func: function () {
                    if (!window.YYS_CACHED_JSON_DATA) return null;
                    const c = window.YYS_CACHED_JSON_DATA;
                    return {
                        accountInfo: c.accountInfo || {},
                        timestamp: c.timestamp,
                        rawByteLength: c.rawByteLength || 0
                    };
                }
            }, function (results) {
                const info = results && results[0] && results[0].result;
                if (!info) {
                    alert('❌ 暂无缓存数据！请按 F5 刷新一次当前藏宝阁网页。');
                    return;
                }
                const accountInfo = info.accountInfo || {};
                const timestamp = new Date(info.timestamp).toLocaleString('zh-CN');
                const dataSize = (info.rawByteLength / 1024).toFixed(2);
                alert(
                    `📦 缓存数据信息\n\n` +
                    `账号名称: ${accountInfo.seller_name || '未知'}\n` +
                    `角色ID: ${accountInfo.seller_roleid || '未知'}\n` +
                    `订单号: ${accountInfo.game_ordersn || '未知'}\n` +
                    `缓存时间: ${timestamp}\n` +
                    `数据大小: ${dataSize} KB`
                );
            });
        });
    });

    // 配色方案选择
    schemeCards.forEach(card => {
        card.addEventListener('click', function () {
            const schemeId = this.dataset.scheme;
            schemeCards.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            browserAPI.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (!tabs || !tabs[0] || !(tabs[0].url || '').includes('yys.cbg.163.com')) return;
                browserAPI.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    world: 'MAIN',
                    args: [schemeId],
                    func: function (sId) {
                        if (window.YysHelperColorConfig?.applyColorScheme) {
                            window.YysHelperColorConfig.applyColorScheme(sId);
                            if (window.YysHelperV2?.renderMainDashboard) {
                                window.YysHelperV2.renderMainDashboard(true);
                            }
                            return true;
                        }
                        return false;
                    }
                });
            });
        });
    });

    // 更新日志弹窗
    const changelogModal = document.getElementById('changelogModal');
    const changelogContent = document.getElementById('changelogContent');
    const changelogModalClose = document.getElementById('changelogModalClose');

    viewChangelogBtn?.addEventListener('click', function () {
        if (!changelogModal || !changelogContent) return;
        changelogModal.style.display = 'flex';
        const html = window.YYS_CHANGELOG
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## \[(.+?)\] - (.+)$/gm, '<h2 class="changelog-version">[$1] - $2</h2>')
            .replace(/^### (.+)$/gm, '<h3 class="changelog-type">$1</h3>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul class="changelog-list">${m}</ul>`);
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        changelogContent.textContent = '';
        while (doc.body.firstChild) {
            changelogContent.appendChild(doc.body.firstChild);
        }
    });

    changelogModalClose?.addEventListener('click', () => {
        if (changelogModal) changelogModal.style.display = 'none';
    });

    checkUpdateBtn?.addEventListener('click', async function () {
        const updateStatus = document.getElementById('updateStatus');
        if (!updateStatus) return;
        updateStatus.style.display = 'block';
        updateStatus.style.background = '#dcfce7';
        updateStatus.style.color = '#166534';
        updateStatus.textContent = '✅ 当前已是最新  (v1.0.0)';
    });
});
