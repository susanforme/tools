# 日常工具扩展（2026-09-22）

新增工具入口全部进入首页生活工具分类和全局导航搜索，中英文文案同步。

| 路由 | 功能 |
| --- | --- |
| `/screen-test` | 纯色、灰阶、渐变、全屏、方向键切换 |
| `/gamepad-test` | SVG 实时手柄图、布局识别/手选、标准/原始/自定义映射、按键/扳机/摇杆、连接切换 |
| `/teleprompter` | 稿件滚动、调速、字号、镜像、全屏、键盘暂停 |
| `/poster-print` | 按毫米设置大图尺寸、A4 横/竖分页、重叠边、裁切标记、页码、PDF |
| `/ambient-sound` | 环境音/噪音独立混音、保存组合、定时停止 |
| `/focus-timer` | 多个命名倒计时、番茄钟、秒表、完成提醒 |
| `/screen-ruler` | 厘米/英寸刻度、已知长度校准、保存校准 |
| `/device-check` | 摄像头预览、麦克风音量/十秒试音回放、左右声道测试 |

## 社区依据与兼容边界

- [显示器测试反馈](https://www.reddit.com/r/Monitors/comments/10x56d4/i_build_a_simple_dead_pixel_test_tool_dead_pixel/)：方向键与自定义测试颜色。
- [浏览器提词器讨论](https://www.v2ex.com/t/1153668)：入门口播与无需安装的使用方式。
- [A4 大图拼接打印需求](https://www.reddit.com/r/software/comments/qvcbla)：将大图拆成可打印拼接的页面。打印时应选择实际大小/100%，不要自动缩放。
- [白噪音网页需求](https://www.v2ex.com/t/493484)、[混音工具讨论](https://v2ex.com/t/1181076)：独立音轨音量与组合。
- [简单计时器需求](https://www.reddit.com/r/productivity/comments/zf9kgd)。浏览器或设备休眠会延迟声音/通知，恢复页面后的剩余时间按截止时间计算。
- [手柄社区反馈](https://www.reddit.com/r/Controllers/comments/1vd889o/i_built_a_free_browserbased_gamepad_tester_for/)、[W3C Gamepad](https://w3c.github.io/gamepad/)：品牌外观与浏览器映射分开处理；只有 standard 保证标准位置。具体方案见 [手柄兼容说明](./gamepad-compatibility.md)。
- [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)：需要用户授权；停止或离开页面时关闭轨道，取消后的迟到授权也释放。

屏幕检测用于人工观察；直尺必须用实物校准。浏览器可见的手柄输入不能代表物理 USB 轮询率、端到端延迟或所有型号的兼容保证。

## 验证

- TypeScript：Web/API 均通过。
- Web：76 个测试文件、232 项检查；并行运行时一项既有 GraphQL 检查超时，独立复跑 3/3 通过。API 使用 Bun 原生测试，5/5 通过。
- 屏幕：实际全屏、方向键换色、Esc 退出；直尺：刷新保留校准、模拟缩放后提示重校准。
- 打印：浏览器上传图片/导出，实际生成并渲染检查 370×544mm 的 4 页 A4 PDF。
- 手柄：浏览器模拟 Xbox/PlayStation 输入，确认 SVG 动作、布局切换、断开重连；主键使用 Simple Icons SVG。
- 设备：浏览器模拟 640px 摄像头与麦克风输入，试音可播放，停止后所有轨道结束；回归覆盖迟到授权及音频初始化失败清理。
- 上述设备验证使用模拟输入；未进行实体手柄、摄像头、麦克风或纸张实测。
- 专注工具：提词滚动/暂停/Home/镜像/全屏通过；计时暂停保持、秒表切页签继续；雨/风/咖啡馆三轨解码循环、暂停、保存刷新及组合恢复通过。手机布局已检查。
- 最终生产构建通过；无新增运行时依赖，手柄图标复用已有 unplugin-icons / Simple Icons。
