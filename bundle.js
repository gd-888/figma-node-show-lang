var plugin = (function (exports) {
  "use strict";

  var src = {};

  var generateTemplateFile = {};

  Object.defineProperty(generateTemplateFile, "__esModule", { value: true });
  generateTemplateFile.generateTemplateFile = void 0;
  generateTemplateFile.generateTemplateFile = (args) => {
    console.log("generateTemplateFile", args);
    const { code, utils, nodeTree } = args;
    const { template, imports } = code;
    const { getImportsString } = utils;
    // nodeTree: {
    //   name: 'xxx';
    //   type: 'FRAME';
    //   id: '1344:1281';
    // }
    return `import React from 'react';
import styles from './Component.module.less';
${getImportsString(imports)}

const Component = () => {
  return (
  ${template}
  );
}
export default Component;
`;
  };

  var modifyJSONSchema = {};

  var figmaApi = {};

  Object.defineProperty(figmaApi, "__esModule", { value: true });
  figmaApi.getFileNodes = figmaApi.getVariable = void 0;
  /**
   * Get Figma variables export data
   * @returns Promise<ExportedVariablesData | null>
   */
  figmaApi.getVariable = async (pageName) => {
    try {
      if (!pageName) {
        console.warn("Page name is empty, skipping variable fetch");
        return null;
      }
      const jsonString = JSON.stringify({ filename: `${pageName}.json` });
      const response = await fetch("https://grizzly.hk.cpolar.io/get-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: jsonString,
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to fetch Figma variables:", error);
      return null;
    }
  };
  /**
   * Get specific nodes from a Figma file
   * @param fileId The ID of the Figma file
   * @param nodeIds Array of node IDs to fetch
   * @returns Promise<FigmaNodeResponse>
   */
  figmaApi.getFileNodes = async (figmaToken, fileId, nodeIds) => {
    try {
      // 参数验证
      if (!figmaToken) {
        throw new Error("Figma token is required");
      }
      if (!fileId) {
        throw new Error("File ID is required");
      }
      if (!nodeIds || nodeIds.length === 0) {
        throw new Error("At least one node ID is required");
      }
      const ids = nodeIds.join(",");
      const response = await fetch(
        `https://api.figma.com/v1/files/${fileId}/nodes?ids=${ids}`,
        {
          headers: {
            // 'X-Figma-Token': FIGMA_ACCESS_TOKEN,
            "X-Figma-Token": figmaToken,
          },
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Figma nodes: ${error.message}`);
      } else {
        throw new Error("Failed to fetch Figma nodes: Unknown error");
      }
    }
  };

  var figmaVariables = {};

  Object.defineProperty(figmaVariables, "__esModule", { value: true });
  figmaVariables.processNodeVariables = figmaVariables.getNodeIdVariable =
    void 0;
  /**
   * 获取节点变量映射
   * @param figmaNode Figma 节点
   * @returns 节点ID到变量的映射
   */
  figmaVariables.getNodeIdVariable = (figmaNode) => {
    const nodeIdVariable = {};
    const checkVariable = (node) => {
      // 如果当前节点有绑定变量，则记录下来
      if (node.boundVariables) {
        nodeIdVariable[node.id] = node.boundVariables;
      }
      // 递归处理子节点
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          checkVariable(child);
        });
      }
    };
    if (figmaNode) {
      checkVariable(figmaNode);
    }
    return nodeIdVariable;
  };
  /**
   * 处理节点的样式变量
   * @param checkNode 要处理的节点
   * @param nodeIdVariables 节点变量映射
   * @param variables 变量数据
   */
  figmaVariables.processNodeVariables = (
    checkNode,
    nodeIdVariables,
    variables
  ) => {
    // 参数验证
    if (!checkNode || !nodeIdVariables || !variables) {
      return;
    }
    if (nodeIdVariables[checkNode.id]) {
      const nodeIdVariable = nodeIdVariables[checkNode.id];
      // 处理透明度变量
      if (nodeIdVariable.opacity && variables[nodeIdVariable.opacity.id]) {
        checkNode.style.opacity = `var(--${
          variables[nodeIdVariable.opacity.id].name
        })`;
      }
      // 处理圆角变量
      if (nodeIdVariable.rectangleCornerRadii) {
        const cornerRadii = nodeIdVariable.rectangleCornerRadii;
        // 左上圆角
        if (
          cornerRadii.RECTANGLE_TOP_LEFT_CORNER_RADIUS &&
          variables[cornerRadii.RECTANGLE_TOP_LEFT_CORNER_RADIUS.id]
        ) {
          checkNode.style.borderTopLeftRadius = `var(--${
            variables[cornerRadii.RECTANGLE_TOP_LEFT_CORNER_RADIUS.id].name
          })`;
        }
        // 右上圆角
        if (
          cornerRadii.RECTANGLE_TOP_RIGHT_CORNER_RADIUS &&
          variables[cornerRadii.RECTANGLE_TOP_RIGHT_CORNER_RADIUS.id]
        ) {
          checkNode.style.borderTopRightRadius = `var(--${
            variables[cornerRadii.RECTANGLE_TOP_RIGHT_CORNER_RADIUS.id].name
          })`;
        }
        // 左下圆角
        if (
          cornerRadii.RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS &&
          variables[cornerRadii.RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS.id]
        ) {
          checkNode.style.borderBottomLeftRadius = `var(--${
            variables[cornerRadii.RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS.id].name
          })`;
        }
        // 右下圆角
        if (
          cornerRadii.RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS &&
          variables[cornerRadii.RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS.id]
        ) {
          checkNode.style.borderBottomRightRadius = `var(--${
            variables[cornerRadii.RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS.id].name
          })`;
        }
      }
    }
  };

  var rcComponent = {};

  Object.defineProperty(rcComponent, "__esModule", { value: true });
  rcComponent.processNodeRcComponent = void 0;
  /**
   * 添加组件依赖的辅助函数
   */
  const addComponentDependency = (
    checkNode,
    componentName,
    packageName,
    defaultModule = false
  ) => {
    checkNode.dependencies = [
      {
        componentName,
        packageName,
        defaultModule,
      },
      // 如果原 root 有依赖，也保留它
      ...(checkNode.dependencies || []),
    ];
  };
  /**
   * 处理 Button222 组件，将其包装在 RcButton 中
   */
  const processButton222 = (checkNode) => {
    // 为 div 包裹 Button 组件
    const formNode = {
      name: "Button",
      tag: "Button",
      type: "INSTANCE",
      packageName: "@/core/components/button/Button",
      componentName: "Button",
      props: {
        children: checkNode,
      },
      children: [checkNode],
    };
    return formNode;
  };
  /**
   * 处理 img 组件
   */
  const processImg = (checkNode) => {
    // <img
    //     src="https://p3-semi-sign.byteimg.com/tos-cn-i-acvclvrq33/de8bacfb826145639880cd72c3b57554.png?rk3s=521bdb00&x-expires=1760951207&x-signature=YoD0BQeawBnD%2B%2BIXQV4HXbkdXXc%3D"
    //     className={styles.ethereum}
    // />
    if (checkNode.name.startsWith("RcImgLang")) {
      // import { MultilingualImage } from "@/core/components/language/MultilingualImage";
      checkNode.tag = "MultilingualImage";
      // 2️⃣ 新增依赖
      addComponentDependency(
        checkNode,
        "MultilingualImage",
        "@/core/components/language/MultilingualImage",
        false
      );
    } else {
      checkNode.tag = "BlobImage";
      // 2️⃣ 新增依赖
      addComponentDependency(
        checkNode,
        "BlobImage",
        "@/core/components/BlobImage",
        false
      );
    }
    // 正确返回替换后的节点
    return checkNode;
  };
  /**
   * 处理 Button 组件
   */
  const processButton = (checkNode) => {
    // 将 Button 组件替换原来的位置并保留子元素
    //设置组件标签名 <Button/>
    // <Button af="af" className={styles.button2}>
    //   <p className={styles.button}>Button</p>
    // </Button>
    checkNode.tag = "Button";
    // 2️⃣ 新增依赖
    addComponentDependency(
      checkNode,
      "Button",
      "@/core/components/button/Button",
      false
    );
    //解析封装组件属性 <RcButton af="af" />
    checkNode.props = checkNode.props ?? {};
    //   //<RcButton af="af" />
    //   checkNode.props.af = 'af';
    // 正确返回替换后的节点
    return checkNode;
  };
  /**
   * 处理节点的组件属性
   * @param checkNode 要处理的节点
   */
  rcComponent.processNodeRcComponent = (checkNode) => {
    if (checkNode.packageName) {
      return null;
    }
    if (checkNode.tag === "img") {
      return processImg(checkNode);
    } else if (checkNode.name.startsWith("Button222")) {
      return processButton222(checkNode);
    } else if (checkNode.name.startsWith("RcButton")) {
      return processButton(checkNode);
    }
    return null;
  };

  Object.defineProperty(modifyJSONSchema, "__esModule", { value: true });
  modifyJSONSchema.modifyJSONSchema = void 0;
  const figmaApi_1 = figmaApi;
  const figmaVariables_1 = figmaVariables;
  const rcComponent_1 = rcComponent;
  modifyJSONSchema.modifyJSONSchema = async (node, pluginOptions) => {
    console.log("modifyJSONSchema", node, pluginOptions);
    let nodeIdVariables = {};
    const variablesData = await figmaApi_1.getVariable(node.pageName);
    console.log("variablesData", variablesData);
    if (variablesData) {
      const figmaNodeId = node.nodeId.replace(/:/g, "-");
      const figmaData = await figmaApi_1.getFileNodes(
        pluginOptions.figmaToken,
        variablesData.figmaFileId,
        [figmaNodeId]
      );
      console.log("figmaData", figmaData.nodes[node.nodeId].document);
      nodeIdVariables = figmaVariables_1.getNodeIdVariable(
        figmaData.nodes[node.nodeId].document
      );
      console.log("nodeIdVariables", nodeIdVariables);
    }
    const root = node.children[0];
    console.log("root", root);
    const variables = variablesData.variables;
    // 组件参数变量 解析
    // componentProperties:{
    //   "theme": {
    //       "value": "solid",
    //       "type": "VARIANT",
    //       "boundVariables": {}
    //   },
    //   "type": {
    //       "value": "primary",
    //       "type": "VARIANT",
    //       "boundVariables": {}
    //   },
    //   "disabled": {
    //       "value": "false",
    //       "type": "VARIANT",
    //       "boundVariables": {}
    //   },
    //   "iconPosition": {
    //       "value": "left",
    //       "type": "VARIANT",
    //       "boundVariables": {}
    //   },
    //   "children": {
    //       "value": "true",
    //       "type": "VARIANT",
    //       "boundVariables": {}
    //   },
    //   "icon": {
    //       "value": "false",
    //       "type": "VARIANT",
    //       "boundVariables": {}
    //   },
    //   "loading": {
    //       "value": "false",
    //       "type": "VARIANT",
    //       "boundVariables": {}
    //   }
    // }
    //放到组件
    //   props: {
    //     "theme": "solid",
    //     "children": "单色按钮",
    //     "className": {
    //         "__semid2cvariable__": true,
    //         "label": "styles.button"
    //     }
    // }
    const checkRc = (checkNode) => {
      // 处理节点变量样式
      figmaVariables_1.processNodeVariables(
        checkNode,
        nodeIdVariables,
        variables
      );
      if (
        checkNode.style.backgroundImage &&
        checkNode.style.background &&
        !checkNode.style.backgroundImage.includes("url(http")
      ) {
        delete checkNode.style.backgroundImage;
      }
      // 处理rc组件
      const rcComponentNode = rcComponent_1.processNodeRcComponent(checkNode);
      if (rcComponentNode) {
        return rcComponentNode;
      }
      // 递归处理子节点
      if (checkNode.children && checkNode.children.length > 0) {
        checkNode.children = checkNode.children.map((child) => {
          return checkRc(child) || child;
        });
      }
      return checkNode;
    };
    // 处理根节点
    const newRoot = checkRc(root);
    node.children = [newRoot];
    return { newNode: node, variablesData: variablesData };
  };

  Object.defineProperty(src, "__esModule", { value: true });
  exports.semiD2CPlugin = src.semiD2CPlugin = void 0;
  const generateTemplateFile_1 = generateTemplateFile;
  const modifyJSONSchema_1 = modifyJSONSchema;
  exports.semiD2CPlugin = src.semiD2CPlugin = () => {
    // ✅ 1. 在插件作用域里定义共享数据对象
    const data = {};
    return {
      name: "Semi D2C TO RC Plugin",
      options: [
        {
          name: "figmaToken",
          type: "input",
          defaultValue: "",
        },
      ],
      setup(api, pluginOptions) {
        api.modifyJSONSchema(async (node) => {
          const { newNode, variablesData } =
            await modifyJSONSchema_1.modifyJSONSchema(node, pluginOptions);
          data.variablesData = variablesData;
          return newNode;
        });
        api.generateTemplateFile(generateTemplateFile_1.generateTemplateFile);
        api.isImageNode((args) => {
          if (args.node.name.startsWith("RcImg")) {
            return {
              format: "PNG",
            };
          }
          return undefined;
        });
        // 变量样式导出
        api.modifySandboxFiles((args) => {
          const { sandboxParams } = args;
          const { files } = sandboxParams;
          // 这里就能拿到 modifyJSONSchema 中存下的 variablesData
          const variables = data.variablesData?.variables;
          if (variables) {
            // 生成 CSS 变量格式的内容
            let cssContent = ":root {\n";
            Object.keys(variables).forEach((key) => {
              const variable = variables[key];
              cssContent += `  --${variable.name}: ${variable.cssValue};\n`;
            });
            cssContent += "}\n";
            // 注入到文件中
            if (files["variables.css"] === undefined) {
              files["variables.css"] = {
                content: cssContent,
                isBinary: false,
              };
            }
          }
          return sandboxParams;
        });
        api.modifyEditorDefaultOpenFiles((options) => {
          //修改编辑器 tab 栏默认打开的文件列表
          return [
            // 模板文件
            "components.js",
            "components.ts",
            "component.jsx",
            "components.tsx",
            // 样式文件
            "index.module.scss",
            //
            "variables.css",
            "style.js",
          ];
        });
      },
    };
  };

  exports.default = src;

  Object.defineProperty(exports, "__esModule", { value: true });

  return exports;
})({});
