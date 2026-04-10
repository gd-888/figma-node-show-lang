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
            color: color || "",
            size: size ? parseInt(size, 10) : 0,
            bold: bold === "B",
            italic: italic === "I",
            fontFamily: "",
            fontStyle: "",
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
    let originalFontFamily = "Roboto";
    let originalFontStyle = "Regular";
    try {
        if (node.characters.length > 0) {
            const firstCharFont = node.getRangeFontName(0, 1);
            if (firstCharFont !== figma.mixed && firstCharFont.family) {
                originalFontFamily = firstCharFont.family;
                originalFontStyle = firstCharFont.style;
            }
        }
    }
    catch (e) {
        originalFontFamily = "Roboto";
        originalFontStyle = "Regular";
    }
    let originalFontSize = 16;
    let originalColor = { r: 1, g: 1, b: 1 };
    try {
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
    }
    catch (e) {
        originalFontSize = 16;
        originalColor = { r: 1, g: 1, b: 1 };
    }
    const isOriginalBold = originalFontStyle.includes("Bold");
    const isOriginalItalic = originalFontStyle.includes("Italic");
    const fontsToLoad = [];
    for (const frag of fragments) {
        const isBold = frag.bold || isOriginalBold;
        const isItalic = frag.italic || isOriginalItalic;
        const fontStyle = isBold && isItalic
            ? "Bold Italic"
            : isBold
                ? "Bold"
                : isItalic
                    ? "Italic"
                    : "Regular";
        const fontFamily = frag.fontFamily || originalFontFamily;
        fontsToLoad.push({ family: fontFamily, style: fontStyle });
    }
    const loadPromises = fontsToLoad.map((font) => figma.loadFontAsync(font));
    await Promise.all(loadPromises);
    const fullText = fragments.map((f) => f.text).join("");
    node.characters = fullText;
    let offset = 0;
    for (const frag of fragments) {
        const start = offset;
        const end = start + frag.text.length;
        const colorToApply = frag.color === "" && frag.text !== ""
            ? originalColor
            : rgbFromHex("#" + frag.color);
        node.setRangeFills(start, end, [{ type: "SOLID", color: colorToApply }]);
        const fontSizeToApply = frag.size === 0 && frag.text !== "" ? originalFontSize : frag.size;
        node.setRangeFontSize(start, end, fontSizeToApply);
        const isBold = frag.bold || isOriginalBold;
        const isItalic = frag.italic || isOriginalItalic;
        const fontStyle = isBold && isItalic
            ? "Bold Italic"
            : isBold
                ? "Bold"
                : isItalic
                    ? "Italic"
                    : "Regular";
        const fontFamily = frag.fontFamily || originalFontFamily;
        node.setRangeFontName(start, end, {
            family: fontFamily,
            style: fontStyle,
        });
        offset = end;
    }
}
const SHEET_CSV_WORKER_ORIGIN = "https://steep-pond-4195.wgd-f3e.workers.dev";
function buildSheetCsvWorkerUrl(spreadsheetId, gid) {
    const g = gid !== undefined && gid !== "" ? gid : "0";
    return (`${SHEET_CSV_WORKER_ORIGIN}/?sheetId=${encodeURIComponent(spreadsheetId)}` +
        `&gid=${encodeURIComponent(g)}`);
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
    else if (msg.type === "fetch-public-sheet-csv") {
        const { spreadsheetId, gid } = msg;
        try {
            const exportUrl = buildSheetCsvWorkerUrl(spreadsheetId, gid);
            const res = await fetch(exportUrl, {
                method: "GET",
                redirect: "follow",
            });
            const text = await res.text();
            if (!res.ok) {
                figma.ui.postMessage({
                    type: "public-sheet-csv-error",
                    status: res.status,
                    message: `HTTP ${res.status} ${res.statusText}`,
                });
                return;
            }
            const head = text.replace(/^\s+/, "").slice(0, 200).toLowerCase();
            if (head.startsWith("<") ||
                head.includes("<!doctype") ||
                head.includes("<html")) {
                figma.ui.postMessage({
                    type: "public-sheet-csv-error",
                    message: "返回内容不是 CSV。请确认表格已公开可读，或检查 Worker 是否正常",
                });
                return;
            }
            figma.ui.postMessage({ type: "public-sheet-csv-ok", csv: text });
        }
        catch (e) {
            const err = e;
            figma.ui.postMessage({
                type: "public-sheet-csv-error",
                message: err.message || String(e),
            });
        }
    }
};
figma.showUI(__html__, { width: 450, height: 460 });
