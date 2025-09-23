// code.ts
/// <reference path="./node_modules/@figma/plugin-typings/index.d.ts" />

// 定义富文本片段接口
interface RichTextFragment {
  text: string;
  color: string;
  size: number;
  bold: boolean;
  italic: boolean;
  fontFamily: string; // 新增字段
  fontStyle: string; // 新增字段
}

async function loadFontsForNode(node: TextNode) {
  // 收集文本节点使用的所有字体
  const fonts: FontName[] = [];

  // 遍历文本范围以获取所有使用的字体
  try {
    const length = node.characters.length;
    if (length > 0) {
      const rangeFonts = node.getRangeAllFontNames(0, length);
      fonts.push(...rangeFonts);
    } else {
      // 如果文本为空，使用默认字体
      fonts.push({ family: "Roboto", style: "Regular" });
    }
  } catch (e) {
    // 如果无法获取范围字体，使用默认字体
    fonts.push({ family: "Roboto", style: "Regular" });
  }

  // 加载所有字体
  const loadPromises = fonts.map((font) => figma.loadFontAsync(font));
  await Promise.all(loadPromises);
}

function parseRichTextConfig(config: string): RichTextFragment[] {
  return config.split("|").map((part) => {
    const [text, color, size, bold, italic] = part.split("#");
    return {
      text: text || "",
      color: color || "", // 不设置默认颜色，稍后在applyRichText中处理
      size: size ? parseInt(size, 10) : 0, // 使用0表示未设置，稍后在applyRichText中处理
      bold: bold === "B",
      italic: italic === "I",
      fontFamily: "", // 不设置默认字体，稍后在applyRichText中处理
      fontStyle: "", // 不设置默认样式，稍后在applyRichText中处理
    };
  });
}

function rgbFromHex(hex: string): RGB {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

async function applyRichText(node: TextNode, config: string) {
  const fragments = parseRichTextConfig(config);

  // 获取节点原有的字体信息
  let originalFontFamily = "Roboto";
  let originalFontStyle = "Regular";
  try {
    // 尝试获取第一个字符的字体作为原始字体
    if (node.characters.length > 0) {
      const firstCharFont = node.getRangeFontName(0, 1);
      if (firstCharFont !== figma.mixed && firstCharFont.family) {
        originalFontFamily = firstCharFont.family;
        originalFontStyle = firstCharFont.style;
      }
    }
  } catch (e) {
    // 如果无法获取原始字体，使用默认字体
    originalFontFamily = "Roboto";
    originalFontStyle = "Regular";
  }

  // 获取节点原有的字号和颜色信息
  let originalFontSize = 16;
  let originalColor: RGB = { r: 1, g: 1, b: 1 }; // 默认使用白色而不是黑色
  try {
    // 尝试获取第一个字符的字号和颜色作为原始设置
    if (node.characters.length > 0) {
      const firstCharFontSize = node.getRangeFontSize(0, 1);
      if (firstCharFontSize !== figma.mixed) {
        originalFontSize = firstCharFontSize;
      }

      const firstCharFills = node.getRangeFills(0, 1);
      if (firstCharFills !== figma.mixed && firstCharFills.length > 0) {
        const fill = firstCharFills[0];
        if (fill.type === "SOLID") {
          originalColor = fill.color;
        }
      }
    }
  } catch (e) {
    // 如果无法获取原始字号和颜色，使用白色作为默认设置
    originalFontSize = 16;
    originalColor = { r: 1, g: 1, b: 1 }; // 白色
  }

  // 解析原始样式，确定基础样式
  const isOriginalBold = originalFontStyle.includes("Bold");
  const isOriginalItalic = originalFontStyle.includes("Italic");

  // 收集所有需要的字体
  const fontsToLoad: FontName[] = [];
  for (const frag of fragments) {
    // 基于原始样式和新样式确定最终样式
    const isBold = frag.bold || isOriginalBold;
    const isItalic = frag.italic || isOriginalItalic;

    const fontStyle =
      isBold && isItalic
        ? "Bold Italic"
        : isBold
        ? "Bold"
        : isItalic
        ? "Italic"
        : "Regular";

    // 使用节点原有的字体族，或配置中指定的字体族（如果有的话）
    const fontFamily = frag.fontFamily || originalFontFamily;

    fontsToLoad.push({ family: fontFamily, style: fontStyle });
  }

  // 加载所有需要的字体
  const loadPromises = fontsToLoad.map((font) => figma.loadFontAsync(font));
  await Promise.all(loadPromises);

  // 拼接完整字符串
  const fullText = fragments.map((f) => f.text).join("");
  node.characters = fullText;

  let offset = 0;

  for (const frag of fragments) {
    const start = offset;
    const end = start + frag.text.length;

    // 设置颜色，如果配置中没有指定颜色则使用原有颜色
    const colorToApply =
      frag.color === "" && frag.text !== ""
        ? originalColor
        : rgbFromHex("#" + frag.color);

    node.setRangeFills(start, end, [{ type: "SOLID", color: colorToApply }]);

    // 设置字号，如果配置中没有指定字号则使用原有字号
    const fontSizeToApply =
      frag.size === 0 && frag.text !== "" ? originalFontSize : frag.size;

    node.setRangeFontSize(start, end, fontSizeToApply);

    // 设置字体（加粗/斜体），优先使用原有字体
    // 基于原始样式和新样式确定最终样式
    const isBold = frag.bold || isOriginalBold;
    const isItalic = frag.italic || isOriginalItalic;

    const fontStyle =
      isBold && isItalic
        ? "Bold Italic"
        : isBold
        ? "Bold"
        : isItalic
        ? "Italic"
        : "Regular";

    // 使用节点原有的字体族，或配置中指定的字体族（如果有的话）
    const fontFamily = frag.fontFamily || originalFontFamily;

    node.setRangeFontName(start, end, {
      family: fontFamily,
      style: fontStyle,
    });

    offset = end;
  }
}

async function traverse(node: SceneNode, translations: Record<string, string>) {
  if ("children" in node) {
    for (const child of node.children) {
      await traverse(child, translations);
    }
  }

  if (node.type === "TEXT" && translations[node.name]) {
    try {
      if (node.name.endsWith("rtf")) {
        await applyRichText(node, translations[node.name]);
      } else {
        // 在设置字符前加载字体
        await loadFontsForNode(node);
        node.characters = translations[node.name];
        console.log(`✅ 替换 ${node.name} → ${translations[node.name]}`);
      }
    } catch (err) {
      console.error(`❌ 替换失败: ${node.name}`, err);
    }
  }
}

// 监听来自 UI 的消息
figma.ui.onmessage = async (msg) => {
  if (msg.type === "apply-translations") {
    const translations = msg.translations as Record<string, string>;
    await traverse(figma.currentPage as any, translations);
    figma.notify("多语言替换完成 ✅");
  } else if (msg.type === "cancel") {
    figma.closePlugin();
  }
};

// 打开 UI
figma.showUI(__html__, { width: 400, height: 300 });
