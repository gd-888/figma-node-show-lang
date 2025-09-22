"use strict";
async function loadFontsForNode(node) {
    const fonts = [];
    try {
        const length = node.characters.length;
        if (length > 0) {
            const rangeFonts = node.getRangeAllFontNames(0, length);
            fonts.push(...rangeFonts);
        }
        else {
            fonts.push({ family: "Roboto", style: "Regular" });
        }
    }
    catch (e) {
        fonts.push({ family: "Roboto", style: "Regular" });
    }
    const loadPromises = fonts.map((font) => figma.loadFontAsync(font));
    await Promise.all(loadPromises);
}
function parseRichTextConfig(config) {
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
function rgbFromHex(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
}
async function applyRichText(node, config) {
    const fragments = parseRichTextConfig(config);
    const fontsToLoad = [];
    for (const frag of fragments) {
        const fontStyle = frag.bold && frag.italic
            ? "Bold Italic"
            : frag.bold
                ? "Bold"
                : frag.italic
                    ? "Italic"
                    : "Regular";
        fontsToLoad.push({ family: "Roboto", style: fontStyle });
    }
    const loadPromises = fontsToLoad.map((font) => figma.loadFontAsync(font));
    await Promise.all(loadPromises);
    const fullText = fragments.map((f) => f.text).join("");
    node.characters = fullText;
    let offset = 0;
    for (const frag of fragments) {
        const start = offset;
        const end = start + frag.text.length;
        node.setRangeFills(start, end, [
            { type: "SOLID", color: rgbFromHex(frag.color) },
        ]);
        node.setRangeFontSize(start, end, frag.size);
        const fontStyle = frag.bold && frag.italic
            ? "Bold Italic"
            : frag.bold
                ? "Bold"
                : frag.italic
                    ? "Italic"
                    : "Regular";
        node.setRangeFontName(start, end, { family: "Roboto", style: fontStyle });
        offset = end;
    }
}
async function traverse(node, translations) {
    if ("children" in node) {
        for (const child of node.children) {
            await traverse(child, translations);
        }
    }
    if (node.type === "TEXT" && translations[node.name]) {
        try {
            if (node.name.endsWith("rtf")) {
                await applyRichText(node, translations[node.name]);
            }
            else {
                await loadFontsForNode(node);
                node.characters = translations[node.name];
                console.log(`✅ 替换 ${node.name} → ${translations[node.name]}`);
            }
        }
        catch (err) {
            console.error(`❌ 替换失败: ${node.name}`, err);
        }
    }
}
figma.ui.onmessage = async (msg) => {
    if (msg.type === "apply-translations") {
        const translations = msg.translations;
        await traverse(figma.currentPage, translations);
        figma.notify("多语言替换完成 ✅");
    }
    else if (msg.type === "cancel") {
        figma.closePlugin();
    }
};
figma.showUI(__html__, { width: 360, height: 260 });
