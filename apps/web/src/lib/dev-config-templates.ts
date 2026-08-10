export const GITIGNORE_TEMPLATES: Record<string, string> = {
  node: `# Dependencies
node_modules/
.pnpm-store/

# Build
dist/
build/
coverage/
*.tsbuildinfo

# Env
.env
.env.*
!.env.example

# Logs / caches
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.turbo/
.cache/
`,
  python: `__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/
.env
.pytest_cache/
.mypy_cache/
.ruff_cache/
dist/
build/
`,
  go: `# Binaries
*.exe
*.test
*.out
bin/

# Go workspace
vendor/

# Env
.env
`,
  rust: `/target/
**/*.rs.bk
Cargo.lock
.env
`,
  java: `target/
*.class
*.jar
*.war
.idea/
*.iml
.gradle/
build/
.env
`,
  macos: `.DS_Store
.AppleDouble
.LSOverride
Icon?
._*
`,
  windows: `Thumbs.db
ehthumbs.db
Desktop.ini
$RECYCLE.BIN/
*.stackdump
`,
  vscode: `.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
*.code-workspace
`,
};

export const EDITORCONFIG_TEMPLATES: Record<string, string> = {
  default: `root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
`,
  python: `root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 4

[*.{yml,yaml,json,md}]
indent_size = 2
`,
  go: `root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = tab

[*.{yml,yaml,md,json}]
indent_style = space
indent_size = 2
`,
};
