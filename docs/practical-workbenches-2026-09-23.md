# 实用工具工作台（2026-09-23）

新增 20 项浏览器本地功能，按任务合并为 4 个入口。模式使用 `?tool=`
保存到 URL；输入仅保留在当前页面，结果可导出为 TXT、CSV 或 Markdown。

| #   | 工具             | 入口                                           |
| --- | ---------------- | ---------------------------------------------- |
| 1   | 墙面涂料估算     | `/home-projects?tool=paint`                    |
| 2   | 墙纸卷数估算     | `/home-projects?tool=wallpaper`                |
| 3   | 地板包数估算     | `/home-projects?tool=flooring`                 |
| 4   | 瓷砖与箱数估算   | `/home-projects?tool=tile`                     |
| 5   | 花床土壤袋数估算 | `/home-projects?tool=soil`                     |
| 6   | 盈亏平衡销量     | `/business-calculators?tool=breakEven`         |
| 7   | 目标毛利率定价   | `/business-calculators?tool=margin`            |
| 8   | 叠加折扣         | `/business-calculators?tool=discounts`         |
| 9   | 包裹体积重量     | `/business-calculators?tool=dimensionalWeight` |
| 10  | 库存补货点       | `/business-calculators?tool=reorder`           |
| 11  | 加权成绩         | `/study-planner?tool=weightedGrade`            |
| 12  | 期末目标分       | `/study-planner?tool=finalTarget`              |
| 13  | 学分绩点预测     | `/study-planner?tool=gpa`                      |
| 14  | 学习时间分配     | `/study-planner?tool=studyHours`               |
| 15  | 阅读进度         | `/study-planner?tool=readingPlan`              |
| 16  | 会议议程         | `/office-workbench?tool=agenda`                |
| 17  | RACI 职责矩阵    | `/office-workbench?tool=raci`                  |
| 18  | 决策记录         | `/office-workbench?tool=decisions`             |
| 19  | 库存盘点差额     | `/office-workbench?tool=stockCount`            |
| 20  | 操作清单         | `/office-workbench?tool=checklist`             |

计算依据：盈亏平衡使用
[SBA 的单件贡献公式](https://legacy.sba.gov/business-guide/plan-your-business/calculate-your-startup-costs/break-even-point)，补货点使用
[提前期需求加安全库存](https://www.shopify.com/blog/reorder-point)。体积重量除数由用户填写，因为[承运商和费率的除数可能不同](https://es-us-filexfer.ups.com/us/en/support/shipping-support/shipping-dimensions-weight)。家装结果按矩形/规则网格估算，复杂形状和现场损耗需由用户调整；成绩和绩点不套用特定学校的评分制度。

验证：15 个计算模式均有可计算结果；办公 5 种文档可生成，CSV 导出转义公式开头的文本。已检查中英文、窄屏布局、类型、构建和测试。
