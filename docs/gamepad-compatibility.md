# 手柄检测兼容范围

2026-09-22 查询社区与浏览器规范后实现。页面
`/gamepad-test`；未连接实体手柄进行硬件实测。

- 浏览器返回 `mapping === "standard"`
  时，依据 W3C 的位置约定使用 17 个按键、4 个摇杆轴。Xbox、PlayStation、Nintendo 外观分别显示相应标签，PlayStation 使用对称摇杆，Xbox
  / Switch 使用非对称摇杆。
- `id`
  仅用于外观推测，不证明硬件型号或输入映射。用户可手选外观。8BitDo 等可切换工作模式的设备默认通用外观，实际输入以浏览器报告为准。
- 非标准设备默认显示全部原始按键和轴，不套用 Xbox 索引。可手动将每个图示按钮绑定到原始按钮、正/负半轴、从 -1 到 1 或反向的完整轴；左右摇杆可分别选择轴和反向。映射与外观写入 URL，手动绑定明确限定为浏览器设备 ID 与插槽；其他设备不会复用，重新选择手动映射会清空不属于当前设备的绑定。当前设备选择和检测结果不写入 URL。
- `B0/B1`
  是浏览器编号，Nintendo 的字母顺序按位置而非 Xbox 字母解释。方向盘、独立 Joy-Con、街机摇杆及不完整手柄可以使用原始视图或手动映射，不承诺完整双摇杆图示适配。
- 逐帧读取当前快照，按键亮起、扳机填充和摇杆位移同步更新。摇杆轨迹最多保留 120 个不同位置。静止记录为 2 秒内径向偏移的平均值和峰值，原始小偏移不做死区过滤，不把它描述成硬件诊断结论。
- HTTPS 与受支持浏览器是前提；连接后通常须按一次手柄按钮以允许页面发现设备。浏览器权限策略禁止时显示读取错误。断开后清除当前设备，允许重新连接；停止、页面隐藏和卸载清理或暂停轮询，静止采样遇隐藏取消。

## 资料与社区需求

- [W3C Gamepad 规范](https://www.w3.org/TR/gamepad/)：标准映射由浏览器判定；索引可在断开后复用；按键值与轴值有独立数值范围。实现以
  `mapping` 而非设备名字决定是否套用标准输入。
- [MDN：Using the Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API)：连接事件、用户操作后可见性与
  `requestAnimationFrame` 读取循环。
- [PowerA Switch 用户报告：按键可用但摇杆读取不正确](https://www.reddit.com/r/Controller/comments/1cmhaub)：社区搜索结果显示设备标识可能不明确，体现保留原始视图和手动绑定的必要性。
- [Switch Pro 用户讨论网页测试中的死区误差](https://www.reddit.com/r/Controller/comments/1crotub)：社区搜索结果提示驱动/测试环境影响结果，所以页面不输出“硬件坏了”或通用合格阈值。

社区帖子正文抓取失败；上面社区摘要依据搜索结果片段，仅用于需求动机。映射技术结论依据 W3C 和 MDN，未据社区传言建立设备映射表。

## 主键品牌图标

Xbox 与 PlayStation 主键使用项目已有 Simple Icons 集合，通过 unplugin-icons 按需编译为 SVG；按下时跟随按钮改变颜色。来源：[Simple Icons](https://github.com/simple-icons/simple-icons)。
