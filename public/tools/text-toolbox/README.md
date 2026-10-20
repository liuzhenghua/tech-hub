# 本地文本工具箱

直接用现代浏览器打开 [index.html](./index.html)，无需安装、联网或启动服务。所有转换都在浏览器内完成，输入输出保存在浏览器本地，AES / RSA / JWT 密钥及 IV、编码选项也以明文保存到本机 localStorage。右上角可切换亮色 / 暗色，Markdown 与 Mermaid 随之切换；主题偏好和最后选择的 Tab 保存在浏览器本地。

- JWT：解析 Header、Payload 和签名段，支持 Bearer 前缀，显示 iat / nbf / exp 的 UTC 时间。可选校验签名：自动读取 Header 的 alg，填入对应密钥后点击“校验签名”，结果显示校验使用的算法。HS256 / 384 / 512 使用原始 UTF-8 文本密钥；RS、PS、ES 的 256 / 384 / 512 使用 SPKI PEM 公钥或公钥 JWK。输出仅包含 Header、Payload 和 Signature；校验结果、算法及 UTC 时间显示在独立工具信息区，不混入复制的 JSON。校验不检查有效期、签发者或受众。密钥保存在浏览器本地。
- 字符串处理：与 tools/macos/cot-editor 下三个同名 Python 脚本保持一致。escape_string 只转义反斜杠、双引号、换行和 Tab，不添加外层引号；unescape_string 自动去掉外层双引号，仅还原上述四类转义；single_to_double_quotes 按脚本规则扫描单引号字符串并处理内部引号和反斜杠，不校验 JSON，也不跳过已有双引号字符串。
- Markdown：实时渲染标题、列表、引用、代码块、表格、任务列表以及 mermaid 围栏代码块图表；支持切换 HTML 源码。预览模式复制富文本（同时提供 HTML 和纯文本剪贴板格式）；源码模式复制 HTML。浏览器不支持富文本剪贴板时降级为纯文本。预览使用隔离 iframe，过滤危险 HTML，禁止加载外部资源。
- RSA：RSA-OAEP，默认 SHA-256，可选 SHA-1 / 384 / 512；SPKI PEM / JWK 公钥加密，PKCS#8 PEM / JWK 私钥解密；Base64 / Hex 密文。RSA 密钥保存在浏览器本地，仅适合短文本；还支持 RSA PKCS#1 v1.5，兼容 Java RSA/ECB/PKCS1Padding，接受 PKCS#1 / PKCS#8 私钥。
- 密码工具：AES-GCM / CBC / CTR 加解密，支持 128 / 192 / 256 位原始密钥、Hex / Base64 / UTF-8 密钥输入及 Hex / Base64 密文。GCM 使用 12 字节 IV 和 128 位 Tag（附在密文末尾）；CBC 使用 16 字节 IV 和 PKCS#7；CTR 使用 16 字节 Counter、64 位计数器长度。可生成随机密钥 / IV，密钥与 IV 保存在浏览器本地。同一密钥不要重复使用 GCM IV / CTR Counter。
- Hash：MD5、SHA-1、SHA-256、SHA-384、SHA-512，按原始 UTF-8 字节计算。
- JSON：2 / 4 空格或 Tab 格式化，以及移除空白的压缩。另有“修复并格式化”，参考 CotEditor json_format.py 修复字符串内控制字符、非法转义和疑似未转义引号。结束引号通过后续结构字符推测，可能误判，修复后需核对内容；修复后仍无法解析时显示错误，原输入保留。严格格式化和压缩不自动修复。结果默认提供可折叠的树形视图，支持逐层展开、全部展开 / 折叠和切换文本视图。

首次打开默认选择 JSON，之后恢复上次选择的 Tab。每个工具分别保留输入、输出、选项和换行开关，刷新后恢复。可复制结果或将输出转为下一步输入。浏览器不允许直接复制时，页面会选中输出，按 Ctrl+C / ⌘C 即可。JSON 数值遵循 JavaScript 精度，大整数建议用字符串表示；MD5 / SHA-1 不适合密码存储。

Markdown 依赖随页面保存在 `vendor/`：Marked 18.1.0（MIT）和 DOMPurify 3.4.16（Apache-2.0 / MPL-2.0），另含 Mermaid 11.12.0（MIT，本地单文件构建），许可证见该目录。移动工具时保留整个目录，无需联网加载依赖。

AES-ECB 兼容 Java SunJCE `Cipher.getInstance("AES")`（ECB / PKCS5Padding），不使用 IV；密钥和密文通常都选 Base64。实现使用本地 CryptoJS 4.2.0（MIT，许可证见 vendor），仅用于旧系统兼容。

## 补充算法

- HMAC：SHA-256 / 384 / 512 / 1、MD5、SM3；密钥支持 UTF-8 / Hex / Base64，输出支持 Hex / Base64。
- SM2：公钥加密、私钥解密（Hex 密钥），C1C3C2 / C1C2C3，密文支持 Hex / Base64、可选 04 前缀；不支持 ASN.1 密文、空文本或 SM2 签名。
- SM3：UTF-8 文本摘要，输出 Hex。
- SM4：CBC / ECB，128 位密钥，PKCS#7 填充，CBC IV 16 字节。
- DES / 3DES：CBC / ECB，PKCS#7 填充；DES 密钥 8 字节，3DES 密钥 16 / 24 字节，CBC IV 8 字节。用于旧系统兼容。

额外本地依赖：node-forge 1.4.0（BSD / GPL）及 sm-crypto 0.5.7（MIT），许可证见 vendor。RSA-OAEP 默认 SHA-256，SM2 默认 C1C3C2，HMAC 默认 SHA-256，SM4 / DES / 3DES 默认 CBC。上述加解密均针对 UTF-8 文本。

一级菜单将 SM2 / SM3 / SM4 合并为“国密”，DES / 3DES 合并为“DES”；二级菜单同时显示具体算法及模式，默认分别为 SM4-CBC 和 3DES-CBC。
