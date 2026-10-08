地球贴图资产 · About 区实体地球（2026-10-08）
================================================

来源 / 授权
  NASA Blue Marble 白天贴图（earth_atmos_2048.jpg，three.js examples 衍生版本），
  公有领域（public domain），可自由分发。原图 2048x1024 / 500.6 KB。

本目录两个文件（同一张图，两种用途）
  1) day-1024.jpg        61 KB   1024x512 JPEG
     - 人类可读的源资产
     - 代码兜底路径（HTTP 环境下 TextureLoader 可直接读它）
  2) earth-texture.js    82 KB   window.__EARTH_TEXTURE_DATA = "data:image/jpeg;base64,..."
     - 同一张图的 base64 内联版，代码首选来源
     - 为什么用 data URI：站点可能被 file:// 直接双击打开，此时把本地 jpg 画进 canvas
       再读像素会被判跨域污染（getImageData 抛 SecurityError），而地球的调色
       （海洋→淡冰蓝 / 陆地→植被绿）必须读像素 —— 这是照搬参考站 travel 页的解法。
       加载失败时整块地球会隐藏（不留破图）。

再生成方式
  输入：earth_atmos_2048.jpg（2048x1024）
  脚本：.deepworks/tmp/earth_prep.py
  处理：PIL LANCZOS 降采样到 1024x512 → day-1024.jpg
        → base64 → earth-texture.js（带出处注释头）
  1024x512 是取舍：球在卡片里最大显示 260 CSS px（视网膜 520 px），
  1024 宽足够清晰，同时把内联体积压在 82 KB。

用在哪
  outputs/index.html → 01 About · 关于我 卡片内、文案下方居中的实体地球。
  渲染：three.js r160（本地 vendor/three/three.module.min.js）
        SphereGeometry(2,64,64) + MeshStandardMaterial(roughness 0.92)
        + BackSide 菲涅尔大气壳 + tintEarth 像素调色，参数照搬参考站。
  性能：只在该区块可见时渲染且限 30fps；特效关 / 减弱模式只渲一帧静态图。

不需要的文件
  land-mask-1024.png（Natural Earth 陆地掩膜）已删除 —— 点阵方案作废。
