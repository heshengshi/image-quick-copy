# 隐私说明 / Privacy

适用版本：0.2.0。更新日期：2026-10-26。

## 在浏览器中处理什么

扩展需要定位鼠标指向的图片，读取图片地址、尺寸和像素以转换成 PNG；它还会判断当前是否有文字选区或是否正在编辑文字，以保留正常复制行为。这些处理在本机浏览器中进行。

没有统计分析、广告、遥测、远程执行代码或运营方服务器。扩展不把图片、网页内容、复制历史或浏览记录上传给开发者。

## 网络请求

悬停时可能提前请求目标图片；按快捷键时也可能向该图片的原始地址请求内容。图片所在网站及其 CDN 仍会像处理普通网络请求一样看到请求 IP 等连接信息，应同时参考它们各自的隐私规则。

后台获取图片时使用 `credentials: omit` 和 `referrerPolicy: no-referrer`，不附带浏览器保存的账号 Cookie 或当前网页的 Referer。扩展没有额外申请 Cookie、历史记录或剪贴板读取权限。页面自身已经加载图片时，可能直接在本地读取其像素。

## 剪贴板与缓存

只有用户在图片上按下复制快捷键后，扩展才尝试写入 PNG。没有自动读取剪贴板或保存复制历史的功能。图片会留在系统剪贴板里，直到用户或其他软件替换它。

为减少等待，页面脚本与后台各有最多 8 项的内存缓存。不使用持久化存储保存图片；缓存会随相应页面或扩展后台的生命周期结束而释放。内存缓存不等于永久删除保证，浏览器自己的网络缓存仍由 Chrome 管理。

## 控制与联系

可在 `chrome://extensions/` 限制扩展的网站访问范围、停用或卸载扩展。限制网站访问范围可能使跨域图片复制失败。

有关此扩展的隐私问题，请在 [GitHub Issues](https://github.com/heshengshi/image-quick-copy/issues) 中提出。请勿公开提交私人图片、凭据或其他敏感数据。

## English summary

Image Quick Copy processes image URLs, dimensions and pixels locally to copy a static PNG after the copy shortcut. It checks selection/editing state to preserve normal text copy. It has no analytics, telemetry, ads, developer upload server, clipboard-reading feature or persistent copy history. Hovering may prefetch the target image from its original server/CDN. Background requests omit credentials and referrer headers. Bounded image caches are held in memory; Chrome's normal network cache is separate. Disable or remove the extension through Chrome's extension settings at any time.
