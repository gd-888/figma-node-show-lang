# 更新日志

## [1.0.1] - 2025-09-18

### 修复

- 修复 TypeScript 编译错误：`找不到名称"RichTextFragment" ts(2304)`
- 解决字体加载问题：`Cannot write to node with unloaded font` 错误
- 移除 manifest.json 中的 version 字段（Figma 插件不支持此属性）
- 优化富文本处理函数中的字体加载机制

### 改进

- 实现字体批量加载，提高插件性能
- 完善版本号管理，确保 package.json 版本号正确维护（manifest.json 中不包含 version 字段，由 Figma 平台管理）
- 完善错误处理机制

## [1.0.0] - 2025-09-15

### 新增

- 初始版本发布
- 支持基础多语言文本替换功能
- 支持 Excel/CSV 文件导入和解析
- 实现富文本格式 (RTF) 支持
- 提供图形用户界面用于语言选择和操作
