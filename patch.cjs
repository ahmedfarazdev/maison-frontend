const fs = require("fs");
const file = "C:/Users/Legend/Documents/maison-full/maison-frontend/src/lib/api-client.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(/'\/packaging\/skus'/g, "'/packaging-skus'");

const regexList = /try\s*\{\s*([\s\S]*?wrapList\(.*?\);?)\s*\}\s*catch\s*\([^{]+\)\s*\{\s*(?:console\.\w+\([^)]+\);\s*)?return\s+wrapList\((?:mock\.[^)]+|\[\])\);\s*\}/g;
content = content.replace(regexList, (match, tryBody) => tryBody.trim());

const regexOne = /try\s*\{\s*([\s\S]*?wrapOne\([^;]*\);?)\s*\}\s*catch\s*\([^{]+\)\s*\{\s*return\s+wrapOne\(.*?\);\s*\}/g;
content = content.replace(regexOne, (match, tryBody) => tryBody.trim());

fs.writeFileSync(file, content, "utf8");
console.log("Successfully patched api-client.ts");
