# Godot MCP 开发工具

固定版本：`@coding-solo/godot-mcp@0.1.1`，MIT。依赖版本由本目录package-lock.json固定，只用于开发，不进入游戏。

```powershell
npm.cmd ci --prefix tools/godot-mcp --ignore-scripts --no-audit --no-fund
```

本机项目级配置在`.codex/config.toml`，含机器路径，不提交Git。模板安装脚本为`scripts/godot/configure-project-mcp.ps1`。已安装Godot Skill来自`shihabshahrier/Godot-Skill`的`c8bc20f876a8da241274d48461444fab86182d83`，仅安装`skills/godot`目录。
