// code.ts
/// <reference path="./node_modules/@figma/plugin-typings/index.d.ts" />

// 定义富文本片段接口
interface RichTextFragment {
  text: string;
  color: string;
  size: number;
  bold: boolean;
  italic: boolean;
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
      color: "#" + color || "#000000",
      size: size ? parseInt(size, 10) : 16,
      bold: bold === "B",
      italic: italic === "I",
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

    fontsToLoad.push({ family: originalFontFamily, style: fontStyle });
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

    // 设置颜色
    node.setRangeFills(start, end, [
      { type: "SOLID", color: rgbFromHex(frag.color) },
    ]);

    // 设置字号
    node.setRangeFontSize(start, end, frag.size);

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

    node.setRangeFontName(start, end, {
      family: originalFontFamily,
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
