# 《荒原回响》v1.5-alpha 真实浏览器性能矩阵

原始数据：`docs/browser-fps-1.5.0-alpha.1.json`  
浏览器：系统 Microsoft Edge，Playwright Core，headless  
场景：720p/1080p × 40/80/120 敌人 × 画质 0/1/2，共 18 场景  
采样：每场预热 45 帧，记录 180 个 rAF 间隔

## 结论

- 页面错误：0；
- 平均帧率范围：142.43～144.05 FPS（受当前 144 Hz 环境约束）；
- 最低 1% low：72.46 FPS，场景为 1080p / 120 敌人 / 画质 2；
- 18 场景均无超过 20 ms 的超预算帧，也无超过 33.3 ms 的严重帧；
- JS heap 采样范围：3.84～7.54 MiB；
- 当前硬件上 1080p/120 敌人仍高于项目 50 FPS 的 1% low 目标。

## 边界

这是实际 Edge 页面和真实 Canvas 绘制，不再是 Proxy/no-op Canvas 微基准；但 headless、当前显卡/驱动和 144 Hz 环境不能替代 Windows 10 低配机、Tauri WebView2 窗口、实体手柄或 8 分钟真人长局。`scripts/benchmark-render.js` 继续只作为函数调用微基准，不得引用为 FPS。
