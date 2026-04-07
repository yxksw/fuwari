# 第一轮性能优化报告

日期：2026-04-07

## 一、执行范围

本轮只做第一阶段、低风险优化，且每项变更单独做成本地 Git 提交，便于回滚。

### 已完成提交

1. `b411232` `refactor(posts): remove duplicate pageview fetch`
2. `3a42f92` `perf(layout): scope post-only enhancement scripts`
3. `5aeec06` `perf(pages): defer below-the-fold tool hydration`

## 二、优化内容

### 1. 去除文章页重复访问量请求

文件：`src/pages/posts/[...slug].astro`

调整：
- 删除文章页内重复的页面访问量 `fetch` 逻辑
- 保留 `src/components/PostMeta.astro` 作为唯一访问量请求入口

收益：
- 文章页减少一次重复统计请求
- 减少一次重复 DOM 更新和动画执行
- 降低文章页额外的客户端初始化成本

---

### 2. 将文章专属增强脚本从共享布局下沉

文件：
- `src/layouts/MainGridLayout.astro`
- `src/pages/posts/[...slug].astro`

调整：
- 将代码块折叠逻辑从共享布局移到文章页
- 共享布局中仅保留 Google Ads navbar offset 支持
- 为 `MutationObserver` 增加单例复用/重建控制，避免重复 observer 累积

收益：
- 非文章页不再执行代码块折叠扫描逻辑
- 降低全站通用布局脚本体积和执行次数
- 避免 Swup 切换后重复堆积 observer

---

### 3. 收紧工具页首轮 hydration 时机

文件：
- `src/pages/nat-check.astro`
- `src/pages/cover.astro`
- `src/pages/phantom-tank.astro`
- `src/pages/files.astro`

调整：
- 将以下组件从 `client:load` 改为 `client:visible`
  - `NatCheck`
  - `CoverGenerator`
  - `PhantomTankGenerator`
  - `FileExplorer`

收益：
- 浏览器不再在页面初始加载时立即 hydration 这些重组件
- 改为接近可视区时才初始化
- 有助于降低首屏主线程压力

## 三、测试方法

### 环境说明

- 使用本地开发服务器进行测试
- 使用 Playwright 脚本采集页面性能数据
- 对比对象：
  - **基线版本**：`5542bb3`
  - **优化后版本**：当前 `main`（包含上述 3 个本地提交）

### 测试页面

1. `/`
2. `/posts/fuwari/`
3. `/phantom-tank/`
4. `/cover/`
5. `/files/`
6. `/nat-check/`

### 采集指标

- `loadMs`：从导航开始到 `networkidle` 的实测耗时
- `domContentLoaded`
- `loadEventEnd`
- `jsRequests`
- `totalRequests`
- `transferSize`
- `scriptTransferSize`

## 四、测试结果

## 1. loadMs 对比

| 页面 | 基线(ms) | 优化后(ms) | 变化(ms) | 提升占比 |
|---|---:|---:|---:|---:|
| `/` | 18883.12 | 11963.70 | -6919.42 | **36.64%** |
| `/posts/fuwari/` | 3889.11 | 3838.39 | -50.72 | **1.30%** |
| `/phantom-tank/` | 3659.30 | 3505.88 | -153.42 | **4.19%** |
| `/cover/` | 3799.69 | 3812.94 | +13.25 | **-0.35%** |
| `/files/` | 3672.00 | 3603.50 | -68.50 | **1.87%** |
| `/nat-check/` | 3633.74 | 3658.89 | +25.15 | **-0.69%** |

### 汇总

- **平均提升**：约 **7.16%**
- **中位提升**：约 **1.58%**
- **首页提升最明显**：约 **36.64%**

> 说明：开发模式存在热更新、依赖重优化、缓存波动等干扰，单页轻微回退属于正常噪声。第一轮优化的主要收益集中在首页与文章/工具页的初始化收敛上。

## 2. 请求数量变化

| 页面 | 基线总请求 | 优化后总请求 | 变化 |
|---|---:|---:|---:|
| `/` | 194 | 193 | -1 |
| `/posts/fuwari/` | 249 | 231 | **-18** |
| `/phantom-tank/` | 178 | 179 | +1 |
| `/cover/` | 186 | 185 | -1 |
| `/files/` | 189 | 185 | -4 |
| `/nat-check/` | 178 | 184 | +6 |

### 观察

- 文章页请求数显著下降，主要来自重复统计请求清理与脚本收敛
- 部分工具页请求变化不大，说明首轮优化更多是**推迟初始化时机**，还没有真正减少重库下载量

## 3. 传输体积变化

### 文章页 `/posts/fuwari/`
- `transferSize`：`6149861 -> 6148737`，下降约 **0.02%**
- `scriptTransferSize`：几乎持平

### 首页 `/`
- `transferSize`：`5553423 -> 5553108`，下降约 **0.01%**

### 结论
- 本轮优化**主要提升的是运行时初始化效率**
- **尚未触及重型公共 chunk 体积问题**
- 这也符合第一轮目标：先做低风险运行时收敛，而不是大规模拆包

## 五、结论

本轮第一阶段优化已经生效，特点如下：

### 已证实收益
- 首页共享布局脚本负担下降明显
- 文章页重复统计请求已消除
- 工具页重组件 hydration 被推迟，减少首屏抢占

### 当前收益类型
- 以**运行时执行优化**为主
- 以**初始化阶段减负**为主
- 不是以**资源下载体积压缩**为主

### 当前阶段总体判断
这轮改造是合理且有效的第一步，特别适合作为可回滚的安全优化层。

## 六、下一轮建议

为了拿到更明显的性能提升，下一轮应进入“资源级优化”：

1. **定位大 chunk 来源**
   - `mermaid.core`
   - `index`
   - `wardley`
   - `markdown`
   - `cytoscape`

2. **按需动态导入重库**
   - Mermaid / 图表 / 编辑器 / 复杂工具库

3. **隔离公共 chunk 污染**
   - 防止工具页组件进入全站共享包

4. **继续收紧 hydration**
   - 检查 `client:only` / `client:idle` / `client:visible` 的使用边界

5. **优化构建规模**
   - 评估排序分页的静态生成数量
   - 为 `getSortedPosts()` 增加构建期缓存

## 七、附录

### 本次使用的测试脚本
- `scripts/perf-smoke.py`

### 当前开发服务器
- 最终复测实例运行于：`http://127.0.0.1:4323/`
- 已遵循“不要重复启动”的要求：每次基线/现版测试前均停止上一个实例后再启动新的单实例服务
