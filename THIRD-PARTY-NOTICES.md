# 第三方开源组件 / 算法来源

本插件的「鼠标涟漪」效果，其波动算法与实现思路来自以下开源项目与公开文献：

## 1. victorqribeiro/rippleEffect — MIT License

- 仓库：https://github.com/victorqribeiro/rippleEffect
- 用途：二维水面波动方程（双缓冲高度场）的参考实现
- 本插件的做法：按该实现的双缓冲迭代公式自己写了一遍，并扩展出「用波高梯度对背景做折射采样 + 曲率高光」，
  因此本插件的涟漪可以扰动**图片和视频**背景（上游只把高度场画成灰度图）。

```
MIT License

Copyright (c) 2019 Victor Ribeiro

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 2. Hugo Elias — 2D Water（算法原文）

- 原文（Internet Archive 快照）：https://web.archive.org/web/20160418004149/http://freespace.virgin.net/hugo.elias/graphics/x_water.htm
- 说明：经典的二维水面波动/涟漪算法，上游项目也是以它为参考。

## 3. 其它参考（未直接使用代码）

- sirxemic/jquery.ripples（MIT）：WebGL 版背景涟漪，https://github.com/sirxemic/jquery.ripples
  本项目评估后未采用：它依赖 jQuery，且只能作用于 CSS 背景图，无法扰动视频背景。
