export const communitySchemaZh = {
  communitySchema: {
    asyncapiTitle: 'AsyncAPI 查看与校验',
    celTitle: 'CEL 表达式调试',
    spdxTitle: 'SPDX 表达式',
    dependenciesTitle: '表依赖分析',
    ddlTitle: 'DDL 转 ER 图',
    asyncapiHint:
      '支持 AsyncAPI 2.x / 3.0 JSON、YAML 和本文件 # 引用；展示频道、操作、消息数量及官方解析器诊断。最大 1 MiB、64 层、30,000 个值，诊断最多展示 200 项。暂不支持外部引用、带 URI 的 schema $id 或 YAML 别名。',
    celHint:
      '使用 CEL 标准表达式与 JSON 变量绑定。JSON 数字默认映射为 double，可将安全整数映射为 int；大整数请以字符串输入后用 int() 转换。表达式最大 16 KiB、绑定最大 256 KiB；不注册自定义函数。结果保留 int / uint 精度，map 以键值对展示。',
    spdxHint:
      '解析 AND / OR / WITH 的组合树与许可证、例外标识符。支持 LicenseRef；社区解析器也接受小写运算符。最大 8,192 字符、64 层。只解析表达式，不判断许可证之间是否兼容。',
    dependenciesHint:
      'PostgreSQL / MySQL SELECT、连接、子查询、UNION 与 CTE 的真实表读取依赖；按作用域区分 CTE 和别名，不分析列血缘或执行 SQL。为避免解析器丢失引号信息导致误判，CTE 使用小写名称；不支持表值函数和写入语句。最大 256 KiB、100 条语句。',
    ddlHint:
      '从 PostgreSQL / MySQL CREATE TABLE 主键、外键生成 ER 图。支持行内及表级键、组合外键；不处理 ALTER 或 CREATE AS。最大 256 KiB、40 张表、共 500 列；外部表以占位表示。图中列编号对应注释中的原列名，结构 JSON 保留完整名称。',
    upload: '拖入或选择 JSON / YAML 文件',
    source: '输入',
    bindings: '变量绑定（JSON 对象）',
    numberType: 'JSON 数字映射',
    double: 'JSON 数字 → double',
    int: '安全整数 → int，其余 → double',
    analyze: '分析',
    running: '处理中…',
    cancel: '取消',
    sample: '载入示例',
    clear: '清空',
    output: '结构与诊断',
    complete: '处理完成',
    invalid: '存在校验错误，请查看诊断',
    tree: '表达式树',
    dialect: 'SQL 方言',
    downloadSvg: '下载 SVG',
    failed: '处理失败：{{message}}',
    errors: {
      LIMIT: '超出输入、结构深度或结果上限',
      TIMEOUT: '处理超时，请缩小输入后重试',
      CANCELLED: '已取消',
      WORKER_ERROR: '处理进程异常',
      ASYNC_FORMAT: '缺少 AsyncAPI 版本字段或文档格式错误',
      YAML_ALIAS: '暂不支持 YAML 别名或循环结构',
      LOCAL_REFS: '只支持当前文档内的 # 引用，外部引用已阻止',
      SCHEMA_ID: '暂不支持带 URI 的 schema $id',
      BINDINGS: '变量绑定必须是 JSON 对象',
      UNSAFE_NUMBER: 'JSON 数字超出安全整数范围，请改用字符串并显式转换',
      SELECT_ONLY: '表依赖首版只支持 SELECT，不支持写入语句',
      CTE_CASE: '大小写敏感 CTE 无法可靠区分，请使用小写 CTE 名称与引用',
      TABLE_FUNCTION: '暂不支持表值函数或未知 FROM 结构',
      SQL_UNSUPPORTED: '此 SQL 结构暂不支持',
      CREATE_ONLY: 'ER 图只支持显式列定义的 CREATE TABLE',
      DUPLICATE_TABLE: '存在重复的表定义',
      KEY_COLUMN: '主外键引用了缺失的列，或两侧列数不一致',
    },
  },
};
export const communitySchemaEn = {
  communitySchema: {
    asyncapiTitle: 'AsyncAPI Viewer & Validator',
    celTitle: 'CEL Expression Debugger',
    spdxTitle: 'SPDX Expressions',
    dependenciesTitle: 'Table Dependencies',
    ddlTitle: 'DDL to ER Diagram',
    asyncapiHint:
      'AsyncAPI 2.x / 3.0 JSON or YAML with in-document # references. Shows channels, operations, message counts, and official parser diagnostics. Up to 1 MiB, 64 levels, 30,000 values, and 200 displayed diagnostics. External references, URI schema $id values, and YAML aliases are not supported.',
    celHint:
      'Evaluate standard CEL expressions with JSON variable bindings. JSON numbers map to double by default; safe integers can map to int. Pass larger integers as strings and convert with int(). Expressions: 16 KiB; bindings: 256 KiB. No custom functions. Results preserve int / uint precision and display maps as entries.',
    spdxHint:
      'Inspect AND / OR / WITH trees and license / exception identifiers. Supports LicenseRef; the community parser also accepts lowercase operators. Up to 8,192 characters and 64 levels. Parses expressions without assessing license compatibility.',
    dependenciesHint:
      'Physical table reads in PostgreSQL / MySQL SELECT, joins, subqueries, UNION, and CTEs, with scoped CTE and alias handling. No column lineage or SQL execution. Use lowercase CTE names because the parser loses quoting information. Table functions and writes are unsupported. Up to 256 KiB and 100 statements.',
    ddlHint:
      'Generate ER diagrams from PostgreSQL / MySQL CREATE TABLE primary and foreign keys, including inline, table-level, and composite keys. ALTER and CREATE AS are unsupported. Up to 256 KiB, 40 tables, and 500 columns. External tables appear as placeholders. Column IDs use original names as comments; structure JSON preserves complete names.',
    upload: 'Drop or choose JSON / YAML',
    source: 'Input',
    bindings: 'Variable bindings (JSON object)',
    numberType: 'JSON number mapping',
    double: 'JSON numbers → double',
    int: 'Safe integers → int, others → double',
    analyze: 'Analyze',
    running: 'Processing…',
    cancel: 'Cancel',
    sample: 'Load example',
    clear: 'Clear',
    output: 'Structure and diagnostics',
    complete: 'Processing complete',
    invalid: 'Validation errors found; review diagnostics',
    tree: 'Expression tree',
    dialect: 'SQL dialect',
    downloadSvg: 'Download SVG',
    failed: 'Processing failed: {{message}}',
    errors: {
      LIMIT: 'Input, depth, or output limit exceeded',
      TIMEOUT: 'Processing timed out; try a smaller input',
      CANCELLED: 'Cancelled',
      WORKER_ERROR: 'Worker failed',
      ASYNC_FORMAT: 'Missing AsyncAPI version or invalid document',
      YAML_ALIAS: 'YAML aliases and cycles are not supported',
      LOCAL_REFS:
        'Only in-document # references are supported; external references were blocked',
      SCHEMA_ID: 'URI schema $id values are not supported',
      BINDINGS: 'Bindings must be a JSON object',
      UNSAFE_NUMBER:
        'Unsafe JSON integer; use a string and explicit conversion',
      SELECT_ONLY: 'Table dependencies support SELECT only, without writes',
      CTE_CASE:
        'Case-sensitive CTEs cannot be resolved reliably; use lowercase CTE names and references',
      TABLE_FUNCTION:
        'Table functions or unknown FROM structures are unsupported',
      SQL_UNSUPPORTED: 'Unsupported SQL structure',
      CREATE_ONLY:
        'ER diagrams require CREATE TABLE with explicit column definitions',
      DUPLICATE_TABLE: 'Duplicate table definition',
      KEY_COLUMN: 'Missing key column or mismatched foreign-key arity',
    },
  },
};
